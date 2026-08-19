'use client';

/**
 * 音声コール（TTS）の設定。
 *
 * 設定ページの「音声」タブから、使用する API・話者・トーン・速さなどをまとめて調整する。
 * 値は localStorage（`cns_voice_settings`）に JSON で保存する。
 */

import { MAX_VOLUME } from '@/lib/audioBoost';

const STORAGE_KEY = 'cns_voice_settings';

/** 旧バージョンのキー（自動移行用） */
const LEGACY_VOICE_KEY = 'cns_gemini_voice';
const LEGACY_ENABLED_KEY = 'cns_gemini_tts_enabled';
const LEGACY_MODEL_KEY = 'cns_gemini_tts_model';

/** 音声エンジン */
export type VoiceEngine = 'gemini' | 'web';

/** Gemini TTS の既定モデル */
export const DEFAULT_TTS_MODEL = 'gemini-3.1-flash-tts-preview';

/** 選択できる話者（Gemini TTS のプリセット音声） */
export interface VoiceOption {
  id: string;
  label: string;
  desc: string;
  gender: '女性' | '男性';
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'Kore',      label: 'コレ',       desc: '落ち着いた声',     gender: '女性' },
  { id: 'Aoede',     label: 'アオイデ',   desc: '爽やかな声',       gender: '女性' },
  { id: 'Leda',      label: 'レダ',       desc: '若々しい声',       gender: '女性' },
  { id: 'Zephyr',    label: 'ゼファー',   desc: '明るい声',         gender: '女性' },
  { id: 'Puck',      label: 'パック',     desc: '元気な声',         gender: '男性' },
  { id: 'Charon',    label: 'カロン',     desc: '説明向きの声',     gender: '男性' },
  { id: 'Fenrir',    label: 'フェンリル', desc: '活発な声',         gender: '男性' },
  { id: 'Orus',      label: 'オルス',     desc: '力強い声',         gender: '男性' },
  { id: 'Enceladus', label: 'エンケラ',   desc: '囁くような声',     gender: '男性' },
  { id: 'Achird',    label: 'アキルド',   desc: '親しみやすい声',   gender: '男性' },
];

/** トーン（話し方）のプリセット。自由入力でも上書きできる */
export const TONE_PRESETS: { id: string; label: string; style: string }[] = [
  { id: 'clear',   label: 'はっきり', style: 'はっきりと落ち着いて読む' },
  { id: 'calm',    label: '穏やか',   style: 'やわらかく穏やかに読む' },
  { id: 'bright',  label: '明るい',   style: '明るく元気に読む' },
  { id: 'cheer',   label: '応援',     style: '大きな声で明るく応援するように読む' },
  { id: 'urgent',  label: '急かす',   style: 'テンション高く、急かすようにあおって読む' },
  { id: 'low',     label: '低め',     style: '低めの声で落ち着いて読む' },
];

/** 1つの読み上げ役（通常コール / 応援コール）の設定 */
export interface VoiceProfile {
  /** 話者（Gemini の音声名） */
  voice: string;
  /** トーンのプリセット id（custom のときは customStyle を使う） */
  tone: string;
  /** tone が 'custom' のときの自由記述スタイル */
  customStyle: string;
  /** 話す速さ（0.6〜1.6） */
  rate: number;
  /** 声の高さ（0.6〜1.6）。Web Speech のみ数値で反映、Gemini は指示文に反映 */
  pitch: number;
}

export interface VoiceSettings {
  /** 使用する音声 API */
  engine: VoiceEngine;
  /** Gemini TTS のモデル名 */
  model: string;
  /** 通常のコール */
  main: VoiceProfile;
  /** 応援・あおりコール */
  cheer: VoiceProfile;
  /**
   * 音量（0〜3）。1.0 が端末の音量そのまま。
   * 1.0 を超える分は Web Audio のゲインで持ち上げる（`src/lib/audioBoost.ts`）。
   * 端末の音声（Web Speech API）は音を取り出せないため 1.0 が上限になる。
   */
  volume: number;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  engine: 'gemini',
  model: DEFAULT_TTS_MODEL,
  main:  { voice: 'Kore',   tone: 'clear',  customStyle: '', rate: 1.0, pitch: 1.0 },
  cheer: { voice: 'Zephyr', tone: 'cheer',  customStyle: '', rate: 1.1, pitch: 1.0 },
  volume: 1.0,
};

