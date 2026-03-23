'use client';

interface VoiceFeedbackProps {
  transcript: string | null;
  isListening: boolean;
}

export default function VoiceFeedback({
  transcript,
  isListening,
}: VoiceFeedbackProps) {
  if (!transcript && !isListening) return null;

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      {transcript && (
        <div className="bg-black/80 text-white text-sm px-4 py-2 rounded-full animate-pulse">
          🎤 {transcript}
        </div>
      )}
      {isListening && !transcript && (
        <div className="bg-red-600/80 text-white text-xs px-3 py-1 rounded-full">
          🎤 音声認識中...
        </div>
      )}
    </div>
  );
}
