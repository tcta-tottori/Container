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
  const btnClass =
    'flex items-center justify-center min-w-[48px] min-h-[48px] rounded-lg font-bold text-lg transition-colors';

  return (
    <div className="flex items-center justify-around h-14 bg-gray-800 px-2 shrink-0">
      <button
        onClick={onPrev}
        disabled={!hasItems}
        className={`${btnClass} bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-40`}
        title="前"
      >
        ◀
      </button>
      <button
        onClick={onIncrease}
        disabled={!hasItems}
        className={`${btnClass} bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40`}
        title="パレット+1"
      >
        ▲+
      </button>
      <button
        onClick={onAnnounce}
        disabled={!hasItems}
        className={`${btnClass} bg-green-700 hover:bg-green-600 text-white disabled:opacity-40`}
        title="読上げ"
      >
        🔊
      </button>

      {/* 音声認識ボタン（対応ブラウザのみ表示） */}
      {isVoiceSupported && onToggleVoice && (
        <button
          onClick={onToggleVoice}
          className={`${btnClass} ${
            isListening
              ? 'bg-red-600 hover:bg-red-500 animate-pulse'
              : 'bg-gray-700 hover:bg-gray-600'
          } text-white`}
          title={isListening ? '音声認識 停止' : '音声認識 開始'}
        >
          🎤
        </button>
      )}

      <button
        onClick={onDecrease}
        disabled={!hasItems}
        className={`${btnClass} bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40`}
        title="パレット-1"
      >
        ▼-
      </button>
      <button
        onClick={onComplete}
        disabled={!hasItems}
        className={`${btnClass} bg-red-700 hover:bg-red-600 text-white disabled:opacity-40`}
        title="完了"
      >
        ✓
      </button>
      <button
        onClick={onNext}
        disabled={!hasItems}
        className={`${btnClass} bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-40`}
        title="次"
      >
        ▶
      </button>
    </div>
  );
}
