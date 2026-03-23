'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ContainerItem } from '@/lib/types';
import { itemNameForSpeech, areSimilarItems, extractColor } from '@/lib/typeDetector';

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

    let text = `${spokenName}。パレット${item.palletCount}枚、端数${item.fraction}ケース、総数${item.totalQty}。`;

    // 似た名前のアイテムがある場合に警告
    if (allItems && allItems.length > 0) {
      const similarItems = allItems.filter(
        (other) => other.id !== item.id && areSimilarItems(item.itemName, other.itemName)
      );
      if (similarItems.length > 0) {
        const names = similarItems.map((s) => {
          const color = extractColor(s.itemName);
          return color ? `${itemNameForSpeech(s.itemName)}` : itemNameForSpeech(s.itemName);
        }).join('、');
        text += `注意、似た品目があります。${names}。`;
      }
    }

    speak(text);
  }, []);

  const announcePalletChange = useCallback(
    (newPallet: number, newTotal: number) => {
      speak(`パレット${newPallet}枚、総数${newTotal}。`);
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
