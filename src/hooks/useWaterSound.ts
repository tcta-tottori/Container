'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getWaterSoundEngine,
  isWaterAutoStartEnabled,
  setWaterAutoStartEnabled,
} from '@/lib/waterSound';

/** 水の音BGMの状態をReactに橋渡しするフック */
export function useWaterSound() {
  const engine = getWaterSoundEngine();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(0.4);
  const [fadeSeconds, setFadeState] = useState(3);
  const [autoStart, setAutoStartState] = useState(false);
  // SSR とクライアントで初期描画をそろえるため、対応判定はマウント後に行う
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported(engine.isSupported());
    const sync = () => {
      setPlaying(engine.isPlaying());
      setLoading(engine.isLoading());
      setError(engine.getError());
      setVolumeState(engine.getVolume());
      setFadeState(engine.getFadeSeconds());
    };
    sync();
    setAutoStartState(isWaterAutoStartEnabled());
    return engine.subscribe(sync);
  }, [engine]);

  const toggle = useCallback(() => { engine.toggle(); }, [engine]);
  const stop = useCallback(() => { engine.stop(); }, [engine]);
  const setVolume = useCallback((v: number) => { engine.setVolume(v); }, [engine]);
  const setFadeSeconds = useCallback((s: number) => { engine.setFadeSeconds(s); }, [engine]);
  const setAutoStart = useCallback((on: boolean) => {
    setWaterAutoStartEnabled(on);
    setAutoStartState(on);
  }, []);

  return {
    playing,
    loading,
    error,
    volume,
    fadeSeconds,
    autoStart,
    isSupported,
    toggle,
    stop,
    setVolume,
    setFadeSeconds,
    setAutoStart,
  };
}
