'use client';

import { useCallback, useEffect, useRef } from 'react';
import { parseExcelFile } from '@/lib/excelParser';
import { useContainerData } from '@/hooks/useContainerData';
import { useTimer, useClock } from '@/hooks/useTimer';
import { useSpeech } from '@/hooks/useSpeech';
import FileDropZone from '@/components/FileDropZone';
import HeaderBar from '@/components/HeaderBar';
import ItemDetailPanel from '@/components/ItemDetailPanel';
import ItemListPanel from '@/components/ItemListPanel';
import ActionBar from '@/components/ActionBar';

export default function Home() {
  const {
    state,
    currentItem,
    relatedItems,
    loadData,
    selectContainer,
    selectItem,
    moveNext,
    movePrev,
    increaseQty,
    decreaseQty,
    deleteCurrent,
    toggleAutoAnnounce,
  } = useContainerData();

  const elapsed = useTimer(state.itemStartTime);
  const clock = useClock();
  const { announceItem, announcePalletChange, announceComplete, announceAllComplete, announceRemaining } =
    useSpeech();

  const prevItemRef = useRef<string | null>(null);

  // 品目が変わったとき自動読上げ
  useEffect(() => {
    if (!currentItem || !state.autoAnnounce) return;
    if (prevItemRef.current !== currentItem.id) {
      prevItemRef.current = currentItem.id;
      announceItem(currentItem);
    }
  }, [currentItem, state.autoAnnounce, announceItem]);

  const handleFileLoaded = useCallback(
    async (file: File) => {
      const result = await parseExcelFile(file);
      if (result.containers.length > 0) {
        loadData(result.containers);
      }
    },
    [loadData]
  );

  const handleAnnounce = useCallback(() => {
    if (currentItem) announceItem(currentItem);
  }, [currentItem, announceItem]);

  const handleIncrease = useCallback(() => {
    increaseQty();
    // 次ティックで更新後の値をアナウンス
    setTimeout(() => {
      const item = document.querySelector('[data-pallet-count]');
      if (item) {
        const p = Number(item.getAttribute('data-pallet-count'));
        const t = Number(item.getAttribute('data-total-qty'));
        announcePalletChange(p, t);
      }
    }, 50);
  }, [increaseQty, announcePalletChange]);

  const handleDecrease = useCallback(() => {
    decreaseQty();
    setTimeout(() => {
      const item = document.querySelector('[data-pallet-count]');
      if (item) {
        const p = Number(item.getAttribute('data-pallet-count'));
        const t = Number(item.getAttribute('data-total-qty'));
        announcePalletChange(p, t);
      }
    }, 50);
  }, [decreaseQty, announcePalletChange]);

  const handleComplete = useCallback(() => {
    if (!currentItem) return;
    const name = currentItem.itemName;
    const remaining = state.items.length - 1;

    if (!window.confirm(`「${name}」を完了しますか？`)) return;

    deleteCurrent();
    announceComplete(name);

    if (remaining === 0) {
      setTimeout(() => announceAllComplete(), 1500);
    } else {
      setTimeout(() => announceRemaining(remaining), 1500);
    }
  }, [currentItem, state.items.length, deleteCurrent, announceComplete, announceAllComplete, announceRemaining]);

  // データ未読込 → DropZone
  if (state.containers.length === 0) {
    return (
      <>
        <div className="portrait-warning fixed inset-0 z-50 flex items-center justify-center bg-gray-900 text-white text-xl">
          <div className="text-center p-8">
            <p className="text-4xl mb-4">📱</p>
            <p className="font-bold">横に回転してください</p>
          </div>
        </div>
        <div className="main-content">
          <FileDropZone onFileLoaded={handleFileLoaded} />
        </div>
      </>
    );
  }

  // 全品目完了
  if (state.items.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-2xl font-bold mb-2">全品目完了！</p>
          <p className="text-gray-400">お疲れ様でした</p>
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.xlsx,.xls';
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) handleFileLoaded(f);
              };
              input.click();
            }}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
          >
            新しいファイルを読み込む
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 縦画面警告 */}
      <div className="portrait-warning fixed inset-0 z-50 flex items-center justify-center bg-gray-900 text-white text-xl">
        <div className="text-center p-8">
          <p className="text-4xl mb-4">📱</p>
          <p className="font-bold">横に回転してください</p>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="main-content h-screen w-screen overflow-hidden flex-col">
        {/* ヘッダー */}
        <HeaderBar
          containers={state.containers}
          selectedIdx={state.selectedContainerIdx}
          onSelectContainer={selectContainer}
          onFileReload={handleFileLoaded}
          clock={clock}
          elapsed={elapsed}
          autoAnnounce={state.autoAnnounce}
          onToggleAutoAnnounce={toggleAutoAnnounce}
        />

        {/* メイン 2カラム */}
        <div className="flex flex-1 min-h-0">
          {/* 左: 詳細パネル 60% */}
          <div
            className="w-[60%] h-full"
            data-pallet-count={currentItem?.palletCount}
            data-total-qty={currentItem?.totalQty}
          >
            {currentItem && (
              <ItemDetailPanel
                item={currentItem}
                relatedItems={relatedItems}
              />
            )}
          </div>

          {/* 右: 一覧パネル 40% */}
          <div className="w-[40%] h-full border-l border-gray-700">
            <ItemListPanel
              items={state.items}
              currentIdx={state.currentItemIdx}
              onSelect={selectItem}
            />
          </div>
        </div>

        {/* 操作バー */}
        <ActionBar
          onPrev={movePrev}
          onNext={moveNext}
          onIncrease={handleIncrease}
          onDecrease={handleDecrease}
          onAnnounce={handleAnnounce}
          onComplete={handleComplete}
          hasItems={state.items.length > 0}
        />
      </div>
    </>
  );
}
