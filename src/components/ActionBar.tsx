'use client';

interface ActionBarProps {
  onIncrease: () => void;
  onDecrease: () => void;
  onAnnounce: () => void;
  hasItems: boolean;
  isListening?: boolean;
  isVoiceSupported?: boolean;
  onToggleVoice?: () => void;
}

const plusStyle = { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: '#2563eb' };
const announceStyle = { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', color: '#16a34a' };

export default function ActionBar({
  onIncrease, onDecrease, onAnnounce, hasItems,
  isListening = false, isVoiceSupported = false, onToggleVoice,
}: ActionBarProps) {
  return (
    <div className="action-bar" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <button onClick={onIncrease} disabled={!hasItems} className="action-btn flex-1 max-w-[56px]" style={plusStyle} title="パレット+1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <button onClick={onAnnounce} disabled={!hasItems} className="action-btn flex-1 max-w-[56px]" style={announceStyle} title="読上げ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>

      {isVoiceSupported && onToggleVoice && (
        <button onClick={onToggleVoice}
          className={`action-btn flex-1 max-w-[56px] ${isListening ? 'listening-pulse' : ''}`}
          style={{
            background: isListening ? 'rgba(239,68,68,0.12)' : 'var(--bg-primary)',
            border: `1px solid ${isListening ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
            color: isListening ? '#dc2626' : 'var(--text-secondary)',
          }}
          title={isListening ? '音声認識 停止' : '音声認識 開始'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
      )}

      <button onClick={onDecrease} disabled={!hasItems} className="action-btn flex-1 max-w-[56px]" style={plusStyle} title="パレット-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  );
}
