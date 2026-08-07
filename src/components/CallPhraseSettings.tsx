'use client';

import { useState } from 'react';
import { loadCallPhrases, saveCallPhrases, DEFAULT_CALL_PHRASES, isTenMinCheerEnabled, setTenMinCheerEnabled } from '@/lib/callPhrases';

interface CallPhraseSettingsProps {
  onTest?: (phrase: string) => void;
}

/**
 * 応援コール・定期コールのフレーズを編集する設定セクション。
 * 設定ページ（SettingsPage）のタブとして表示する。
 */
export default function CallPhraseSettings({ onTest }: CallPhraseSettingsProps) {
  const [phrases, setPhrases] = useState<string[]>(() => loadCallPhrases());
  const [newPhrase, setNewPhrase] = useState('');
  const [tenMinCheer, setTenMinCheer] = useState<boolean>(() => isTenMinCheerEnabled());

  const toggleTenMinCheer = () => {
    const next = !tenMinCheer;
    setTenMinCheer(next);
    setTenMinCheerEnabled(next);
  };

  const persist = (next: string[]) => {
    setPhrases(next);
    saveCallPhrases(next);
  };

  const updateAt = (idx: number, value: string) => {
    const next = [...phrases];
    next[idx] = value;
    setPhrases(next);
  };

  const commitAt = (idx: number) => {
    // 空になった行は削除、それ以外は保存
    const next = phrases.filter((s, i) => i !== idx || s.trim().length > 0);
    persist(next);
  };

  const removeAt = (idx: number) => {
    persist(phrases.filter((_, i) => i !== idx));
  };

  const addPhrase = () => {
    const v = newPhrase.trim();
    if (!v) return;
    persist([...phrases, v]);
    setNewPhrase('');
  };

  const resetDefaults = () => {
    persist([...DEFAULT_CALL_PHRASES]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
        応援コールボタンと10分ごとの定期コールで読み上げる内容です。追加・変更・削除できます。
      </div>

      {/* 10分ごとのコールの応援 ON/OFF */}
      <div
        onClick={toggleTenMinCheer}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '12px 14px', marginBottom: 16, borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>10分ごとのコールで応援する</div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>
            オフの場合は経過時間・気温のみをコールします
          </div>
        </div>
        {/* トグルスイッチ */}
        <div style={{
          width: 48, height: 28, borderRadius: 999, flexShrink: 0,
          background: tenMinCheer ? 'linear-gradient(135deg, #8b5cf6, #4a6ef7)' : 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.15)', position: 'relative',
          transition: 'background 0.15s ease',
        }}>
          <div style={{
            position: 'absolute', top: 2, left: tenMinCheer ? 22 : 2,
            width: 22, height: 22, borderRadius: '50%', background: '#fff',
            transition: 'left 0.15s ease',
          }} />
        </div>
      </div>

      {/* フレーズ一覧 */}
      <div style={{ display: 'grid', gap: 8 }}>
        {phrases.length === 0 && (
          <div style={{ color: '#facc15', fontSize: 13, padding: '8px 0' }}>
            コールが登録されていません。下から追加してください。
          </div>
        )}
        {phrases.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              value={p}
              onChange={(e) => updateAt(i, e.target.value)}
              onBlur={() => commitAt(i)}
              style={{
                flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 14, outline: 'none',
              }}
            />
            {onTest && (
              <button
                onClick={() => onTest(p)}
                title="試聴"
                style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(167,139,250,0.35)',
                  color: '#c4b5fd', fontSize: 15, cursor: 'pointer',
                }}
              >
                ▶
              </button>
            )}
            <button
              onClick={() => removeAt(i)}
              title="削除"
              style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontSize: 18, cursor: 'pointer', lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 追加 */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <input
          type="text"
          value={newPhrase}
          onChange={(e) => setNewPhrase(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addPhrase(); }}
          placeholder="新しいコールを入力"
          style={{
            flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 10,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontSize: 14, outline: 'none',
          }}
        />
        <button
          onClick={addPhrase}
          style={{
            padding: '11px 18px', borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(74,110,247,0.3))',
            border: '1px solid rgba(167,139,250,0.5)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          追加
        </button>
      </div>

      {/* 初期値に戻す */}
      <button
        onClick={resetDefaults}
        style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#94a3b8', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        初期値に戻す
      </button>
    </div>
  );
}
