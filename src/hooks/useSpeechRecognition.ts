'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { matchVoiceCommand, VoiceAction } from '@/lib/speechCommands';
import { setSpeakCallbacks } from './useSpeech';

interface UseSpeechRecognitionProps {
  onCommand: (action: VoiceAction, transcript: string) => void;
}

export function useSpeechRecognition({ onCommand }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pausedForSpeechRef = useRef(false);

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

    let lastCommandTime = 0;

    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;

      const transcript = last[0].transcript;
      setLastTranscript(transcript);
      clearToast();

      const action = matchVoiceCommand(transcript);
      if (action) {
        // ループ防止: 前回コマンドから2秒以内、またはアナウンス中はスキップ
        const now = Date.now();
        if (now - lastCommandTime < 2000) return;
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) return;
        lastCommandTime = now;
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

  // 音声コール中は録音を一時停止してループ防止
  useEffect(() => {
    setSpeakCallbacks(
      () => {
        setIsSpeaking(true);
        if (recognitionRef.current) {
          pausedForSpeechRef.current = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          try { (recognitionRef.current as any).stop(); } catch { /* ignore */ }
        }
      },
      () => {
        setIsSpeaking(false);
        if (pausedForSpeechRef.current && isListening) {
          pausedForSpeechRef.current = false;
          // 少し待ってから再開（音声出力のエコーを避ける）
          setTimeout(() => {
            if (recognitionRef.current === null && isListening) {
              startListening();
            } else if (recognitionRef.current) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              try { (recognitionRef.current as any).start(); } catch { /* already started */ }
            }
          }, 300);
        }
      }
    );
  }, [isListening, startListening]);

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
    isSpeaking,
    isSupported,
    lastTranscript,
    toggleListening,
  };
}
