'use client';

import { useEffect, useState } from 'react';
import { DrumSerif, loadDrumSerifs, spokenText } from '@/lib/drumCall';
import { getVoiceSettings } from '@/lib/voiceSettings';
import { ChatIcon, CloseIcon, SettingsIcon } from '@/components/AppIcons';

interface DrumPadProps {
  /** ドラムの声で話す。鳴り終わったら onDone を呼ぶ */
  onSpeak: (text: string, onDone?: () => void) => void;
  onClose: () => void;
  /** 設定（音声・コール）を開く。セリフの編集はそこで行う */
  onOpenSettings?: () => void;
}

/**
 * ドラムパッド。
 *
 * VIVANT のドラムがスマホの読み上げアプリで話すように、
 * セリフのボタンを押すか、打った文を「話す」で読み上げる
 * （参考: ヒヨプロ「Flutter で VIVANT のドラムが使用するアプリを再現してみた」。
 *   セリフのボタン＋自由入力、声の高さと速さを固定、という作り）。
 * 声はいつも設定の「ドラム」の声。
 */
export default function DrumPad({ onSpeak, onClose, onOpenSettings }: DrumPadProps) {
  const [serifs, setSerifs] = useState<DrumSerif[]>([]);
  const [text, setText] = useState('');
  /** いま話しているボタン（押した表示用）。自由入力は -1 */
  const [speaking, setSpeaking] = useState<number | null>(null);

  useEffect(() => { setSerifs(loadDrumSerifs()); }, []);

  // Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const say = (value: string, idx: number) => {
    const v = value.trim();
    if (!v) return;
    setSpeaking(idx);
    onSpeak(v, () => setSpeaking((cur) => (cur === idx ? null : cur)));
  };

  const drum = getVoiceSettings().drum;
  const preview = text.trim() ? spokenText(text.trim(), drum) : '';

  return (
    <div className="quick-overlay" onClick={onClose}>
      <div className="quick-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">🥁</span>
          <span style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: 800 }}>ドラムパッド</span>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="quick-side-btn"
              aria-label="ドラムの声とセリフの設定"
              title="ドラムの声とセリフの設定"
            >
              <SettingsIcon size={18} />
            </button>
          )}
          <button onClick={onClose} className="quick-side-btn" aria-label="閉じる" title="閉じる">
            <CloseIcon size={18} />
          </button>
        </div>

        {/* スマホの画面に出る文字のように、いま話している／これから話す文を見せる */}
        <div style={{
          minHeight: 54, padding: '12px 14px', borderRadius: 14,
          background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#e2e8f0', fontSize: 16, fontWeight: 700, lineHeight: 1.5,
          display: 'flex', alignItems: 'center',
        }}>
          {speaking !== null && speaking >= 0
            ? spokenText(serifs[speaking]?.text || '', drum)
            : preview || <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>ボタンを押すか、文を打って「話す」</span>}
        </div>

        {/* セリフのボタン */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {serifs.map((s, i) => {
            const active = speaking === i;
            return (
              <button
                key={`${i}-${s.label}`}
                onClick={() => say(s.text, i)}
                style={{
                  padding: '14px 10px', borderRadius: 14, minHeight: 56,
                  background: active ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${active ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  wordBreak: 'break-all',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* 自由入力 */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') say(text, -1); }}
            placeholder="話したいことを入力"
            style={{
              flex: 1, minWidth: 0, padding: '12px 13px', borderRadius: 12,
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff', fontSize: 15, outline: 'none',
            }}
          />
          <button
            onClick={() => say(text, -1)}
            disabled={!text.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '0 16px', borderRadius: 12, flexShrink: 0,
              background: speaking === -1 ? 'rgba(251,191,36,0.3)' : 'rgba(139,92,246,0.3)',
              border: '1px solid rgba(167,139,250,0.5)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: text.trim() ? 'pointer' : 'default', opacity: text.trim() ? 1 : 0.5,
            }}
          >
            <ChatIcon size={16} />
            話す
          </button>
        </div>
      </div>
    </div>
  );
}
