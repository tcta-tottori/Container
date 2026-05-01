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
  const [isPreparingSpeech, setIsPreparingSpeech] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pausedForSpeechRef = useRef(false);
  const speakEndTimeRef = useRef<((t: number) => void) | null>(null);

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
    let speakEndTime = 0; // コール終了時刻（ガード用）

    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;

      // 音声コール中 or コール終了後3秒以内の認識結果は全て無視
      if (pausedForSpeechRef.current) return;
      if (Date.now() - speakEndTime < 3000) return;

      const transcript = last[0].transcript;
      setLastTranscript(transcript);
      clearToast();

      const action = matchVoiceCommand(transcript);
      if (action) {
        const now = Date.now();
        if (now - lastCommandTime < 3000) return;
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) return;
        lastCommandTime = now;
        onCommand(action, transcript);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === 'no-speech') return;
      console.warn('SpeechRecognition error:', event.error);
    };

    recognition.onend = () => {
      // 音声コール中は再開しない
      if (pausedForSpeechRef.current) return;
      if (recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          // already started
        }
      }
    };

    // speakEndTimeをコールバック経由で更新するためクロージャに保持
    speakEndTimeRef.current = (t: number) => { speakEndTime = t; };

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

  // 音声コール中は録音を完全停止してループ防止
  useEffect(() => {
    setSpeakCallbacks(
      (text: string) => {
        setIsSpeaking(true);
        setIsPreparingSpeech(true);
        setSpeakingText(text);
        pausedForSpeechRef.current = true;
        // 録音を完全停止（onendでの自動再開もブロック）
        if (recognitionRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          try { (recognitionRef.current as any).stop(); } catch { /* ignore */ }
          recognitionRef.current = null; // onendの自動再開を無効化
        }
      },
      () => {
        setIsSpeaking(false);
        setIsPreparingSpeech(false);
        setSpeakingText(null);
        // コール終了時刻を記録（onresultでのガード用）
        speakEndTimeRef.current?.(Date.now());
        pausedForSpeechRef.current = false;
        // 3秒待ってから録音を新規開始（エコー完全回避）
        if (isListening) {
          setTimeout(() => {
            if (!pausedForSpeechRef.current && isListening) {
              startListening();
            }
          }, 3000);
        }
      },
      () => {
        // 実際に音声が再生開始したら読込状態を解除
        setIsPreparingSpeech(false);
      },
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
    isPreparingSpeech,
    speakingText,
    isSupported,
    lastTranscript,
    toggleListening,
  };
}
