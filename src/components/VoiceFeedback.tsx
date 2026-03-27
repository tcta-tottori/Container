'use client';

interface VoiceFeedbackProps {
  transcript: string | null;
  isListening: boolean;
}

export default function VoiceFeedback({ transcript }: VoiceFeedbackProps) {
  if (!transcript) return null;

  return (
    <div className="voice-feedback-float" style={{
      position: 'fixed', bottom: 24, zIndex: 99,
      pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'fadeIn 0.2s ease both',
    }}>
      <div style={{
        padding: '6px 16px', borderRadius: 20,
        background: 'rgba(10,8,20,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#fff', fontSize: 13, fontWeight: 500,
        textShadow: '0 0 6px rgba(255,255,255,0.3)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        maxWidth: '60vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {transcript}
      </div>
    </div>
  );
}