function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}

function normalizeProfile(p: Partial<VoiceProfile> | undefined, fallback: VoiceProfile): VoiceProfile {
  return {
    voice: typeof p?.voice === 'string' && p.voice ? p.voice : fallback.voice,
    tone: typeof p?.tone === 'string' && p.tone ? p.tone : fallback.tone,
    customStyle: typeof p?.customStyle === 'string' ? p.customStyle : '',
    rate: clamp(Number(p?.rate ?? fallback.rate), 0.6, 1.6),
    pitch: clamp(Number(p?.pitch ?? fallback.pitch), 0.6, 1.6),
  };
}

/** 旧バージョンの設定から引き継ぐ（初回のみ） */
function migrateLegacy(): Partial<VoiceSettings> {
  if (typeof window === 'undefined') return {};
  const out: Partial<VoiceSettings> = {};
  const voice = localStorage.getItem(LEGACY_VOICE_KEY);
  const enabled = localStorage.getItem(LEGACY_ENABLED_KEY);
  const model = localStorage.getItem(LEGACY_MODEL_KEY);
  if (voice) out.main = { ...DEFAULT_VOICE_SETTINGS.main, voice };
  if (enabled === '0') out.engine = 'web';
  if (model && model.includes('tts')) out.model = model;
  return out;
}

let _cache: VoiceSettings | null = null;
const _listeners = new Set<(s: VoiceSettings) => void>();

export function getVoiceSettings(): VoiceSettings {
  if (_cache) return _cache;
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS;
  let parsed: Partial<VoiceSettings> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    else parsed = migrateLegacy();
  } catch {
    parsed = {};
  }
  _cache = {
    engine: parsed.engine === 'web' ? 'web' : 'gemini',
    model: typeof parsed.model === 'string' && parsed.model ? parsed.model : DEFAULT_TTS_MODEL,
    main: normalizeProfile(parsed.main, DEFAULT_VOICE_SETTINGS.main),
    cheer: normalizeProfile(parsed.cheer, DEFAULT_VOICE_SETTINGS.cheer),
    volume: clamp(Number(parsed.volume ?? 1), 0, MAX_VOLUME),
  };
  return _cache;
}

export function saveVoiceSettings(next: VoiceSettings): void {
  _cache = {
    ...next,
    main: normalizeProfile(next.main, DEFAULT_VOICE_SETTINGS.main),
    cheer: normalizeProfile(next.cheer, DEFAULT_VOICE_SETTINGS.cheer),
    volume: clamp(Number(next.volume), 0, MAX_VOLUME),
  };
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

/** プロファイルから Gemini TTS へ渡すスタイル指示文を組み立てる */
export function styleInstruction(p: VoiceProfile): string {
  const base = p.tone === 'custom'
    ? (p.customStyle.trim() || DEFAULT_VOICE_SETTINGS.main.customStyle)
    : (TONE_PRESETS.find((t) => t.id === p.tone)?.style || 'はっきりと読む');
  const parts = [base];
  if (p.rate >= 1.25) parts.push('速めのテンポで');
  else if (p.rate <= 0.85) parts.push('ゆっくりと');
  if (p.pitch >= 1.25) parts.push('高めの声で');
  else if (p.pitch <= 0.85) parts.push('低めの声で');
  return parts.join('、');
}

/**
 * 端末の音声（Web Speech API）に渡す音量。
 * `SpeechSynthesisUtterance.volume` の上限は 1.0 で、ブースト分は反映できない。
 */
export function webSpeechVolume(settings: VoiceSettings): number {
  return Math.min(1, Math.max(0, settings.volume));
}

/** 表示用のトーン名 */
export function toneLabel(p: VoiceProfile): string {
  if (p.tone === 'custom') return p.customStyle.trim() || 'カスタム';
  return TONE_PRESETS.find((t) => t.id === p.tone)?.label || 'はっきり';
}
