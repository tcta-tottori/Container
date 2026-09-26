'use client';

/**
 * コールの文言と、10分ごとの定期コールの設定。
 */

const TENMIN_CLIMATE_KEY = 'cns_call_10min_climate';

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
