'use client';

import { useState, useEffect, useCallback } from 'react';

/** 経過時間を MM:SS 形式で返すフック */
export function useTimer(startTime: number | null) {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (startTime === null) {
      setElapsed('00:00');
      return;
    }

    const update = () => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsed(`${m}:${s}`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  return elapsed;
}

/** 現在時刻を HH:MM 形式で返すフック */
export function useClock() {
  const format = useCallback(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, []);

  const [time, setTime] = useState(format);

  useEffect(() => {
    const id = setInterval(() => setTime(format()), 60000);
    return () => clearInterval(id);
  }, [format]);

  return time;
}
