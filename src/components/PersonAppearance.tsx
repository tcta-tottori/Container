'use client';

import { useEffect, useRef, useState } from 'react';
import { usePalletTap } from '@/hooks/usePalletTap';
import {
  Person,
  PERSON_DISMISS_MS,
  PERSON_FADE_IN_MS,
  PERSON_FADE_OUT_MS,
  PERSON_TOTAL_MS,
} from '@/lib/people';

interface PersonAppearanceProps {
  /** 出す人 */
  person: Person;
  /** 消えきったときに呼ぶ（親が片付ける） */
  onDone: () => void;
}

/**
 * 人物出現。
 *
 * 一覧のところ（縦向きなら画面の下半分、横向きなら右半分）に、
 * 3 秒かけてゆっくり現れ、しばらく居て、3 秒かけてゆっくり消える（ぜんぶで 10 秒）。
 * ダブルタップすると、そこで切り上げてすっと消える。
 */
export default function PersonAppearance({ person, onDone }: PersonAppearanceProps) {
  /** 'in' 現れる → 'out' ゆっくり消える / 'dismiss' ダブルタップで急いで消える */
  const [phase, setPhase] = useState<'in' | 'out' | 'dismiss'>('in');

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  // 10 秒たったときと、ダブルタップしたときの両方から呼ばれるので、1 回だけ効かせる
  const endedRef = useRef(false);
  const finish = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    onDoneRef.current();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // 出す人が変わったら、はじめから数え直す
  useEffect(() => {
    endedRef.current = false;
    setPhase('in');
    const toOut = setTimeout(
      () => setPhase('out'),
      Math.max(0, PERSON_TOTAL_MS - PERSON_FADE_OUT_MS),
    );
    const toEnd = setTimeout(() => finishRef.current(), PERSON_TOTAL_MS);
    return () => { clearTimeout(toOut); clearTimeout(toEnd); };
  }, [person.id]);

  // ダブルタップで切り上げる。消える見た目を見せてから片付ける
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); }, []);
  const handleTap = usePalletTap(undefined, () => {
    if (dismissTimer.current) return;
    setPhase('dismiss');
    dismissTimer.current = setTimeout(() => finishRef.current(), PERSON_DISMISS_MS);
  });

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
