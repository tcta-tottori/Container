'use client';

/**
 * 音声コールの設定。
 *
 * コールは端末の音声（Web Speech API）だけで読み上げる。
 * 以前は Gemini TTS（通信して作る AI の声）も選べたが、通信を挟むと安定しないため廃止した。
 * 設定ページの「音声・コール」から、声・速さ・高さ・音量を調整する。
 * 値は localStorage（`cns_voice_settings`）に JSON で保存する。
 */

const STORAGE_KEY = 'cns_voice_settings';

/** 話す速さの範囲 */
export const MIN_RATE = 0.6;
export const MAX_RATE = 1.6;
/** 声の高さの範囲（端末の音声が受け付けるのは 0〜2） */
export const MIN_PITCH = 0.5;
export const MAX_PITCH = 2.0;

export interface VoiceSettings {
  /** 話す速さ（0.6〜1.6） */
  rate: number;
  /** 声の高さ（0.5〜2.0）。1.0 がその声そのまま */
  pitch: number;
  /** 音量（0〜1）。端末の音声は仕様上 1.0 が上限 */
  volume: number;
  /**
   * 使う声。`SpeechSynthesisVoice.voiceURI`。
   * アプリ版では端末が持っている日本語の声（Google の高品質な声など）から選べる。
   * 空なら端末にいちばん良い声を選ばせる。
   */
  webVoice: string;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  webVoice: '',
};

function clamp(v: number, lo: number, hi: number, fallback: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

/** 保存された値をそろえる（以前の形式の `main.rate` なども読む） */
function normalize(raw: unknown): VoiceSettings {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const legacyMain = (p.main && typeof p.main === 'object' ? p.main : {}) as Record<string, unknown>;
  const rate = Number(p.rate ?? legacyMain.rate ?? DEFAULT_VOICE_SETTINGS.rate);
  const pitch = Number(p.pitch ?? legacyMain.pitch ?? DEFAULT_VOICE_SETTINGS.pitch);
  return {
    rate: clamp(rate, MIN_RATE, MAX_RATE, DEFAULT_VOICE_SETTINGS.rate),
    pitch: clamp(pitch, MIN_PITCH, MAX_PITCH, DEFAULT_VOICE_SETTINGS.pitch),
    volume: clamp(Number(p.volume ?? 1), 0, 1, 1),
    webVoice: typeof p.webVoice === 'string' ? p.webVoice : '',
  };
}

let _cache: VoiceSettings | null = null;
const _listeners = new Set<(s: VoiceSettings) => void>();

/**
 * Gemini TTS を使っていたころに端末へ取っておいた音声を消す（もう使わないので場所を空ける）。
 * 1 回だけ試す。無ければ何も起きない。
 */
function removeOldSpeechCache(): void {
  try { window.indexedDB?.deleteDatabase('cns-speech'); } catch { /* ignore */ }
}

export function getVoiceSettings(): VoiceSettings {
  if (_cache) return _cache;
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS;
  removeOldSpeechCache();
  let parsed: unknown = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  _cache = normalize(parsed);
  return _cache;
}

export function saveVoiceSettings(next: VoiceSettings): void {
  _cache = normalize(next);
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache)); } catch { /* ignore */ }
  }
  _listeners.forEach((fn) => fn(_cache!));
}

/** 設定変更の購読（設定ページで変えたら即コールに反映される） */
export function subscribeVoiceSettings(fn: (s: VoiceSettings) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/**
 * 端末の音声で読み上げる発話を作る（声・速さ・高さ・音量をそろえる）。
 * コールと設定画面の試聴で同じものを使う。
 */
export function buildUtterance(text: string, settings: VoiceSettings): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = Math.min(2, Math.max(0.5, settings.rate * 1.1));
  u.pitch = Math.min(2, Math.max(0, settings.pitch));
  u.volume = Math.min(1, Math.max(0, settings.volume));
  // 設定で選ばれている声を優先。無ければ日本語の声のいちばん最初（端末が良い順に並べている）
  const voices = window.speechSynthesis.getVoices();
  const wanted = settings.webVoice ? voices.find((v) => v.voiceURI === settings.webVoice) : undefined;
  const ja = wanted || voices.find((v) => v.lang.toLowerCase().startsWith('ja'));
  if (ja) u.voice = ja;
  return u;
}
