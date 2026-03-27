'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { matchVoiceCommand, VoiceAction } from '@/lib/speechCommands';

interface UseSpeechRecognitionProps {
  onCommand: (action: VoiceAction, transcript: string) => void;
}

export function useSpeechRecognition({ onCommand }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ブラウザ対応チェック
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SR);
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setLastTranscript(null);
    }, 2000);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || typeof window === 'undefined') return;

    const SR =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;

      // アナウンス中は認識結果を無視（ループ防止）
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
        return;
      }

      const transcript = last[0].transcript;
      setLastTranscript(transcript);
      clearToast();

      const action = matchVoiceCommand(transcript);
      if (action) {
        onCommand(action, transcript);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      // no-speech は無視（騒音環境では頻発）
      if (event.error === 'no-speech') return;
      console.warn('SpeechRecognition error:', event.error);
    };

    recognition.onend = () => {
      // continuous でも自動停止する場合があるので再開
      if (recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          // already started
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, onCommand, clearToast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any).stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setLastTranscript(null);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (recognitionRef.current as any).stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    lastTranscript,
    toggleListening,
  };
}
