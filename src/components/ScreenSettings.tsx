'use client';

import { useEffect, useState } from 'react';
import {
  OrientationMode, getOrientationMode, setOrientationMode,
} from '@/lib/screenOrientation';

const CHOICES: { id: OrientationMode; label: string; sub: string }[] = [
  { id: 'device', label: '端末にしたがう', sub: 'スマホの自動回転の設定どおりに回ります' },
  { id: 'portrait', label: '縦向きで固定', sub: '寝かせて置いても横向きになりません' },
];

/** 画面まわりの設定。いまは向き（回転）だけ */
export default function ScreenSettings() {
  // SSR と初期描画をそろえるため、読み出しはマウント後に行う
  const [mode, setMode] = useState<OrientationMode>('device');

  useEffect(() => { setMode(getOrientationMode()); }, []);

  const choose = (m: OrientationMode) => {
    setMode(m);
    setOrientationMode(m);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
        画面の向きの扱いです。ふだんは「端末にしたがう」のままで、
        スマホの自動回転をオフにしていれば縦のままになります。
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {CHOICES.map((c) => {
          const active = mode === c.id;
          return (
            <button
              key={c.id}
              onClick={() => choose(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                textAlign: 'left', padding: '13px 14px', borderRadius: 13,
                background: active ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${active ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer', transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', color: '#fff', fontSize: 14, fontWeight: 700 }}>{c.label}</span>
                <span style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginTop: 3 }}>{c.sub}</span>
              </span>
              {/* 選ばれている方に印を付ける */}
              <span style={{
                width: 22, height: 22, flexShrink: 0, borderRadius: '50%',
                border: `1.5px solid ${active ? '#8ab4ff' : 'rgba(255,255,255,0.22)'}`,
                background: active ? '#6b52d4' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 800,
              }}>
                {active ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1.6, marginTop: 14 }}>
        ※ 「縦向きで固定」は、ホーム画面から開いたとき（インストール済み）に確実に効きます。
        ブラウザのタブで開いている場合は固定できないことがあり、そのときは横向きにすると
        「画面を縦にしてください」の案内が出ます。<br />
        ※ ホーム画面のアイコンから使っている場合、この変更を反映するにはアプリを開き直してください。
      </p>
    </div>
  );
}
