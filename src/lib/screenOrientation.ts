'use client';

/**
 * 画面の向きの扱い
 * ------------------------------------------------------------------
 * 既定は「端末にしたがう」。
 * 端末の自動回転がオフなら、ブラウザ自体が回らないのでアプリも縦のまま。
 * オンなら横にすると横向きで表示される。
 *
 * 現場で寝かせて置くと勝手に回って困る、という場合のために
 * アプリ側で「縦向きで固定」も選べるようにしてある。
 *
 * ※ 向きの固定（screen.orientation.lock）は、インストール済み PWA や
 *   全画面のときだけ効く。効かない環境向けに、スマホの横画面では
 *   「縦にしてください」の案内をかぶせる（OrientationGuard）。
 */

/** 'device' = 端末の自動回転にしたがう / 'portrait' = 縦向きで固定 */
export type OrientationMode = 'device' | 'portrait';

const STORAGE_KEY = 'cns-screen-orientation';

type Listener = (mode: OrientationMode) => void;
const listeners = new Set<Listener>();

export function getOrientationMode(): OrientationMode {
  if (typeof window === 'undefined') return 'device';
  return localStorage.getItem(STORAGE_KEY) === 'portrait' ? 'portrait' : 'device';
}

export function setOrientationMode(mode: OrientationMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, mode);
  applyOrientationMode(mode);
  listeners.forEach((fn) => fn(mode));
}

/** 設定が変わったら教える。戻り値を呼ぶと解除 */
export function subscribeOrientationMode(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 向きの固定を端末へ反映する（対応していない環境では何も起きない） */
export function applyOrientationMode(mode: OrientationMode): void {
  if (typeof window === 'undefined') return;
  const so = window.screen?.orientation as
    (ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void }) | undefined;
  if (!so) return;
  try {
    if (mode === 'portrait') {
      // 全画面でないと失敗するが、失敗しても案内表示があるので無視してよい
      void so.lock?.('portrait').catch(() => { /* 非対応 */ });
    } else {
      so.unlock?.();
    }
  } catch {
    /* 非対応 */
  }
}
