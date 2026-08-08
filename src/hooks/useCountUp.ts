'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * カウントアニメーション（アップ/ダウン対応）
 * - key変更: 0.4秒待機→1秒で0→targetまでカウントアップ
 * - target変更(key同一): 0.5秒で旧値→新値にスムーズ遷移（カウントダウン/アップ）
 */
export function useCountUp(target: number, key: string, freeze?: boolean): number {
  const [value, setValue] = useState(target);
  const rafRef = useRef<number>(0);
  const targetRef = useRef(target);
  const keyRef = useRef(key);
  const prevValueRef = useRef(target);

  // key が変わったとき: 0→targetへカウントアップ
  useEffect(() => {
    keyRef.current = key;
    targetRef.current = target;
    prevValueRef.current = 0;
    setValue(0);
    cancelAnimationFrame(rafRef.current);
    const startTime = performance.now() + 400;
    const duration = 1000;
    const animate = (now: number) => {
      if (now < startTime) { setValue(0); rafRef.current = requestAnimationFrame(animate); return; }
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      const t = targetRef.current;
      const v = Math.round(eased * t);
      setValue(v);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
      else { setValue(t); prevValueRef.current = t; }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // target が変わったとき（key同一 = パレット減少等）: スムーズ遷移
  useEffect(() => {
    if (keyRef.current !== key || freeze) return;
    const from = prevValueRef.current;
    const to = target;
    if (from === to) return;
    targetRef.current = to;
    cancelAnimationFrame(rafRef.current);
    const startTime = performance.now();
    const duration = 500;
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
      const v = Math.round(from + (to - from) * eased);
      setValue(v);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
      else { setValue(to); prevValueRef.current = to; }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, key]);

  return value;
}
