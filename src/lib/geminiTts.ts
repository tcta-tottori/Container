/**
 * Google Gemini TTS (Text-to-Speech) クライアント
 *
 * Gemini Flash TTS モデルで高品質な音声合成を行う。
 * API キーは geminiApi.ts と共有（localStorage）。
 * 複数の音声キャラクターを選択可能（声の種類）。
 */

import { getGeminiKey } from './geminiApi';

const VOICE_STORAGE = 'cns_gemini_voice';
const TTS_ENABLED_STORAGE = 'cns_gemini_tts_enabled';
const TTS_MODEL_STORAGE = 'cns_gemini_tts_model';

/** デフォルト TTS モデル（Flash 系） */
export const DEFAULT_GEMINI_TTS_MODEL = 'gemini-3.1-flash-preview-tts';

/** 選択可能な音声 */
export interface GeminiVoice {
  id: string;
  label: string;
  desc: string;
}

export const GEMINI_VOICES: GeminiVoice[] = [
  { id: 'Kore',       label: 'コレ',       desc: '落ち着いた女性' },
  { id: 'Aoede',      label: 'アオイデ',   desc: '爽やかな女性' },
  { id: 'Leda',       label: 'レダ',       desc: '若々しい女性' },
  { id: 'Zephyr',     label: 'ゼファー',   desc: '明るい女性' },
  { id: 'Puck',       label: 'パック',     desc: '元気な男性' },
  { id: 'Charon',     label: 'カロン',     desc: '情報的な男性' },
  { id: 'Fenrir',     label: 'フェンリル', desc: '活発な男性' },
  { id: 'Orus',       label: 'オルス',     desc: '力強い男性' },
  { id: 'Enceladus',  label: 'エンケラ',   desc: '囁くような男性' },
  { id: 'Achird',     label: 'アキルド',   desc: '親しみやすい男性' },
];

export const DEFAULT_VOICE = 'Kore';

export function getSelectedVoice(): string {
  if (typeof window === 'undefined') return DEFAULT_VOICE;
  return localStorage.getItem(VOICE_STORAGE) || DEFAULT_VOICE;
}

export function setSelectedVoice(voiceId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VOICE_STORAGE, voiceId);
}

export function getGeminiTtsModel(): string {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_TTS_MODEL;
  return localStorage.getItem(TTS_MODEL_STORAGE) || DEFAULT_GEMINI_TTS_MODEL;
}

export function setGeminiTtsModel(model: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TTS_MODEL_STORAGE, model);
}

/** Gemini TTS が利用可能か（API キーがあり、かつ明示的に無効化されていない） */
export function isGeminiTtsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (!getGeminiKey()) return false;
  return localStorage.getItem(TTS_ENABLED_STORAGE) !== '0';
}

export function setGeminiTtsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TTS_ENABLED_STORAGE, enabled ? '1' : '0');
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
 * Gemini TTS で音声を生成する（Gemini 3.1 Flash TTS 固定）
 */
export async function geminiGenerateSpeech(
  text: string,
  options?: { voice?: string; model?: string; signal?: AbortSignal },
): Promise<Blob> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API キーが設定されていません');

  const voice = options?.voice || getSelectedVoice();
  const model = options?.model || getGeminiTtsModel();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // 日本語として自然に、句読点でしっかり間を空けて読ませるためのスタイル指示を付与
  const normalized = normalizeJapaneseForTts(text);
  const styled = `次の日本語を、句読点(、や。)で自然に間を空けて、はっきりと読み上げてください: ${normalized}`;

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
    throw new Error(`Gemini TTS エラー (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0];
  const inline = part?.inlineData || part?.inline_data;
  const b64 = inline?.data;
  const mime = inline?.mimeType || inline?.mime_type || 'audio/L16;codec=pcm;rate=24000';

  if (!b64) throw new Error('Gemini TTS のレスポンスに音声データがありません');

  const pcm = base64ToUint8Array(b64);
  const sampleRate = parseSampleRate(mime);
  return pcmToWavBlob(pcm, sampleRate);
}
