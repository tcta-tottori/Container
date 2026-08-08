'use client';

/**
 * せせらぎモードの表示設定。
 */

const WATER_FX_KEY = 'cns_river_waterfx';

/**
 * 品目情報が水面から出入りするときに、水越しに見える歪み（SVG フィルタ）を掛けるか。
 * 未設定のときは掛ける。
 */
export function isRiverWaterFxEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(WATER_FX_KEY) !== '0';
}

export function setRiverWaterFxEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WATER_FX_KEY, on ? '1' : '0');
}
