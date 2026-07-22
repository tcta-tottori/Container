'use client';

/**
 * コールフレーズ管理
 * - 応援コールボタン（📣）と10分ごとの定期コールで使用するフレーズを一元管理する。
 * - 内容はユーザーが設定メニューから変更・追加でき、localStorage に保存される。
 */

const STORAGE_KEY = 'cns_call_phrases';

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

/** ランダムにコールフレーズを1つ返す */
export function getRandomCallPhrase(): string {
  const phrases = loadCallPhrases();
  if (phrases.length === 0) return DEFAULT_CALL_PHRASES[0];
  return phrases[Math.floor(Math.random() * phrases.length)];
}
