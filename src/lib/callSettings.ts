/**
 * コール設定（ユーザーがカスタマイズ可能な設定）
 *
 * 以下を localStorage に保存し、UI から追加・変更できるようにする：
 *  - 応援コール（コールボタン）のフレーズ
 *  - 10分コールのフレーズ
 *  - ボイスの種類（Gemini プリセット以外のカスタムボイス追加）
 *  - コール別のボイス割当（応援コール／10分コール）
 *
 * 未設定時は cheerPhrases.ts / geminiTts.ts のデフォルトにフォールバックする。
 */

import { CHEER_PHRASES as DEFAULT_CHEER_PHRASES, TAUNT_PHRASES as DEFAULT_TAUNT_PHRASES } from './cheerPhrases';
import { GEMINI_VOICES, type GeminiVoice } from './geminiTts';

const K_CHEER = 'cns_cheer_phrases';
const K_TAUNT = 'cns_taunt_phrases';
const K_CUSTOM_VOICES = 'cns_custom_voices';
const K_CHEER_VOICE = 'cns_cheer_voice';
const K_TAUNT_VOICE = 'cns_taunt_voice';

/** 10分コールのデフォルトボイス（明るく元気な女性） */
export const DEFAULT_TAUNT_VOICE = 'Zephyr';

/** 設定変更を UI に通知するための購読機構 */
const _listeners = new Set<() => void>();
export function subscribeCallSettings(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
function notify(): void {
  _listeners.forEach((fn) => fn());
}

function readList(key: string, fallback: string[]): string[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) return arr;
  } catch { /* ignore */ }
  return fallback;
}

function writeList(key: string, list: string[]): void {
  if (typeof window === 'undefined') return;
  const cleaned = list.map((s) => s.trim()).filter(Boolean);
  localStorage.setItem(key, JSON.stringify(cleaned));
  notify();
}

// ── 応援コール（コールボタン）フレーズ ──────────────────────────
export function getCheerPhrases(): string[] {
  return readList(K_CHEER, DEFAULT_CHEER_PHRASES);
}
export function setCheerPhrases(list: string[]): void {
  writeList(K_CHEER, list);
}
export function resetCheerPhrases(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(K_CHEER);
  notify();
}

// ── 10分コールフレーズ ──────────────────────────────────────
export function getTauntPhrases(): string[] {
  return readList(K_TAUNT, DEFAULT_TAUNT_PHRASES);
}
export function setTauntPhrases(list: string[]): void {
  writeList(K_TAUNT, list);
}
export function resetTauntPhrases(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(K_TAUNT);
  notify();
}

/** ランダムに応援フレーズを1つ返す（空なら空文字） */
export function getRandomCheer(): string {
  const list = getCheerPhrases();
  return list.length ? list[Math.floor(Math.random() * list.length)] : '';
}

/** ランダムにあおりフレーズを1つ返す（空なら空文字） */
export function getRandomTaunt(): string {
  const list = getTauntPhrases();
  return list.length ? list[Math.floor(Math.random() * list.length)] : '';
}

// ── カスタムボイス ─────────────────────────────────────────
export function getCustomVoices(): GeminiVoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(K_CUSTOM_VOICES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr
        .filter((v) => v && typeof v.id === 'string' && v.id.trim())
        .map((v) => ({
          id: String(v.id).trim(),
          label: String(v.label || v.id).trim(),
          desc: String(v.desc || 'カスタムボイス').trim(),
        }));
    }
  } catch { /* ignore */ }
  return [];
}
export function setCustomVoices(voices: GeminiVoice[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(K_CUSTOM_VOICES, JSON.stringify(voices));
  notify();
}

/** 組込みボイス + カスタムボイス（id 重複はカスタム優先） */
export function getAllVoices(): GeminiVoice[] {
  const custom = getCustomVoices();
  const customIds = new Set(custom.map((v) => v.id));
  const builtin = GEMINI_VOICES.filter((v) => !customIds.has(v.id));
  return [...builtin, ...custom];
}

// ── コール別ボイス割当 ─────────────────────────────────────
/** 10分コールのボイス（デフォルト Zephyr） */
export function getTauntVoice(): string {
  if (typeof window === 'undefined') return DEFAULT_TAUNT_VOICE;
  return localStorage.getItem(K_TAUNT_VOICE) || DEFAULT_TAUNT_VOICE;
}
export function setTauntVoice(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(K_TAUNT_VOICE, id);
  notify();
}

/** 応援コールのボイス（null = マイクで選択中の声を使う） */
export function getCheerVoice(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(K_CHEER_VOICE) || null;
}
export function setCheerVoice(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (!id) localStorage.removeItem(K_CHEER_VOICE);
  else localStorage.setItem(K_CHEER_VOICE, id);
  notify();
}
