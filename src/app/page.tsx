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
import ItemEditPage from '@/components/ItemEditPage';
import ActionBar from '@/components/ActionBar';
import VoiceFeedback from '@/components/VoiceFeedback';

type TabName = 'detail' | 'list' | 'edit';

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
    updateItem,
  } = useContainerData();

  const elapsed = useTimer(state.itemStartTime);
  const clock = useClock();
  const { speak, announceItem, announcePalletChange, announceComplete, announceAllComplete, announceRemaining } =
    useSpeech();

  const prevItemRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('detail');

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

  const handleSelectItem = useCallback(
    (idx: number) => {
      selectItem(idx);
      setActiveTab('detail');
    },
    [selectItem]
  );

  // 管理ページから品目詳細へ移動
  const handleSelectAndGoDetail = useCallback(
    (idx: number) => {
      selectItem(idx);
      setActiveTab('detail');
    },
    [selectItem]
  );

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

  if (state.containers.length === 0) {
    return <FileDropZone onFileLoaded={handleFileLoaded} />;
  }

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
          <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>全品目完了</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>お疲れ様でした</p>
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
      <VoiceFeedback transcript={lastTranscript} isListening={isListening} />

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

        {/* タブ切り替え（縦画面＋横画面の管理タブ） */}
        <div className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'detail' ? 'active' : ''}`}
            onClick={() => setActiveTab('detail')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
            </svg>
            <span>詳細</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>一覧</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span>管理</span>
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

          {/* 管理ページ */}
          <div className={`edit-panel ${activeTab !== 'edit' ? 'hidden-tab' : ''}`}>
            <ItemEditPage
              items={state.items}
              onUpdateItem={updateItem}
              onSelectAndGoDetail={handleSelectAndGoDetail}
            />
          </div>
        </div>

        {/* 操作バー (詳細/一覧タブのみ表示) */}
        {activeTab !== 'edit' && (
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
        )}
      </div>
    </>
  );
}
