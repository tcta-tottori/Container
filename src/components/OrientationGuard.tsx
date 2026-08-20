'use client';

import { useEffect, useState } from 'react';
import {
  OrientationMode, applyOrientationMode, getOrientationMode, subscribeOrientationMode,
} from '@/lib/screenOrientation';

/**
 * 画面の向きのガード。
 *
 * 「端末にしたがう」ときは何もしない（自動回転の設定どおりに回る）。
 * 「縦向きで固定」のときだけ、向きを固定したうえで、
 * 固定できない環境ではスマホの横画面に「縦にしてください」の案内をかぶせる。
 */
export default function OrientationGuard() {
  // SSR と初期描画をそろえるため、設定の読み出しはマウント後に行う
  const [mode, setMode] = useState<OrientationMode>('device');

  useEffect(() => {
    const current = getOrientationMode();
    setMode(current);
    applyOrientationMode(current);
    return subscribeOrientationMode(setMode);
  }, []);

  if (mode !== 'portrait') return null;

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
      <div className="rotate-guard-sub">設定で「端末にしたがう」に変えられます</div>
    </div>
  );
}
