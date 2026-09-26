/**
 * 声の高さを変える（速さは変えない）。
 *
 * Gemini TTS は話者ごとに声の高さがほぼ決まっていて、指示文で「高めに」と頼んでも
 * 少ししか変わらない。そこで作った音声そのものの高さを変える。
 *
 * やり方: 音声を「高さはそのまま長さだけ factor 倍」に伸ばし（WSOLA）、
 * それを元の長さに縮める（再生の速さを上げる）と、長さは元のまま高さだけ factor 倍になる。
 * WSOLA は、つなぎ目で波の形がいちばん合う位置を探して重ねるので、音がつぶれにくい。
 *
 * 取っておく音声（`ttsCache.ts`）は変えず、鳴らす直前にかける。
 */

import { float32ToWavBlob, readPcm16Wav } from './ttsAudio';

/** 変える幅の上限・下限（これを超えると声が不自然になりすぎる） */
export const MIN_PITCH = 0.6;
export const MAX_PITCH = 2.0;

/** 1 つの区切りの長さ（秒） */
const FRAME_SEC = 0.03;
/** つなぎ目を探す範囲（秒） */
const SEEK_SEC = 0.012;

/** Hann 窓 */
function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/** 高さはそのまま、長さを stretch 倍にする（WSOLA） */
function timeStretch(input: Float32Array, sampleRate: number, stretch: number): Float32Array {
  const n = Math.max(64, Math.round(FRAME_SEC * sampleRate));
  const synHop = Math.floor(n / 2);
  const anaHop = synHop / stretch;
  const seek = Math.round(SEEK_SEC * sampleRate);
  const win = hann(n);
  const outLen = Math.ceil(input.length * stretch) + n;
  const out = new Float32Array(outLen);
  const norm = new Float32Array(outLen);

  const at = (i: number) => (i >= 0 && i < input.length ? input[i] : 0);
  let prevPos = 0;
  for (let k = 0; ; k++) {
    const outPos = k * synHop;
    if (outPos + n > outLen) break;
    const nominal = Math.round(k * anaHop);
    if (nominal >= input.length) break;
    let best = nominal;
    if (k > 0) {
      // 前の区切りの自然な続き（prevPos + synHop）といちばん形が合う位置を探す
      const natural = prevPos + synHop;
      let bestScore = -Infinity;
      const from = Math.max(0, nominal - seek);
      const to = Math.min(input.length - 1, nominal + seek);
      for (let cand = from; cand <= to; cand++) {
        let score = 0;
        for (let i = 0; i < synHop; i += 2) score += at(natural + i) * at(cand + i);
        if (score > bestScore) { bestScore = score; best = cand; }
      }
    }
    for (let i = 0; i < n; i++) {
      out[outPos + i] += at(best + i) * win[i];
      norm[outPos + i] += win[i];
    }
    prevPos = best;
  }
  const len = Math.min(outLen, Math.round(input.length * stretch));
  const res = new Float32Array(len);
  for (let i = 0; i < len; i++) res[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  return res;
}

/** 長さを length にする（直線補間）。縮めると高さが上がる */
function resample(input: Float32Array, length: number): Float32Array {
  const out = new Float32Array(length);
  const ratio = input.length / length;
  for (let i = 0; i < length; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const t = x - i0;
    const a = input[i0] ?? 0;
    const b = input[i0 + 1] ?? a;
    out[i] = a + (b - a) * t;
  }
  return out;
}

/** 音声のサンプル（-1〜1）の高さを factor 倍にする。長さは変えない */
export function shiftPitch(samples: Float32Array, sampleRate: number, factor: number): Float32Array {
  const f = Math.min(MAX_PITCH, Math.max(MIN_PITCH, factor));
  if (Math.abs(f - 1) < 0.01 || samples.length < sampleRate * 0.05) return samples;
  const stretched = timeStretch(samples, sampleRate, f);
  const out = resample(stretched, samples.length);
  // 念のため最後を短くフェードアウトさせ、プツッという音を出さない
  const fade = Math.min(out.length, Math.round(0.02 * sampleRate));
  for (let i = 0; i < fade; i++) out[out.length - fade + i] *= 1 - (i + 1) / fade;
  return out;
}

/** WAV 音声の高さを factor 倍にする。読めない形式や 1 倍なら、そのまま返す */
export async function shiftPitchBlob(blob: Blob, factor: number): Promise<Blob> {
  if (Math.abs(factor - 1) < 0.01) return blob;
  const wav = readPcm16Wav(new Uint8Array(await blob.arrayBuffer()));
  if (!wav) return blob;
  const count = Math.floor(wav.pcm.byteLength / 2);
  const view = new DataView(wav.pcm.buffer, wav.pcm.byteOffset, count * 2);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) samples[i] = view.getInt16(i * 2, true) / 0x8000;
  return float32ToWavBlob(shiftPitch(samples, wav.sampleRate, factor), wav.sampleRate);
}
