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

    // パレットと端数の読み上げ（小数点がある場合は切り上げ）
    const fractionCeil = item.fraction % 1 !== 0 ? Math.ceil(item.fraction) : item.fraction;
    let qtyText = '';
    if (item.palletCount > 0 && fractionCeil > 0) {
      qtyText = `${item.palletCount}パレットと${fractionCeil}ケース`;
    } else if (item.palletCount > 0) {
      qtyText = `${item.palletCount}パレット`;
    } else if (fractionCeil > 0) {
      qtyText = `${fractionCeil}ケース`;
    } else {
      qtyText = `${item.totalQty}個`;
    }

    let text = `${spokenName}。${qtyText}。`;

    // ポリカバーは検査で1ケース抜く（端数から1引く）
    if (isPolycover) {
      const afterInspection = fractionCeil - 1;
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
        const colorItems = similarItems.filter(s => getSimilarityReason(item.itemName, s.itemName) === 'color');
        const nameItems = similarItems.filter(s => getSimilarityReason(item.itemName, s.itemName) === 'name');

        if (colorItems.length > 0) {
          // 色違い: 「色違いの黒(白)が○パレット○ケースあります」形式
          const descs = colorItems.map(s => {
            const color = extractColor(s.itemName) || '他色';
            const fractionCeil = s.fraction % 1 !== 0 ? Math.ceil(s.fraction) : s.fraction;
            let qty = '';
            if (s.palletCount > 0 && fractionCeil > 0) {
              qty = `${s.palletCount}パレット${fractionCeil}ケース`;
            } else if (s.palletCount > 0) {
              qty = `${s.palletCount}パレット`;
            } else if (fractionCeil > 0) {
              qty = `${fractionCeil}ケース`;
            }
            return qty ? `色違いの${color}が${qty}あります` : `色違いの${color}があります`;
          }).join('。');
          text += `注意、${descs}。`;
        }

        if (nameItems.length > 0) {
          // 異なる文字だけを抽出して読み上げ
          const descs = nameItems.map(s => {
            const base1 = item.itemName.replace(/\([^)]*\)/g, '').replace(/ポリカバー/g, '').trim();
            const base2 = s.itemName.replace(/\([^)]*\)/g, '').replace(/ポリカバー/g, '').trim();
            // 1文字違いの箇所を特定
            let diffChar = '';
            if (base1.length === base2.length) {
              for (let i = 0; i < base1.length; i++) {
                if (base1[i] !== base2[i]) { diffChar = base2[i]; break; }
              }
            } else {
              const longer = base1.length > base2.length ? base2 : base1;
              const shorter = base1.length > base2.length ? base1 : base2;
              for (let i = 0; i < longer.length; i++) {
                if (i >= shorter.length || longer[i] !== shorter[i]) { diffChar = longer[i]; break; }
              }
            }
            const label = diffChar || itemNameForSpeech(s.itemName);
            const fractionCeil = s.fraction % 1 !== 0 ? Math.ceil(s.fraction) : s.fraction;
            let qty = '';
            if (s.palletCount > 0 && fractionCeil > 0) {
              qty = `${s.palletCount}パレット${fractionCeil}ケース`;
            } else if (s.palletCount > 0) {
              qty = `${s.palletCount}パレット`;
            } else if (fractionCeil > 0) {
              qty = `${fractionCeil}ケース`;
            }
            return qty ? `${label}が${qty}` : label;
          }).join('、');
          text += `注意、品名違いで${descs}あります。`;
        }
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

  /** コンテナ概要アナウンス（読み込み時・手動コール用）
   *  completedIds / elapsedSeconds を渡すと進捗情報も読み上げる */
  const announceContainerSummary = useCallback((
    items: ContainerItem[],
    ...rest: [string, Set<string>?, number?]
  ) => {
    const completedIds = rest[1];
    if (items.length === 0) return;

    const done = completedIds ? items.filter((it) => completedIds.has(it.id)).length : 0;
    const remaining = items.length - done;
    const pct = items.length > 0 ? Math.round(done / items.length * 100) : 0;

    // 種類別カウント（残りのみ）
    const typeCounts: Record<string, number> = {};
    const totalTypeCounts: Record<string, number> = {};
    const similarPairs: string[] = [];

    for (const it of items) {
      totalTypeCounts[it.type] = (totalTypeCounts[it.type] || 0) + 1;
      if (!completedIds || !completedIds.has(it.id)) {
        typeCounts[it.type] = (typeCounts[it.type] || 0) + 1;
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

    // === 開始コール（挨拶なし、コンテナ番号なし） ===
    const isResume = completedIds && done > 0;
    let text = isResume
      ? '続きです。'
      : '荷降ろしを開始します。';

    // === 内容物コール: 「〇〇がN種類」形式 ===
    const typeLabels: [string, string][] = [
      ['ポリカバー', 'ポリカバー'],
      ['ジャーポット', 'ジャーポット'],
      ['箱', '箱'],
      ['部品', '部品'],
      ['鍋', '鍋'],
      ['ヤーマン部品', 'ヤーマン部品'],
      ['その他', 'その他'],
    ];
    for (const [typeKey, label] of typeLabels) {
      const count = totalTypeCounts[typeKey];
      if (count) text += `${label}が${count}種類。`;
    }

    // === 進捗情報（再開時） ===
    if (isResume) {
      text += `進捗${pct}パーセント、残り${remaining}品。`;
    }

    // === 類似品警告: 種類単位で短くコール ===
    if (similarPairs.length > 0) {
      // 類似品がある種類を収集
      const warnedTypes = new Set<string>();
      for (const a of items) {
        for (const b of items) {
          if (a.id >= b.id) continue;
          if (areSimilarItems(a.itemName, b.itemName)) {
            warnedTypes.add(a.type);
          }
        }
      }
      for (const t of Array.from(warnedTypes)) {
        text += `${t}に類似品があります。`;
      }
    }

    if (completedIds && remaining === 0) {
      text += '全品目完了です。';
    }

    text += 'よろしくお願いします。';

    speak(text);
  }, []);

  /** 進捗状況アナウンス（完了率・残りCBM等） */
  /** 進捗コール: 進捗率 + 種類別残りのみ */
  const announceProgress = useCallback((items: ContainerItem[], completedIds: Set<string>) => {
    const total = items.length;
    const done = items.filter((it) => completedIds.has(it.id)).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    let text = `進捗${pct}パーセント。`;

    // 種類別残り
    const typeCounts: Record<string, number> = {};
    for (const it of items) {
      if (!completedIds.has(it.id)) {
        typeCounts[it.type] = (typeCounts[it.type] || 0) + 1;
      }
    }
    const parts: string[] = [];
    for (const [t, c] of Object.entries(typeCounts)) {
      parts.push(`${t}が${c}種類`);
    }
    if (parts.length > 0) text += parts.join('、') + '。';

    speak(text);
  }, []);

  /** OK確認アナウンス（残りパレット+端数のみ） */
  const announceOk = useCallback((_itemName: string, remainingPallets: number, fractionCases?: number) => {
    if (remainingPallets <= 0 && (!fractionCases || fractionCases <= 0)) {
      speak('完了。');
    } else if (remainingPallets > 0 && fractionCases && fractionCases > 0) {
      speak(`残り${remainingPallets}パレットと${fractionCases}ケース。`);
    } else if (remainingPallets > 0) {
      speak(`残り${remainingPallets}パレット。`);
    } else if (fractionCases && fractionCases > 0) {
      speak(`残り${fractionCases}ケース。`);
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
