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

/**
 * 試行するモデルの優先順位リスト。
 * 最初のモデルで 4xx エラーが出た場合、次のモデルを試す（初回の一度だけ）。
 * 成功したモデルは WORKING_MODEL_STORAGE にキャッシュして以降再利用する。
 */
const TTS_MODEL_FALLBACKS = [
  'gemini-3.1-flash-preview-tts',
  'gemini-3.0-flash-preview-tts',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
];

const WORKING_MODEL_STORAGE = 'cns_gemini_tts_working_model';

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

/** 指定モデルで 1 回だけ TTS リクエストを投げる。失敗は throw。 */
async function requestTtsOnce(
  apiKey: string,
  model: string,
  voice: string,
  styledText: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ parts: [{ text: styledText }] }],
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
    signal,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Gemini TTS エラー (${res.status}): ${errText.slice(0, 200)}`);
    // モデル未対応系のエラー (400, 404) はフォールバック対象
    (err as Error & { status?: number }).status = res.status;
    throw err;
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

/**
 * Gemini TTS で音声を生成する。
 * モデル未対応時は自動で次のモデルにフォールバックし、成功したモデルをキャッシュ。
 */
export async function geminiGenerateSpeech(
  text: string,
  options?: { voice?: string; model?: string; signal?: AbortSignal },
): Promise<Blob> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API キーが設定されていません');

  const voice = options?.voice || getSelectedVoice();

  // 日本語として自然に、句読点でしっかり間を空けて読ませるためのスタイル指示を付与
  const normalized = normalizeJapaneseForTts(text);
  const styled = `次の日本語を、句読点(、や。)で自然に間を空けて、はっきりと読み上げてください: ${normalized}`;

  // 試行順: 明示指定 > キャッシュ済み動作モデル > ユーザー設定 > デフォルト > フォールバックチェーン
  const cachedWorking = typeof window !== 'undefined' ? localStorage.getItem(WORKING_MODEL_STORAGE) : null;
  const userModel = getGeminiTtsModel();
  const explicit = options?.model;
  const order: string[] = [];
  if (explicit) order.push(explicit);
  if (cachedWorking && !order.includes(cachedWorking)) order.push(cachedWorking);
  if (userModel && !order.includes(userModel)) order.push(userModel);
  for (const m of TTS_MODEL_FALLBACKS) {
    if (!order.includes(m)) order.push(m);
  }

  let lastErr: Error | null = null;
  for (const model of order) {
    try {
      const blob = await requestTtsOnce(apiKey, model, voice, styled, options?.signal);
      // 成功したモデルを記憶して次回以降の試行を省略
      if (typeof window !== 'undefined') {
        localStorage.setItem(WORKING_MODEL_STORAGE, model);
      }
      return blob;
    } catch (e) {
      const err = e as Error & { status?: number };
      if (options?.signal?.aborted) throw err;
      // 4xx のみ次のモデルにフォールバック（ネットワーク/5xx は即時失敗）
      if (err.status && err.status >= 400 && err.status < 500) {
        console.warn(`[Gemini TTS] ${model} 失敗 (${err.status})、次モデルを試行`);
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Gemini TTS: 利用可能なモデルが見つかりません');
}
