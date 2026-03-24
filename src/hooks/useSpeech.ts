'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ContainerItem } from '@/lib/types';
import { itemNameForSpeech, areSimilarItems, getSimilarityReason, extractColor } from '@/lib/typeDetector';

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
        const descs = similarItems.map((s) => {
          const reason = getSimilarityReason(item.itemName, s.itemName);
          const name = itemNameForSpeech(s.itemName);
          if (reason === 'color') {
            const c = extractColor(s.itemName);
            return c ? `${name}、色違い${c}` : `${name}、色違い`;
          }
          return `${name}、品名類似`;
        }).join('。');
        text += `注意、類似品があります。${descs}。`;
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

  /** コンテナ概要アナウンス（読み込み時・手動コール用） */
  const announceContainerSummary = useCallback((items: ContainerItem[], containerNo: string) => {
    if (items.length === 0) return;

    // 種類別カウント
    const typeCounts: Record<string, number> = {};
    let hasJarPot = false;
    const similarPairs: string[] = [];

    for (const it of items) {
      typeCounts[it.type] = (typeCounts[it.type] || 0) + 1;
      if (/^JP[A-Z]/.test(it.itemName) || it.itemName.includes('ジャーポット')) {
        hasJarPot = true;
      }
    }

    // 類似品チェック
    const checked = new Set<string>();
    for (const a of items) {
      for (const b of items) {
        if (a.id >= b.id) continue;
        const key = `${a.id}:${b.id}`;
        if (checked.has(key)) continue;
        checked.add(key);
        if (areSimilarItems(a.itemName, b.itemName)) {
          const nameA = itemNameForSpeech(a.itemName);
          const nameB = itemNameForSpeech(b.itemName);
          similarPairs.push(`${nameA}と${nameB}`);
        }
      }
    }

    let text = `コンテナ${containerNo}。合計${items.length}品目。`;

    // 種類内訳
    const typeNames: string[] = [];
    if (typeCounts['ポリカバー']) typeNames.push(`ポリカバー${typeCounts['ポリカバー']}品`);
    if (typeCounts['箱']) typeNames.push(`箱${typeCounts['箱']}品`);
    if (typeCounts['部品']) typeNames.push(`部品${typeCounts['部品']}品`);
    if (typeCounts['鍋']) typeNames.push(`鍋${typeCounts['鍋']}品`);
    if (typeCounts['その他']) typeNames.push(`その他${typeCounts['その他']}品`);
    if (typeNames.length > 0) {
      text += typeNames.join('、') + '。';
    }

    if (hasJarPot) {
      text += 'ジャーポットあり。';
    }

    if (similarPairs.length > 0) {
      text += `注意、類似品が${similarPairs.length}組あります。`;
      if (similarPairs.length <= 3) {
        text += similarPairs.join('、') + '。';
      }
    }

    text += '作業を開始します。';
    speak(text);
  }, []);

  /** 進捗状況アナウンス（完了率・残りCBM等） */
  const announceProgress = useCallback((items: ContainerItem[], completedIds: Set<string>) => {
    const total = items.length;
    const done = items.filter((it) => completedIds.has(it.id)).length;
    const remaining = total - done;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    let text = `進捗${pct}パーセント。${done}品目完了、残り${remaining}品目。`;

    // CBM情報があれば残り容積もアナウンス
    let totalCbm = 0, remainCbm = 0;
    for (const it of items) {
      if (it.cbm) {
        const vol = it.cbm * (it.caseCount || 1);
        totalCbm += vol;
        if (!completedIds.has(it.id)) remainCbm += vol;
      }
    }
    if (totalCbm > 0) {
      text += `残り容積約${remainCbm.toFixed(1)}立方メートル。`;
    }

    // 種類別残り
    const typeCounts: Record<string, number> = {};
    for (const it of items) {
      if (!completedIds.has(it.id)) {
        typeCounts[it.type] = (typeCounts[it.type] || 0) + 1;
      }
    }
    const parts: string[] = [];
    if (typeCounts['ポリカバー']) parts.push(`ポリカバー${typeCounts['ポリカバー']}`);
    if (typeCounts['箱']) parts.push(`箱${typeCounts['箱']}`);
    if (typeCounts['部品']) parts.push(`部品${typeCounts['部品']}`);
    if (typeCounts['鍋']) parts.push(`鍋${typeCounts['鍋']}`);
    if (typeCounts['その他']) parts.push(`その他${typeCounts['その他']}`);
    if (parts.length > 0) {
      text += `内訳、${parts.join('、')}。`;
    }

    if (remaining === 0) {
      text += '全品目完了です。お疲れ様でした。';
    } else if (pct >= 75) {
      text += 'もう少しです、頑張りましょう。';
    }

    speak(text);
  }, []);

  /** OK確認アナウンス */
  const announceOk = useCallback((itemName: string, remainingPallets: number) => {
    if (remainingPallets > 0) {
      speak(`OK。${itemNameForSpeech(itemName)}、残り${remainingPallets}パレット。`);
    } else {
      speak(`OK。${itemNameForSpeech(itemName)}、完了。`);
    }
  }, []);

  return {
    speak,
    announceItem,
    announcePalletChange,
    announceComplete,
    announceAllComplete,
    announceRemaining,
    announceContainerSummary,
    announceOk,
    announceProgress,
  };
}
