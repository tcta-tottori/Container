'use client';

interface ActionBarProps {
  onPrev: () => void;
  onNext: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  onAnnounce: () => void;
  onComplete: () => void;
  hasItems: boolean;
  isListening?: boolean;
  isVoiceSupported?: boolean;
  onToggleVoice?: () => void;
}

export default function ActionBar({
  onPrev,
  onNext,
  onIncrease,
  onDecrease,
  onAnnounce,
  onComplete,
  hasItems,
  isListening = false,
  isVoiceSupported = false,
  onToggleVoice,
}: ActionBarProps) {
  return (
    <div className="action-bar">
      <button
        onClick={onPrev}
        disabled={!hasItems}
        className="action-btn"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--text-primary)',
        }}
        title="前"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      <button
        onClick={onIncrease}
        disabled={!hasItems}
        className="action-btn"
        style={{
          background: 'rgba(59,130,246,0.15)',
          border: '1px solid rgba(59,130,246,0.25)',
          color: '#60a5fa',
        }}
        title="パレット+1"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <button
        onClick={onAnnounce}
        disabled={!hasItems}
        className="action-btn"
        style={{
          background: 'rgba(34,197,94,0.15)',
          border: '1px solid rgba(34,197,94,0.25)',
          color: '#4ade80',
        }}
        title="読上げ"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>

      {/* 音声認識ボタン */}
      {isVoiceSupported && onToggleVoice && (
        <button
          onClick={onToggleVoice}
          className={`action-btn ${isListening ? 'listening-pulse' : ''}`}
          style={{
            background: isListening
              ? 'rgba(239,68,68,0.2)'
              : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isListening ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: isListening ? '#f87171' : 'var(--text-secondary)',
          }}
          title={isListening ? '音声認識 停止' : '音声認識 開始'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
      )}

      <button
        onClick={onDecrease}
        disabled={!hasItems}
        className="action-btn"
        style={{
          background: 'rgba(59,130,246,0.15)',
          border: '1px solid rgba(59,130,246,0.25)',
          color: '#60a5fa',
        }}
        title="パレット-1"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <button
        onClick={onComplete}
        disabled={!hasItems}
        className="action-btn"
        style={{
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.25)',
          color: '#f87171',
        }}
        title="完了"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>

      <button
        onClick={onNext}
        disabled={!hasItems}
        className="action-btn"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--text-primary)',
        }}
        title="次"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  );
}
