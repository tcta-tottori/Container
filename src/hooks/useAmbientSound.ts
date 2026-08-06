'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AmbientTrackId,
  getAmbientEngine,
  isAmbientAutoStartEnabled,
  setAmbientAutoStartEnabled,
} from '@/lib/ambientSound';

/** 環境音BGMエンジンの状態をReactに橋渡しするフック */
export function useAmbientSound() {
  const engine = getAmbientEngine();
  const [activeIds, setActiveIds] = useState<AmbientTrackId[]>([]);
  const [volume, setVolumeState] = useState(0.35);
  const [fadeSeconds, setFadeState] = useState(3);
  const [autoStart, setAutoStartState] = useState(false);
  // SSR とクライアントで初期描画をそろえるため、対応判定はマウント後に行う
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported(engine.isSupported());
    const sync = () => {
      setActiveIds(engine.getActiveIds());
      setVolumeState(engine.getVolume());
      setFadeState(engine.getFadeSeconds());
    };
    sync();
    setAutoStartState(isAmbientAutoStartEnabled());
    return engine.subscribe(sync);
  }, [engine]);

  const toggle = useCallback((id: AmbientTrackId) => { engine.toggle(id); }, [engine]);
  const stopAll = useCallback(() => { engine.stopAll(); }, [engine]);
  const setVolume = useCallback((v: number) => { engine.setVolume(v); }, [engine]);
  const setFadeSeconds = useCallback((s: number) => { engine.setFadeSeconds(s); }, [engine]);
  const setAutoStart = useCallback((on: boolean) => {
    setAmbientAutoStartEnabled(on);
    setAutoStartState(on);
  }, []);

  return {
    activeIds,
    isPlaying: activeIds.length > 0,
    volume,
    fadeSeconds,
    autoStart,
    isSupported,
    toggle,
    stopAll,
    setVolume,
    setFadeSeconds,
    setAutoStart,
  };
}
