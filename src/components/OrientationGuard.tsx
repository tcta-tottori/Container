'use client';

import { useEffect } from 'react';

/** 画面の向きを固定できる端末では縦にロックする（対応していなければ何もしない） */
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/**
 * スマホの横画面表示をやめるためのガード。
 *
 * - インストール済み PWA では manifest の `orientation: portrait` が効く。
 * - ブラウザ表示では向きを固定できないので、スマホサイズの横画面のときだけ
 *   「縦にしてください」の案内を全画面でかぶせる（タブレット・PC の横画面は今までどおり）。
 */
export default function OrientationGuard() {
  useEffect(() => {
    const so = window.screen?.orientation as LockableOrientation | undefined;
    // 全画面（PWA）でないと失敗するが、失敗しても案内表示があるので無視してよい
    void so?.lock?.('portrait').catch(() => { /* 非対応 */ });
  }, []);

  return (
    <div className="rotate-guard" role="alert">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* 縦向きのスマホと、左まわりに回す矢印 */}
        <rect x="10.5" y="3" width="7.5" height="18" rx="2" />
        <path d="M14.2 18.3h.01" />
        <path d="M5 15.2A7.6 7.6 0 0 1 8.6 4.6" />
        <polyline points="5.9 4.1 8.8 4.5 8.4 7.4" />
      </svg>
      <div className="rotate-guard-title">画面を縦にしてください</div>
      <div className="rotate-guard-sub">このアプリは縦画面で使います</div>
    </div>
  );
}
