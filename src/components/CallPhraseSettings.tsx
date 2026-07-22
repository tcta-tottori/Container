'use client';

import { useState } from 'react';
import { loadCallPhrases, saveCallPhrases, DEFAULT_CALL_PHRASES } from '@/lib/callPhrases';

interface CallPhraseSettingsProps {
  onClose: () => void;
  onTest?: (phrase: string) => void;
}

/** 応援コール・定期コールのフレーズを編集する設定メニュー */
export default function CallPhraseSettings({ onClose, onTest }: CallPhraseSettingsProps) {
  const [phrases, setPhrases] = useState<string[]>(() => loadCallPhrases());
  const [newPhrase, setNewPhrase] = useState('');

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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 210,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.18s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #0c0a1d 0%, #141028 50%, #0e1225 100%)',
          border: '1.5px solid rgba(255,255,255,0.15)',
          borderRadius: 20, padding: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          width: '100%', maxWidth: 420,
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ヘッダー */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6, paddingBottom: 10,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>📣 コール設定</div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>
          応援コールボタンと10分ごとの定期コールで読み上げる内容です。追加・変更・削除できます。
        </div>

        {/* フレーズ一覧 */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'grid', gap: 8 }}>
          {phrases.length === 0 && (
            <div style={{ color: '#facc15', fontSize: 12, padding: '8px 0' }}>
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
                  flex: 1, padding: '9px 11px', borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 13, outline: 'none',
                }}
              />
              {onTest && (
                <button
                  onClick={() => onTest(p)}
                  title="試聴"
                  style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(167,139,250,0.35)',
                    color: '#c4b5fd', fontSize: 14, cursor: 'pointer',
                  }}
                >
                  ▶
                </button>
              )}
              <button
                onClick={() => removeAt(i)}
                title="削除"
                style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171', fontSize: 16, cursor: 'pointer', lineHeight: 1,
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
              flex: 1, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={addPhrase}
            style={{
              padding: '10px 16px', borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(74,110,247,0.3))',
              border: '1px solid rgba(167,139,250,0.5)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            追加
          </button>
        </div>

        {/* 初期値に戻す */}
        <button
          onClick={resetDefaults}
          style={{
            marginTop: 10, padding: '9px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#94a3b8', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          初期値に戻す
        </button>
      </div>
    </div>
  );
}
