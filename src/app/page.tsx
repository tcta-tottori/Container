'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseExcelFile } from '@/lib/excelParser';
import { useContainerData } from '@/hooks/useContainerData';
import { useTimer, useClock } from '@/hooks/useTimer';
import { useSpeech } from '@/hooks/useSpeech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { VoiceAction } from '@/lib/speechCommands';
import { itemNameForSpeech } from '@/lib/typeDetector';
import { saveRecentFile } from '@/lib/recentFiles';
import FileDropZone from '@/components/FileDropZone';
import HeaderBar from '@/components/HeaderBar';
import ItemDetailPanel from '@/components/ItemDetailPanel';
import ItemListPanel from '@/components/ItemListPanel';
import ItemEditPage from '@/components/ItemEditPage';
import ActionBar from '@/components/ActionBar';
import VoiceFeedback from '@/components/VoiceFeedback';

type ViewMode = 'work' | 'list' | 'edit';

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
    completeItem,
    uncompleteItem,
  } = useContainerData();

  const elapsed = useTimer(state.itemStartTime);
  const clock = useClock();
  const { speak, announceItem, announcePalletChange, announceComplete, announceAllComplete, announceRemaining } =
    useSpeech();

  const prevItemRef = useRef<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('work');
  const [menuOpen, setMenuOpen] = useState(false);

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
        // メモリーに保存
        const totalItems = result.containers.reduce((sum, c) => sum + c.items.length, 0);
        saveRecentFile(file, result.containers.length, totalItems);
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
        announcePalletChange(p);
      }
    }, 50);
  }, [increaseQty, announcePalletChange]);

  const handleDecrease = useCallback(() => {
    decreaseQty();
    setTimeout(() => {
      const el = document.querySelector('[data-pallet-count]');
      if (el) {
        const p = Number(el.getAttribute('data-pallet-count'));
        announcePalletChange(p);
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
      setViewMode('work');
    },
    [selectItem]
  );

  const handleSelectAndGoDetail = useCallback(
    (idx: number) => {
      selectItem(idx);
      setViewMode('work');
    },
    [selectItem]
  );

  const switchView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setMenuOpen(false);
  }, []);

  const handleVoiceCommand = useCallback(
    (action: VoiceAction) => {
      switch (action) {
        case 'MOVE_NEXT':
          moveNext(); setViewMode('work'); break;
        case 'MOVE_PREV':
          movePrev(); setViewMode('work'); break;
        case 'DELETE_CURRENT':
          handleComplete(); break;
        case 'ANNOUNCE':
          handleAnnounce(); break;
        case 'INCREASE_QTY':
          handleIncrease(); break;
        case 'DECREASE_QTY':
          handleDecrease(); break;
        case 'QUERY_CURRENT_QTY':
          if (currentItem) {
            let qText = '';
            if (currentItem.palletCount > 0 && currentItem.fraction > 0) {
              qText = `${currentItem.palletCount}パレットと${currentItem.fraction}ケース`;
            } else if (currentItem.palletCount > 0) {
              qText = `${currentItem.palletCount}パレット`;
            } else if (currentItem.fraction > 0) {
              qText = `${currentItem.fraction}ケース`;
            } else {
              qText = `${currentItem.totalQty}個`;
            }
            speak(`${itemNameForSpeech(currentItem.itemName)}、${qText}。`);
          }
          break;
        case 'QUERY_REMAINING':
          speak(`残り${state.items.length}品目です。`); break;
        case 'QUERY_PALLET':
          if (currentItem) speak(`パレット${currentItem.palletCount}枚です。`);
          break;
        case 'QUERY_FRACTION':
          if (currentItem) speak(`端数${currentItem.fraction}ケースです。`);
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
      <div className="flex items-center justify-center h-screen w-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.2)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>全品目完了</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>お疲れ様でした</p>
          <button onClick={() => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.xlsx,.xls';
            input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileLoaded(f); };
            input.click();
          }} className="action-btn px-5 py-2.5 text-sm"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
            新しいファイルを読み込む
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <VoiceFeedback transcript={lastTranscript} isListening={isListening} />

      {/* メニューオーバーレイ */}
      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="menu-panel" onClick={(e) => e.stopPropagation()}>
            <button className={`menu-item ${viewMode === 'work' ? 'active' : ''}`} onClick={() => switchView('work')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/>
              </svg>
              作業
            </button>
            <button className={`menu-item ${viewMode === 'list' ? 'active' : ''}`} onClick={() => switchView('list')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              一覧
            </button>
            <button className={`menu-item ${viewMode === 'edit' ? 'active' : ''}`} onClick={() => switchView('edit')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              管理
            </button>
            <div className="menu-divider" />
            <div className="menu-version">
              Container Navigation System v1.0
            </div>
          </div>
        </div>
      )}

      <div className="app-layout" style={{ background: 'var(--bg-primary)' }}>
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
          onMenuToggle={() => setMenuOpen(!menuOpen)}
        />

        {/* メインエリア */}
        <div className="main-area">
          {viewMode === 'work' && (
            <>
              {/* 横: 左60%詳細+右40%一覧, 縦: 詳細のみフル */}
              <div className="detail-panel"
                data-pallet-count={currentItem?.palletCount}
                data-total-qty={currentItem?.totalQty}>
                {currentItem && (
                  <ItemDetailPanel
                    item={currentItem}
                    relatedItems={relatedItems}
                    allItems={state.items}
                    completedIds={state.completedIds}
                    onSelectItem={handleSelectItem}
                    onCompleteItem={completeItem}
                    onUncompleteItem={uncompleteItem}
                  />
                )}
              </div>
              <div className="list-panel-side">
                <ItemListPanel items={state.items} currentIdx={state.currentItemIdx} onSelect={handleSelectItem} />
              </div>
            </>
          )}

          {viewMode === 'list' && (
            <div className="full-panel">
              <ItemListPanel items={state.items} currentIdx={state.currentItemIdx} onSelect={handleSelectItem} />
            </div>
          )}

          {viewMode === 'edit' && (
            <div className="full-panel">
              <ItemEditPage items={state.items} onUpdateItem={updateItem} onSelectAndGoDetail={handleSelectAndGoDetail} />
            </div>
          )}
        </div>

        {/* 操作バー (作業モード時のみ) */}
        {viewMode === 'work' && (
          <ActionBar
            onPrev={() => { movePrev(); setViewMode('work'); }}
            onNext={() => { moveNext(); setViewMode('work'); }}
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
