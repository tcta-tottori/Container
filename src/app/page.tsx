'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseExcelFile } from '@/lib/excelParser';
import { useContainerData } from '@/hooks/useContainerData';
import { useTimer, useClock } from '@/hooks/useTimer';
import { useSpeech } from '@/hooks/useSpeech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { VoiceAction } from '@/lib/speechCommands';
import { itemNameForSpeech } from '@/lib/typeDetector';
import FileDropZone from '@/components/FileDropZone';
import HeaderBar from '@/components/HeaderBar';
import ItemDetailPanel from '@/components/ItemDetailPanel';
import ItemListPanel from '@/components/ItemListPanel';
import ActionBar from '@/components/ActionBar';
import VoiceFeedback from '@/components/VoiceFeedback';

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
  const { speak, announceItem, announcePalletChange, announceComplete, announceAllComplete, announceRemaining } =
    useSpeech();

  const prevItemRef = useRef<string | null>(null);

  // 縦画面タブ: 'detail' | 'list'
  const [activeTab, setActiveTab] = useState<'detail' | 'list'>('detail');

  // 品目が変わったとき自動読上げ & 詳細タブに切り替え
  useEffect(() => {
    if (!currentItem || !state.autoAnnounce) return;
    if (prevItemRef.current !== currentItem.id) {
      prevItemRef.current = currentItem.id;
      announceItem(currentItem, state.items);
    }
  }, [currentItem, state.autoAnnounce, announceItem, state.items]);

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
    if (currentItem) announceItem(currentItem, state.items);
  }, [currentItem, announceItem, state.items]);

  const handleIncrease = useCallback(() => {
    increaseQty();
    setTimeout(() => {
      const el = document.querySelector('[data-pallet-count]');
      if (el) {
        const p = Number(el.getAttribute('data-pallet-count'));
        const t = Number(el.getAttribute('data-total-qty'));
        announcePalletChange(p, t);
      }
    }, 50);
  }, [increaseQty, announcePalletChange]);

  const handleDecrease = useCallback(() => {
    decreaseQty();
    setTimeout(() => {
      const el = document.querySelector('[data-pallet-count]');
      if (el) {
        const p = Number(el.getAttribute('data-pallet-count'));
        const t = Number(el.getAttribute('data-total-qty'));
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

  // リストで品目選択時 → 詳細タブに切り替え
  const handleSelectItem = useCallback(
    (idx: number) => {
      selectItem(idx);
      setActiveTab('detail');
    },
    [selectItem]
  );

  // 音声コマンド処理
  const handleVoiceCommand = useCallback(
    (action: VoiceAction) => {
      switch (action) {
        case 'MOVE_NEXT':
          moveNext();
          setActiveTab('detail');
          break;
        case 'MOVE_PREV':
          movePrev();
          setActiveTab('detail');
          break;
        case 'DELETE_CURRENT':
          handleComplete();
          break;
        case 'ANNOUNCE':
          handleAnnounce();
          break;
        case 'INCREASE_QTY':
          handleIncrease();
          break;
        case 'DECREASE_QTY':
          handleDecrease();
          break;
        case 'QUERY_CURRENT_QTY':
          if (currentItem) {
            speak(
              `${itemNameForSpeech(currentItem.itemName)}、総数${currentItem.totalQty}、パレット${currentItem.palletCount}枚、端数${currentItem.fraction}ケース。`
            );
          }
          break;
        case 'QUERY_REMAINING':
          speak(`残り${state.items.length}品目です。`);
          break;
        case 'QUERY_PALLET':
          if (currentItem) {
            speak(`パレット${currentItem.palletCount}枚です。`);
          }
          break;
        case 'QUERY_FRACTION':
          if (currentItem) {
            speak(`端数${currentItem.fraction}ケースです。`);
          }
          break;
      }
    },
    [moveNext, movePrev, handleComplete, handleAnnounce, handleIncrease, handleDecrease, currentItem, state.items.length, speak]
  );

  const { isListening, isSupported, lastTranscript, toggleListening } =
    useSpeechRecognition({ onCommand: handleVoiceCommand });

  // データ未読込 → DropZone
  if (state.containers.length === 0) {
    return <FileDropZone onFileLoaded={handleFileLoaded} />;
  }

  // 全品目完了
  if (state.items.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen w-screen"
        style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div
            className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.2)' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            全品目完了
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            お疲れ様でした
          </p>
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
            className="action-btn px-5 py-2.5 text-sm"
            style={{
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#60a5fa',
            }}
          >
            新しいファイルを読み込む
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 音声認識フィードバック */}
      <VoiceFeedback transcript={lastTranscript} isListening={isListening} />

      {/* メインレイアウト (横/縦 両対応) */}
      <div
        className="layout-landscape layout-portrait"
        style={{ background: 'var(--bg-primary)' }}
      >
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

        {/* 縦画面タブ切り替え */}
        <div className="portrait-tabs">
          <button
            className={`tab-btn ${activeTab === 'detail' ? 'active' : ''}`}
            onClick={() => setActiveTab('detail')}
          >
            詳細
          </button>
          <button
            className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            一覧 ({state.items.length})
          </button>
        </div>

        {/* メインエリア */}
        <div className="main-area">
          {/* 詳細パネル */}
          <div
            className={`detail-panel ${activeTab !== 'detail' ? 'hidden-tab' : ''}`}
            data-pallet-count={currentItem?.palletCount}
            data-total-qty={currentItem?.totalQty}
          >
            {currentItem && (
              <ItemDetailPanel
                item={currentItem}
                relatedItems={relatedItems}
                allItems={state.items}
              />
            )}
          </div>

          {/* 一覧パネル */}
          <div className={`list-panel ${activeTab !== 'list' ? 'hidden-tab' : ''}`}>
            <ItemListPanel
              items={state.items}
              currentIdx={state.currentItemIdx}
              onSelect={handleSelectItem}
            />
          </div>
        </div>

        {/* 操作バー */}
        <ActionBar
          onPrev={() => { movePrev(); setActiveTab('detail'); }}
          onNext={() => { moveNext(); setActiveTab('detail'); }}
          onIncrease={handleIncrease}
          onDecrease={handleDecrease}
          onAnnounce={handleAnnounce}
          onComplete={handleComplete}
          hasItems={state.items.length > 0}
          isListening={isListening}
          isVoiceSupported={isSupported}
          onToggleVoice={toggleListening}
        />
      </div>
    </>
  );
}
