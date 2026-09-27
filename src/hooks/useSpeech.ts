'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ContainerItem } from '@/lib/types';
import { itemNameForSpeech, areSimilarItems } from '@/lib/typeDetector';
import { itemNameForCall } from '@/lib/partTranslations';
import { displayQuantities, quantityToSpeech } from '@/lib/itemQuantity';
import { getVoiceSettings, buildUtterance } from '@/lib/voiceSettings';

/*
 * 音声コール。端末の音声（Web Speech API）だけで読み上げる。
 * 以前は Gemini TTS（通信して作る AI の声）も使えたが、通信を挟むと安定しないため廃止した。
 */

// 音声コール開始/終了のコールバック（録音一時停止用）
let _onSpeakStart: ((text: string) => void) | null = null;
let _onSpeakEnd: (() => void) | null = null;
// 音声が実際に鳴り始めたときの通知（読込スピナー解除用）
let _onSpeakPlay: (() => void) | null = null;

export function setSpeakCallbacks(
  onStart: (text: string) => void,
  onEnd: () => void,
  onPlay?: () => void,
) {
  _onSpeakStart = onStart;
  _onSpeakEnd = onEnd;
  _onSpeakPlay = onPlay || null;
}

/**
 * いま進行中のコールの「終わったら呼ぶ」処理。
 * 鳴り終わりを待っている呼び出し元があるため、途中で止めたときも必ず呼んで待ちを解く。
 */
let _currentDone: (() => void) | null = null;

/** 現在の音声コールを全てキャンセル */
export function cancelSpeech(): void {
  if (typeof window === 'undefined') return;
  const pendingDone = _currentDone;
  _currentDone = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  _onSpeakEnd?.();
  pendingDone?.();
}

/**
 * コール。設定ページの「音声・コール」の声・速さ・高さ・音量で読み上げる。
 * onDone は鳴り終わり（または失敗・中断）で必ず1回だけ呼ばれる。
 */
function speak(text: string, onDone?: () => void): void {
  if (typeof window === 'undefined') return;

  // 前のコールを待っている人がいたら、割り込んだこの時点で終わりとして解放する
  const prevDone = _currentDone;
  _currentDone = null;
  prevDone?.();

  let called = false;
  const done = () => {
    if (called) return;
    called = true;
    if (_currentDone === done) _currentDone = null;
    _onSpeakEnd?.();
    onDone?.();
  };
  _currentDone = done;

  if (!('speechSynthesis' in window)) { done(); return; }
  window.speechSynthesis.cancel();
  const u = buildUtterance(text, getVoiceSettings());
  u.onstart = () => { _onSpeakStart?.(text); _onSpeakPlay?.(); };
  u.onend = done;
  u.onerror = done;
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
    // 品名は画面の表示名をそのまま読む（部品の詳しい型式までは読まない）
    const spokenName = itemNameForCall(item);

    // 数量は画面の PL / CT と同じ値を読む。
    // ポリカバー等の検査で1ケース抜く品目は、抜いた後の数をコールする。
    const q = displayQuantities(item);
    const qtyText = quantityToSpeech(q) || `${q.pcs}個`;

    let text = `${spokenName}。${qtyText}。`;

    // 鍋: 類似品・サイズ違いアナウンスは不要
    const isNabe = item.type === '鍋';

    // 似た名前のアイテムがある場合に警告（鍋以外）。
    // 具体的な類似品の内容はコールせず「類似品があります」とだけ伝える。
    if (!isNabe && allItems && allItems.length > 0) {
      const hasSimilar = allItems.some(
        (other) => other.id !== item.id && areSimilarItems(item.itemName, other.itemName)
      );
      if (hasSimilar) {
        text += '注意、類似品があります。';
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

  /**
   * コンテナ概要アナウンス（手動コール用）。
   *
   * 挨拶・内容案内（「◯◯が N 種類」）は読み上げない。
   * 残り品数と、注意が必要な類似品だけを短く伝える。
   */
  const announceContainerSummary = useCallback((
    items: ContainerItem[],
    ...rest: [string, Set<string>?, number?]
  ) => {
    const completedIds = rest[1];
    if (items.length === 0) return;

    const done = completedIds ? items.filter((it) => completedIds.has(it.id)).length : 0;
    const remaining = items.length - done;

    let text = remaining === 0 ? '全品目完了です。' : `残り${remaining}品。`;

    // 類似品がある種類だけ短く注意する
    const warnedTypes = new Set<string>();
    for (const a of items) {
      for (const b of items) {
        if (a.id >= b.id) continue;
        if (areSimilarItems(a.itemName, b.itemName)) warnedTypes.add(a.type);
      }
    }
    for (const t of Array.from(warnedTypes)) {
      text += `${t}に類似品があります。`;
    }

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
    const qty = quantityToSpeech({ pallets: remainingPallets, cartons: fractionCases || 0 });
    speak(qty ? `残り${qty}。` : '完了。');
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
