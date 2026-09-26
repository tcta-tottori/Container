/**
 * Google Gemini TTS (Text-to-Speech) クライアント
 *
 * Gemini TTS モデルで音声合成を行う。API キーは geminiApi.ts と共有（localStorage）。
 * 話者・トーン・速さなどの設定は voiceSettings.ts が持つ。
 */

import { getGeminiKey } from './geminiApi';
import { getVoiceSettings, styleInstruction, LEGACY_TTS_MODEL } from './voiceSettings';
import {
  pcm16ToWavBlob, normalizeJapaneseForTts, cleanSpeechPcm, readPcm16Wav, isRiff, concatBytes,
} from './ttsAudio';
import { getCachedSpeech, putCachedSpeech, speechCacheKey } from './ttsCache';

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

/**
 * 直近に作った音声の中身（雑音などの原因を調べるため、設定画面に出す・保存できる）。
 * raw は Gemini から届いたそのままのデータ、blob は整えたあと実際に鳴らす音声。
 */
export interface LastSpeechInfo {
  model: string;
  mime: string;
  parts: number;
  bytes: number;
  raw: Uint8Array;
  blob: Blob;
  at: number;
}

let _lastSpeech: LastSpeechInfo | null = null;

function recordLastSpeech(info: Omit<LastSpeechInfo, 'at'>): void {
  _lastSpeech = { ...info, at: Date.now() };
}

/** 直近に作った音声の中身。まだ作っていなければ null（取っておいた音声を鳴らしただけのときも null） */
export function getLastSpeechInfo(): LastSpeechInfo | null {
  return _lastSpeech;
}

/** base64 文字列を Uint8Array にデコード */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** mimeType から sample rate を抽出（audio/L16;codec=pcm;rate=24000） */
function parseSampleRate(mimeType: string): number {
  const m = /rate=(\d+)/.exec(mimeType);
  return m ? parseInt(m[1], 10) : 24000;
}

/**
 * その文言・その話し方の音声を見分ける鍵を返す。
 * 「もう作ってあるか」を先に調べたいところ（まとめて作る画面）から使う。
 */
export function geminiSpeechKey(
  text: string,
  options?: { voice?: string; model?: string; stylePrefix?: string },
): string {
  const settings = getVoiceSettings();
  return speechCacheKey({
    model: options?.model || settings.model,
    voice: options?.voice || settings.main.voice,
    style: options?.stylePrefix || styleInstruction(settings.main),
    text: normalizeJapaneseForTts(text),
  });
}

/**
 * Gemini TTS で音声を生成する。
 * 話者・トーン・モデルは設定ページの内容（voiceSettings）を既定値として使う。
 *
 * 同じ「モデル・話者・話し方・文」の音声は一度作ったら端末に取っておき、
 * 次からは作らずにそれを返す（`ttsCache.ts`）。コールの文言は毎回おなじものが
 * 多いので、待ち時間も通信も API の消費も無くなる。
 *
 * @param options.skipCache 取っておいた音声を使わず、必ず作り直す（試聴のやり直しなど）
 */
export async function geminiGenerateSpeech(
  text: string,
  options?: {
    voice?: string;
    model?: string;
    signal?: AbortSignal;
    stylePrefix?: string;
    skipCache?: boolean;
  },
): Promise<Blob> {
  const settings = getVoiceSettings();
  const voice = options?.voice || settings.main.voice;
  const model = options?.model || settings.model;

  // スタイル指示は最小限にして生成時間を短縮（句読点のスペース挿入で間は十分確保）
  const normalized = normalizeJapaneseForTts(text);
  const stylePrefix = options?.stylePrefix || styleInstruction(settings.main);
  // 話し方の指示と読む文を見出しで分けて送る。
  // 「指示: 文」の形だと、長い文（ファイルを読み込んだ直後のコールなど）で
  // 指示文まで読み上げてしまうことがあるため。
  const styled = [
    '### DIRECTOR\'S NOTES',
    `話し方: ${stylePrefix}`,
    '（この指示は読み上げず、TRANSCRIPT の文だけを読む）',
    '',
    '#### TRANSCRIPT',
    normalized,
  ].join('\n');

  // 取っておいた音声があればそれを使う（API キーが無くても鳴らせる）
  const cacheKey = speechCacheKey({ model, voice, style: stylePrefix, text: normalized });
  if (!options?.skipCache) {
    const cached = await getCachedSpeech(cacheKey);
    if (cached) {
      setLastTtsError(null);
      return cached;
    }
  }

  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API キーが設定されていません');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
    // 新しいモデルがまだ使えないキー・地域では、以前のモデルで作り直す
    if (res.status === 404 && model !== LEGACY_TTS_MODEL) {
      console.warn(`モデル「${model}」が見つからないため ${LEGACY_TTS_MODEL} で作り直します`);
      return geminiGenerateSpeech(text, { ...options, model: LEGACY_TTS_MODEL });
    }
    const msg = `モデル「${model}」エラー (HTTP ${res.status}): ${errText.slice(0, 160)}`;
    setLastTtsError(msg);
    throw new Error(msg);
  }

  const data = await res.json();
  // 音声は 1 つとは限らない（長い文だと分かれて返ることがある）。ぜんぶつなげる
  const parts: { data?: string; mimeType?: string; mime_type?: string }[] =
    (data?.candidates?.[0]?.content?.parts || [])
      .map((p: { inlineData?: unknown; inline_data?: unknown }) => p?.inlineData || p?.inline_data)
      .filter((d: { data?: string } | undefined) => !!d?.data);
  const mime = parts[0]?.mimeType || parts[0]?.mime_type || 'audio/L16;codec=pcm;rate=24000';

  if (parts.length === 0) {
    const msg = `モデル「${model}」: 音声データが返ってきません`;
    setLastTtsError(msg);
    throw new Error(msg);
  }

  setLastTtsError(null); // 成功時はエラーをクリア
  const raw = concatBytes(parts.map((p) => base64ToUint8Array(p.data!)));

  let blob: Blob;
  if (/wav/i.test(mime) || isRiff(raw)) {
    // WAV（ヘッダ付き）で返ってきたら、中の PCM を取り出して整える
    const wav = readPcm16Wav(raw);
    blob = wav
      ? pcm16ToWavBlob(cleanSpeechPcm(wav.pcm, wav.sampleRate), wav.sampleRate)
      : new Blob([raw], { type: 'audio/wav' });
  } else if (/L16|pcm/i.test(mime)) {
    // 16bit PCM。読み終わりのあとの雑音を削り、最後をなめらかに終わらせる
    const sampleRate = parseSampleRate(mime);
    blob = pcm16ToWavBlob(cleanSpeechPcm(raw, sampleRate), sampleRate);
  } else {
    // mp3 など圧縮された音声は、そのまま鳴らす（PCM として包むと雑音になる）
    blob = new Blob([raw], { type: mime.split(';')[0] });
  }
  recordLastSpeech({ model, mime, parts: parts.length, bytes: raw.byteLength, raw, blob });
  // しまうのは待たない（鳴らすほうを先に進める）
  void putCachedSpeech(cacheKey, blob, normalized);
  return blob;
}
