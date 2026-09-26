'use client';

import { useState } from 'react';
import { isTenMinClimateEnabled, setTenMinClimateEnabled } from '@/lib/callPhrases';

/**
 * 10分ごとの定期コールの設定。
 * 設定ページ（SettingsPage）の「音声・コール」に表示する。
 */
export default function CallPhraseSettings() {
  const [tenMinClimate, setTenMinClimate] = useState<boolean>(() => isTenMinClimateEnabled());

  const toggleTenMinClimate = () => {
    const next = !tenMinClimate;
    setTenMinClimate(next);
    setTenMinClimateEnabled(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 10分ごとのコールの気温・湿度 ON/OFF（既定はオフ） */}
      <div
        onClick={toggleTenMinClimate}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>10分ごとのコールで気温・湿度も伝える</div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>
            既定はオフ。気温・湿度は天気ボタン・気温コールで確認できます
          </div>
        </div>
        <div style={{
          width: 48, height: 28, borderRadius: 999, flexShrink: 0,
          background: tenMinClimate ? 'linear-gradient(135deg, #8b5cf6, #4a6ef7)' : 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.15)', position: 'relative',
          transition: 'background 0.15s ease',
        }}>
          <div style={{
            position: 'absolute', top: 2, left: tenMinClimate ? 22 : 2,
            width: 22, height: 22, borderRadius: '50%', background: '#fff',
            transition: 'left 0.15s ease',
          }} />
        </div>
      </div>
    </div>
  );
}
