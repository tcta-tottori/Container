'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * パレット数のタップ操作。
 * - 1回タップ  → 減らす
 * - 2回タップ  → 増やす（元の枚数を超えないように増減側で制限している）
 *
 * 2回目が来るかどうかを見てから減らす必要があるので、
 * 1回タップの処理は DOUBLE_TAP_MS だけ待ってから実行する。
 */
const DOUBLE_TAP_MS = 260;

export function usePalletTap(onSingle?: () => void, onDouble?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 最新のコールバックを参照するだけなので、返す関数の同一性は保つ
  const singleRef = useRef(onSingle);
  const doubleRef = useRef(onDouble);
  singleRef.current = onSingle;
  doubleRef.current = onDouble;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback(() => {
    if (timer.current) {
      // 待っている間に2回目が来た → 増やす（減らす方は取り消す）
      clearTimeout(timer.current);
      timer.current = null;
      doubleRef.current?.();
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      singleRef.current?.();
    }, DOUBLE_TAP_MS);
  }, []);
}
