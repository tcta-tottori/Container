/**
 * Google Gemini TTS (Text-to-Speech) クライアント
 *
 * Gemini TTS モデルで音声合成を行う。API キーは geminiApi.ts と共有（localStorage）。
 * 話者・トーン・速さなどの設定は voiceSettings.ts が持つ。
 */

import { getGeminiKey } from './geminiApi';
import { getVoiceSettings, styleInstruction } from './voiceSettings';

/** 直近の TTS エラーメッセージ（UI 表示用） */
let _lastTtsError: string | null = null;
const _errorListeners = new Set<(msg: string | null) => void>();

export function getLastTtsError(): string | null {
  return _lastTtsError;
}

export function setLastTtsError(msg: string | null): void {
  _lastTtsError = msg;
  _errorListeners.forEach((fn) => fn(msg));
}

export function subscribeTtsError(fn: (msg: string | null) => void): () => void {
  _errorListeners.add(fn);
  return () => { _errorListeners.delete(fn); };
}

/** base64 文字列を Uint8Array にデコード */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** PCM (L16, mono) を WAV に変換 */
function pcmToWavBlob(pcm: Uint8Array, sampleRate: number): Blob {
  const byteLen = pcm.byteLength;
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
  new Uint8Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}

/** mimeType から sample rate を抽出（audio/L16;codec=pcm;rate=24000） */
function parseSampleRate(mimeType: string): number {
  const m = /rate=(\d+)/.exec(mimeType);
  return m ? parseInt(m[1], 10) : 24000;
}

/**
 * 日本語読み上げ用のテキスト前処理
 * - 誤読されやすい漢字を読み仮名に置換
 * - 句読点の後にスペースを入れて間を明確化
 */
function normalizeJapaneseForTts(text: string): string {
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

/**
 * Gemini TTS で音声を生成する。
 * 話者・トーン・モデルは設定ページの内容（voiceSettings）を既定値として使う。
 */
export async function geminiGenerateSpeech(
  text: string,
  options?: { voice?: string; model?: string; signal?: AbortSignal; stylePrefix?: string },
): Promise<Blob> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API キーが設定されていません');

  const settings = getVoiceSettings();
  const voice = options?.voice || settings.main.voice;
  const model = options?.model || settings.model;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // スタイル指示は最小限にして生成時間を短縮（句読点のスペース挿入で間は十分確保）
  const normalized = normalizeJapaneseForTts(text);
  const stylePrefix = options?.stylePrefix || styleInstruction(settings.main);
  const styled = `${stylePrefix}: ${normalized}`;

  const body = {
    contents: [{ parts: [{ text: styled }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const msg = `モデル「${model}」エラー (HTTP ${res.status}): ${errText.slice(0, 160)}`;
    setLastTtsError(msg);
    throw new Error(msg);
  }

  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0];
  const inline = part?.inlineData || part?.inline_data;
  const b64 = inline?.data;
  const mime = inline?.mimeType || inline?.mime_type || 'audio/L16;codec=pcm;rate=24000';

  if (!b64) {
    const msg = `モデル「${model}」: 音声データが返ってきません`;
    setLastTtsError(msg);
    throw new Error(msg);
  }

  setLastTtsError(null); // 成功時はエラーをクリア
  const pcm = base64ToUint8Array(b64);
  const sampleRate = parseSampleRate(mime);
  return pcmToWavBlob(pcm, sampleRate);
}
