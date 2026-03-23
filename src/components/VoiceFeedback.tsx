'use client';

interface VoiceFeedbackProps {
  transcript: string | null;
  isListening: boolean;
}

export default function VoiceFeedback({ transcript, isListening }: VoiceFeedbackProps) {
  if (!transcript && !isListening) return null;

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      {transcript && (
        <div className="text-sm px-4 py-2 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
          <span style={{ color: '#dc2626', marginRight: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle' }}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            </svg>
          </span>
          {transcript}
        </div>
      )}
      {isListening && !transcript && (
        <div className="text-xs px-3 py-1.5 rounded-full listening-pulse"
          style={{
            background: 'rgba(239,68,68,0.08)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#dc2626',
          }}>
          音声認識中
        </div>
      )}
    </div>
  );
}
