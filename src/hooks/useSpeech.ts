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

    // ケース数ベースの読み上げ
    let qtyText = '';
    if (item.caseCount > 0) {
      qtyText = `${item.caseCount}ケース`;
      if (item.qtyPerPallet > 0) {
        const pallets = Math.floor(item.caseCount / item.qtyPerPallet);
        const frac = item.caseCount % item.qtyPerPallet;
        if (pallets > 0 && frac > 0) {
          qtyText = `${pallets}パレットと${frac}ケース`;
        } else if (pallets > 0) {
          qtyText = `${pallets}パレット`;
        }
      }
    } else {
      qtyText = `${item.totalQty}個`;
    }

    let text = `${spokenName}。${qtyText}。`;

    // ポリカバーは検査で1ケース抜く
    if (isPolycover) {
      const afterInspection = item.caseCount - 1;
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
        text += `注意、似た品目があります。${names}。`;
      }
    }

    speak(text);
  }, []);

  const announceCaseChange = useCallback(
    (newCase: number) => {
      speak(`ケース${newCase}。`);
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
    announceCaseChange,
    announceComplete,
    announceAllComplete,
    announceRemaining,
  };
}
