/**
 * 声に「ロボットの名残り」を足す加工。
 *
 * VIVANT のドラムの翻訳アプリの声は、なめらかすぎない、少し機械っぽさが
 * 残った AI 音声らしさがポイント（参考: fm23「ドラムの翻訳アプリっぽいボイス3選」）。
 * 最近の TTS はなめらかすぎるので、作った音声にうっすら機械っぽさを重ねる。
 *
 * - 声の高さに近い周波数で音量をわずかに揺らす（合成音声っぽいざらつき）
 * - ごく短い反響を重ねる（金属っぽい響き）
 * 聞き取りやすさを崩さない程度に弱めにかける。
 *
 * 取っておく音声（`ttsCache.ts`）は加工前のもの。鳴らす直前にかける。
 */

import { float32ToWavBlob } from './ttsAudio';

/**
 * 揺らす周波数（Hz）。
 * 50Hz 前後だと揺れが「ブツブツ途切れる」ように聞こえるため、
 * 声の高さに近い周波数にして、途切れではなく機械っぽい響きとして聞かせる。
 */
const MOD_HZ = 120;
/** 揺らす深さ（0〜1）。深いと途切れて聞こえるので浅めにする */
const MOD_DEPTH = 0.15;
/** 反響の遅れ（秒） */
const ECHO_SEC = 0.006;
/** 反響の強さ */
const ECHO_GAIN = 0.25;

/** 16bit モノラル PCM の WAV から、サンプルと sample rate を取り出す。形が違えば null */
function readPcm16Wav(buf: ArrayBuffer): { samples: Float32Array; sampleRate: number } | null {
  if (buf.byteLength < 44) return null;
  const view = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(
    view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3),
  );
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  // fmt / data チャンクを探す（このアプリが作る WAV は 44 バイトの決まった形）
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  while (offset + 8 <= buf.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      if (channels !== 1 || bits !== 16 || !sampleRate) return null;
      const len = Math.floor(Math.min(size, buf.byteLength - body) / 2);
      const samples = new Float32Array(len);
      for (let i = 0; i < len; i++) samples[i] = view.getInt16(body + i * 2, true) / 0x8000;
      return { samples, sampleRate };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

/** 音声（WAV）にロボットっぽさを足す。読めない形式ならそのまま返す */
export async function robotize(blob: Blob): Promise<Blob> {
  const pcm = readPcm16Wav(await blob.arrayBuffer());
  if (!pcm) return blob;
  const { samples, sampleRate } = pcm;
  const out = new Float32Array(samples.length);
  const echo = Math.max(1, Math.round(ECHO_SEC * sampleRate));
  const w = (2 * Math.PI * MOD_HZ) / sampleRate;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const mod = 1 - MOD_DEPTH + MOD_DEPTH * Math.sin(w * i);
    const dry = samples[i] * mod;
    const wet = i >= echo ? out[i - echo] * ECHO_GAIN : 0;
    out[i] = dry + wet;
    const a = Math.abs(out[i]);
    if (a > peak) peak = a;
  }
  // 反響で大きくなった分を元の大きさに戻す（割れないように）
  if (peak > 0.98) {
    const k = 0.98 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= k;
  }
  return float32ToWavBlob(out, sampleRate);
}
