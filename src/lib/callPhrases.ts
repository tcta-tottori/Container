'use client';

/**
 * コールフレーズ管理
 * - 応援コールボタン（📣）と10分ごとの定期コールで使用するフレーズを一元管理する。
 * - 内容はユーザーが設定メニューから変更・追加でき、localStorage に保存される。
 */

const STORAGE_KEY = 'cns_call_phrases';
const TENMIN_CHEER_KEY = 'cns_call_10min_cheer';
const TENMIN_CLIMATE_KEY = 'cns_call_10min_climate';

/** 10分ごとのコールで応援コールを読み上げるか（デフォルト: オフ） */
export function isTenMinCheerEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(TENMIN_CHEER_KEY) === '1';
}

/** 10分ごとのコールの応援読み上げ ON/OFF を保存 */
export function setTenMinCheerEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENMIN_CHEER_KEY, on ? '1' : '0');
}

/**
 * 10分ごとのコールで気温・湿度も読み上げるか（デフォルト: オフ）。
 * 既定では「◯分経過しました」だけをコールする。
 */
export function isTenMinClimateEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(TENMIN_CLIMATE_KEY) === '1';
}

/** 10分ごとのコールの気温・湿度読み上げ ON/OFF を保存 */
export function setTenMinClimateEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENMIN_CLIMATE_KEY, on ? '1' : '0');
}

/** 合図のコール（クイックメニューの「お願いします！」・ウォッチの request） */
export const REQUEST_CALL_TEXT = 'お願いします！';

/** 名前を呼ぶ合図のコール（クイックメニュー・ウォッチの name） */
export const NAME_CALL_TEXT = '長谷川さん！お願いします！';

/** デフォルトのコールフレーズ（以前指定した固有名入りのコール） */
export const DEFAULT_CALL_PHRASES: string[] = [
  'がんばれ、まさ',
  'ファイト、まさ',
  'おせおせ、まさ',
  '部品きらすなよ、まさ',
  'おそいぞ、まさ',
  'まさ、しっかり',
  'はしれよ、まさ',
  'がんばれ、じっちゃん',
  'きんちゃん、ファイト',
];

/** 保存済みのコールフレーズを読み込む（未設定時はデフォルト） */
export function loadCallPhrases(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_CALL_PHRASES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_CALL_PHRASES];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const cleaned = arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      return cleaned.length > 0 ? cleaned : [...DEFAULT_CALL_PHRASES];
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_CALL_PHRASES];
}

/** コールフレーズを保存する（空文字は除外） */
export function saveCallPhrases(phrases: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = phrases.map((s) => s.trim()).filter((s) => s.length > 0);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    /* ignore */
  }
}

/**
 * 中身が決まっているコールの文言をぜんぶ返す（重複は除く）。
 *
 * これらは毎回おなじ文なので、一度だけ音声を作って取っておけば
 * 次からは待たずに鳴らせる（`src/lib/ttsCache.ts`）。
 * どれも「応援コール」のプロファイルで読み上げている。
 */
export function fixedCallTexts(): string[] {
  const all = [REQUEST_CALL_TEXT, NAME_CALL_TEXT, ...loadCallPhrases()];
  return Array.from(new Set(all.map((s) => s.trim()).filter((s) => s.length > 0)));
}

/** ランダムにコールフレーズを1つ返す */
export function getRandomCallPhrase(): string {
  const phrases = loadCallPhrases();
  if (phrases.length === 0) return DEFAULT_CALL_PHRASES[0];
  return phrases[Math.floor(Math.random() * phrases.length)];
}
