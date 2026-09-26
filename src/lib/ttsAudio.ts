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
