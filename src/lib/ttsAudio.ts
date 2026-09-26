/**
 * 音声合成（TTS）で共通に使う音声データの組み立てと、日本語テキストの前処理。
 *
 * Gemini TTS は 16bit PCM（L16）を返すため、
 * どちらも WAV に包み直して <audio> で鳴らせる形にする。
 */

/** WAV ヘッダ（16bit・モノラル）を書き込んだ ArrayBuffer を作る */
function wavBuffer(byteLen: number, sampleRate: number): { buf: ArrayBuffer; view: DataView } {
  const buf = new ArrayBuffer(44 + byteLen);
  const view = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + byteLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);              // PCM
  view.setUint16(22, 1, true);              // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (16bit mono)
  view.setUint16(32, 2, true);              // block align
  view.setUint16(34, 16, true);             // bits/sample
  writeStr(36, 'data');
  view.setUint32(40, byteLen, true);
  return { buf, view };
}

/** 先頭が「RIFF」（WAV のヘッダ）か */
export function isRiff(bytes: Uint8Array): boolean {
  return bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
}

/** いくつかのバイト列を 1 つにつなげる */
export function concatBytes(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  if (chunks.length === 1) return chunks[0].slice();
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

/** 16bit モノラルの WAV から PCM と sample rate を取り出す。形が違えば null */
export function readPcm16Wav(bytes: Uint8Array): { pcm: Uint8Array; sampleRate: number } | null {
  if (!isRiff(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      if (channels !== 1 || bits !== 16 || !sampleRate) return null;
      const end = Math.min(bytes.byteLength, body + size);
      return { pcm: bytes.subarray(body, end), sampleRate };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

/** 16bit PCM（L16, モノラル）を WAV に変換 */
export function pcm16ToWavBlob(pcm: Uint8Array, sampleRate: number): Blob {
  const { buf } = wavBuffer(pcm.byteLength, sampleRate);
  new Uint8Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}

/** -1〜1 の Float32 サンプル（モノラル）を 16bit WAV に変換 */
export function float32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const { buf, view } = wavBuffer(samples.length * 2, sampleRate);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** 音量を見る区切りの長さ（秒） */
const FRAME_SEC = 0.02;
/** 声の終わりのあとに残す余韻（秒） */
const TAIL_KEEP_SEC = 0.15;
/** 最後にかけるフェードアウト（秒）。途中で切ったときの「プツッ」を消す */
const FADE_OUT_SEC = 0.04;
/** 最初にかけるフェードイン（秒） */
const FADE_IN_SEC = 0.005;
/** 声のあと、これ以上黙ってから出た短い音は雑音として削る（秒） */
const STRAY_GAP_SEC = 0.6;
/** 雑音とみなす短い音の長さの上限（秒） */
const STRAY_MAX_SEC = 0.35;
/** 声のあと、これ以上黙ってから出た「ザーッ」という音（声らしくない音）は長くても削る（秒） */
const NOISE_GAP_SEC = 0.25;
/** 声らしくない音とみなす、波が 0 をまたぐ割合（ザーッという音は高い。声の母音は低い） */
const NOISE_ZCR = 0.3;
/** 声のあと、これより小さい音（声の大きさに対する割合）は長くても削る */
const QUIET_RATIO = 0.2;

/**
 * 作った音声（16bit PCM）の終わりを整える。
 *
 * Gemini TTS は、読み終わったあとに短い雑音（息・ノイズ）を出すことがある。
 * - 声が終わってから長く黙ったあとに出る短い音は、雑音として削る
 * - 声の終わりから少しだけ余韻を残して、あとの無音・小さな雑音を削る
 * - 最後を短くフェードアウトさせ、最初を短くフェードインさせる（プツッという音を消す）
 */
export function cleanSpeechPcm(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const count = Math.floor(pcm.byteLength / 2);
  if (count === 0) return pcm;
  const view = new DataView(pcm.buffer, pcm.byteOffset, count * 2);
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i++) samples[i] = view.getInt16(i * 2, true);

  // 区切りごとの音量（RMS）
  const frame = Math.max(1, Math.round(FRAME_SEC * sampleRate));
  const frames = Math.ceil(count / frame);
  const rms = new Float32Array(frames);
  let peak = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const end = Math.min(count, (f + 1) * frame);
    for (let i = f * frame; i < end; i++) sum += samples[i] * samples[i];
    rms[f] = Math.sqrt(sum / Math.max(1, end - f * frame));
    if (rms[f] > peak) peak = rms[f];
  }
  if (peak === 0) return pcm;
  // 声とみなす大きさ（いちばん大きいところの 1 割、ただし小さすぎない）
  const threshold = Math.max(peak * 0.1, 200);
  const voiced = (f: number) => rms[f] >= threshold;

  // 最後の声の区切りを探す
  let last = frames - 1;
  while (last >= 0 && !voiced(last)) last--;
  if (last < 0) return pcm;

  // 区切りごとの「波が 0 をまたぐ割合」（ザーッという雑音は高い）
  const zcr = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let cross = 0;
    const end = Math.min(count, (f + 1) * frame);
    for (let i = f * frame + 1; i < end; i++) if ((samples[i - 1] < 0) !== (samples[i] < 0)) cross++;
    zcr[f] = cross / Math.max(1, end - f * frame - 1);
  }
  // 声の大きさの目安（声の区切りの音量の中央値）
  const voicedRms = Array.from(rms).filter((v) => v >= threshold).sort((a, b) => a - b);
  const speechLevel = voicedRms[Math.floor(voicedRms.length / 2)] || peak;

  // 最後のかたまりが雑音なら外す（雑音が続くこともあるので、声に当たるまで繰り返す）
  const gapFrames = Math.round(STRAY_GAP_SEC / FRAME_SEC);
  const strayFrames = Math.round(STRAY_MAX_SEC / FRAME_SEC);
  const noiseGapFrames = Math.round(NOISE_GAP_SEC / FRAME_SEC);
  for (;;) {
    let start = last;
    while (start > 0 && voiced(start - 1)) start--;
    let before = start - 1;
    while (before >= 0 && !voiced(before)) before--;
    if (before < 0) break;
    const gap = start - before - 1;
    const len = last - start + 1;
    let zSum = 0;
    let rSum = 0;
    for (let f = start; f <= last; f++) { zSum += zcr[f]; rSum += rms[f]; }
    const noisy = zSum / len >= NOISE_ZCR;
    const quiet = rSum / len < speechLevel * QUIET_RATIO;
    const stray = len <= strayFrames && gap >= gapFrames;
    if (stray || (gap >= noiseGapFrames && (noisy || quiet))) last = before;
    else break;
  }

  const endSample = Math.min(count, (last + 1) * frame + Math.round(TAIL_KEEP_SEC * sampleRate));
  const out = samples.slice(0, endSample);
  const fadeOut = Math.min(out.length, Math.round(FADE_OUT_SEC * sampleRate));
  for (let i = 0; i < fadeOut; i++) {
    const idx = out.length - fadeOut + i;
    out[idx] = Math.round(out[idx] * (1 - (i + 1) / fadeOut));
  }
  const fadeIn = Math.min(out.length, Math.round(FADE_IN_SEC * sampleRate));
  for (let i = 0; i < fadeIn; i++) out[i] = Math.round(out[i] * (i / fadeIn));

  const bytes = new Uint8Array(out.length * 2);
  const w = new DataView(bytes.buffer);
  for (let i = 0; i < out.length; i++) w.setInt16(i * 2, out[i], true);
  return bytes;
}

/**
 * 日本語読み上げ用のテキスト前処理
 * - 誤読されやすい漢字を読み仮名に置換
 * - 句読点の後にスペースを入れて間を明確化
 */
export function normalizeJapaneseForTts(text: string): string {
  return text
    // 読み間違いされやすい単語をひらがなに寄せる
    .replace(/荷降ろし/g, 'におろし')
    .replace(/荷下ろし/g, 'におろし')
    .replace(/荷卸し/g, 'におろし')
    .replace(/荷降し/g, 'におろし')
    // 句読点で明確に間を空ける（半角スペース挿入で TTS の休止を誘発）
    .replace(/、/g, '、 ')
    .replace(/。/g, '。 ')
    .replace(/や /g, 'や、 ')
    .replace(/\s+/g, ' ')
    .trim();
}
