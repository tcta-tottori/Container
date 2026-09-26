'use client';

import { useEffect, useRef, useState } from 'react';
import { usePalletTap } from '@/hooks/usePalletTap';
import {
  Person,
  PERSON_DISMISS_MS,
  PERSON_FADE_IN_MS,
  PERSON_FADE_OUT_MS,
  PERSON_RETURN_MS,
  PERSON_TOTAL_MS,
} from '@/lib/people';

interface PersonAppearanceProps {
  /** 出す人 */
  person: Person;
  /** 常時表示。10 秒で消えず、ずっと居る */
  always?: boolean;
  /** 消えきったときに呼ぶ（親が片付ける） */
  onDone: () => void;
}

/**
 * 人物出現。
 *
 * 一覧のところ（縦向きなら画面の下半分、横向きなら右半分）に、
 * 3 秒かけてゆっくり現れる。
 *
 * - ふつう（10 秒表示） … しばらく居て、3 秒かけてゆっくり消える。
 *   ダブルタップすると、そこで切り上げてすっと消える。
 * - 常時表示 … 消えずにずっと居る。1 回タップすると消えて一覧が見えるようになり、
 *   数秒たつとまた出てくる。ダブルタップで常時表示をやめる。
 */
export default function PersonAppearance({ person, always = false, onDone }: PersonAppearanceProps) {
  /**
   * 'in'      … 出ている（現れる動きも含む）
   * 'out'     … 10 秒たってゆっくり消えている
   * 'dismiss' … タップですっと消えている
   * 'hidden'  … 常時表示でタップされて、いま消えている（数秒したらまた 'in' へ）
   */
  const [phase, setPhase] = useState<'in' | 'out' | 'dismiss' | 'hidden'>('in');

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  // 時間切れとダブルタップの両方から呼ばれるので、1 回だけ効かせる
  const endedRef = useRef(false);
  const finish = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    onDoneRef.current();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // タップの動き（消す・また出す・片付ける）に使う待ち時間
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => clearTimers, []);

  // 出す人が変わったとき、表示のしかたが変わったときは、はじめから数え直す
  useEffect(() => {
    clearTimers();
    endedRef.current = false;
    setPhase('in');
    // 常時表示は自分からは終わらない
    if (always) return;
    const toOut = setTimeout(
      () => setPhase('out'),
      Math.max(0, PERSON_TOTAL_MS - PERSON_FADE_OUT_MS),
    );
    const toEnd = setTimeout(() => finishRef.current(), PERSON_TOTAL_MS);
    return () => { clearTimeout(toOut); clearTimeout(toEnd); };
  }, [person.id, always]);

  /** 1 回タップ … 常時表示のときだけ、いったん消えて数秒でまた出てくる */
  const handleSingle = () => {
    if (!always || phase !== 'in') return;
    clearTimers();
    setPhase('dismiss');
    later(PERSON_DISMISS_MS, () => setPhase('hidden'));
    later(PERSON_DISMISS_MS + PERSON_RETURN_MS, () => setPhase('in'));
  };

  /** 2 回タップ … 切り上げる（常時表示はここでやめる） */
  const handleDouble = () => {
    if (endedRef.current) return;
    clearTimers();
    setPhase('dismiss');
    later(PERSON_DISMISS_MS, () => finishRef.current());
  };

  const handleTap = usePalletTap(handleSingle, handleDouble);

  return (
    <div
      className={`person-appear person-appear-${phase}`}
      style={{
        '--person-in-ms': `${PERSON_FADE_IN_MS}ms`,
        '--person-out-ms': `${PERSON_FADE_OUT_MS}ms`,
        '--person-dismiss-ms': `${PERSON_DISMISS_MS}ms`,
      } as React.CSSProperties}
      onClick={handleTap}
      role="presentation"
    >
      {/* 写真。まわりは透かして、暗がりから浮かび上がるように見せる */}
      <img className="person-appear-photo" src={person.image} alt={person.name} draggable={false} />
      <div className="person-appear-name">{person.name}</div>
    </div>
  );
}
