'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ContainerItem } from '@/lib/types';
import { itemNameForSpeech, areSimilarItems } from '@/lib/typeDetector';

function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 1.1;
  u.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find((v) => v.lang.startsWith('ja'));
  if (jaVoice) u.voice = jaVoice;
  window.speechSynthesis.speak(u);
}

export function useSpeech() {
  const voicesLoaded = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const handleVoices = () => {
      voicesLoaded.current = true;
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoices);
    window.speechSynthesis.getVoices();
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
    };
  }, []);

  const announceItem = useCallback((item: ContainerItem, allItems?: ContainerItem[]) => {
    const spokenName = itemNameForSpeech(item.itemName);
    const isPolycover = item.type === 'ポリカバー';

    // パレットと端数の読み上げ
    let qtyText = '';
    if (item.palletCount > 0 && item.fraction > 0) {
      qtyText = `${item.palletCount}パレットと${item.fraction}ケース`;
    } else if (item.palletCount > 0) {
      qtyText = `${item.palletCount}パレット`;
    } else if (item.fraction > 0) {
      qtyText = `${item.fraction}ケース`;
    } else {
      qtyText = `${item.totalQty}個`;
    }

    let text = `${spokenName}。${qtyText}。`;

    // ポリカバーは検査で1ケース抜く
    if (isPolycover) {
      const totalCases = item.palletCount * item.qtyPerPallet + item.fraction;
      const afterInspection = totalCases - 1;
      if (afterInspection >= 0) {
        text += `検査を抜いて${afterInspection}ケース。`;
      }
    }

    // 似た名前のアイテムがある場合に警告
    if (allItems && allItems.length > 0) {
      const similarItems = allItems.filter(
        (other) => other.id !== item.id && areSimilarItems(item.itemName, other.itemName)
      );
      if (similarItems.length > 0) {
        const names = similarItems.map((s) => {
          return itemNameForSpeech(s.itemName);
        }).join('、');
        text += `注意、類似品があります。${names}。`;
      }
    }

    speak(text);
  }, []);

  const announcePalletChange = useCallback(
    (newPallet: number) => {
      speak(`パレット${newPallet}。`);
    },
    []
  );

  const announceComplete = useCallback((itemName: string) => {
    speak(`${itemNameForSpeech(itemName)}、完了。`);
  }, []);

  const announceAllComplete = useCallback(() => {
    speak('全品目の荷降ろしが完了しました。お疲れ様でした。');
  }, []);

  const announceRemaining = useCallback((count: number) => {
    speak(`残り${count}品目です。`);
  }, []);

  return {
    speak,
    announceItem,
    announcePalletChange,
    announceComplete,
    announceAllComplete,
    announceRemaining,
  };
}
