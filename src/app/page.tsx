'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseExcelFile } from '@/lib/excelParser';
import { fetchMasterData, fetchAndLinkMaster, linkItemsWithMaster, parseAqssExcel, parseMasterExcel, fetchJkpFromGitHub } from '@/lib/masterLoader';
import { parseAqssToContainer } from '@/lib/aqssContainerParser';
import { useContainerData } from '@/hooks/useContainerData';
import { useWorkTimer } from '@/hooks/useTimer';
import { useSpeech } from '@/hooks/useSpeech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { VoiceAction } from '@/lib/speechCommands';
import { itemNameForSpeech } from '@/lib/typeDetector';
import { saveRecentFile } from '@/lib/recentFiles';
import FileDropZone from '@/components/FileDropZone';
import HeaderBar, { ItemTimeLog } from '@/components/HeaderBar';
import ItemDetailPanel from '@/components/ItemDetailPanel';
import ItemListPanel from '@/components/ItemListPanel';
import ItemEditPage from '@/components/ItemEditPage';
// ActionBar removed - replaced by floating mic button
import VoiceFeedback from '@/components/VoiceFeedback';
import ManualPage from '@/components/ManualPage';
import ContainerAnalyticsPage from '@/components/ContainerAnalyticsPage';
import JkpSchedulePage from '@/components/JkpSchedulePage';
import HistoryPanel from '@/components/HistoryPanel';
import { JkpShipment, parseJkpSheet1, parseJkpVolume, parseJkpUpdata, jkpToContainerItems, getScheduleDatesInRange } from '@/lib/jkpParser';
import * as XLSX from 'xlsx';

type ViewMode = 'work' | 'list' | 'edit' | 'analytics' | 'jkp' | 'history';

/* ===== おしゃれな読込ポップアップ ===== */
function LoadingOverlay({ message, progress, closing }: { message: string; progress: number; closing?: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)',
      animation: closing ? 'loadFadeOut 0.5s ease both' : 'fadeIn 0.15s ease both',
    }}>
      <style>{`
        @keyframes spinCircle { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes loadFadeOut { 0% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>
      <div style={{
        background: 'linear-gradient(160deg, #0c0a1d 0%, #141028 50%, #0e1225 100%)',
        border: '1.5px solid rgba(255,255,255,0.15)',
        borderRadius: 24, padding: '32px 40px', textAlign: 'center',
        boxShadow: '0 0 30px rgba(255,255,255,0.03), 0 24px 60px rgba(0,0,0,0.6)',
        width: '90%', maxWidth: 300,
      }}>
        {/* サークル読込アニメーション */}
        <div style={{ width: 48, height: 48, margin: '0 auto 16px' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation: 'spinCircle 0.9s linear infinite' }}>
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="3"
              strokeLinecap="round" strokeDasharray="90 36"
              style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.2))' }} />
          </svg>
        </div>

        {/* メッセージ */}
        <p style={{
          color: '#fff', fontSize: 12, fontWeight: 600, margin: '0 0 12px', lineHeight: 1.5,
          textShadow: '0 0 6px rgba(255,255,255,0.15)',
        }}>
          {message}
        </p>

        {/* 進捗率 */}
        <p style={{
          color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 10px',
          fontFamily: 'var(--font-mono)',
          textShadow: '0 0 8px rgba(255,255,255,0.3), 0 0 16px rgba(255,255,255,0.12)',
        }}>
          {Math.round(progress)}%
        </p>

        {/* プログレスバー */}
        <div style={{
          width: '100%', height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
          border: '0.5px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'rgba(255,255,255,0.85)',
            boxShadow: '0 0 5px rgba(255,255,255,0.25), 0 0 10px rgba(255,255,255,0.08)',
            width: `${progress}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

/* ===== PWA更新通知 ===== */
function UpdateNotification() {
  const [hasUpdate, setHasUpdate] = useState(false);
  useEffect(() => {
    // Service Worker更新チェック
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const checkUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setHasUpdate(true);
                }
              });
            }
          });
          reg.update();
        }
      } catch { /* ignore */ }
    };
    checkUpdate();
    // 5分ごとに更新チェック
    const interval = setInterval(checkUpdate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!hasUpdate) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 500, animation: 'slideUp 0.5s ease both',
    }}>
      <button onClick={() => window.location.reload()} style={{
        background: 'linear-gradient(135deg, #4a7af7, #9b45c9)',
        border: 'none', borderRadius: 24, padding: '10px 24px',
        color: '#fff', fontSize: 13, fontWeight: 700,
        cursor: 'pointer', boxShadow: '0 4px 24px rgba(107,82,212,0.4)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        新しいバージョンがあります — 更新して再読み込み
      </button>
    </div>
  );
}

export default function Home() {
  const {
    state,
    currentItem,
    relatedItems,
    loadData,
    loadMaster,
    selectContainer,
    selectItem,
    moveNext,
    movePrev,
    increaseQty,
    decreaseQty,
    deleteCurrent,
    updateItem,
    updateMasterItem,
    addItem,
    deleteItem,
    completeItem,
    uncompleteItem,
    resetWorkTimer,
  } = useContainerData();

  const { formatted: workElapsed, rawSeconds: workRawSeconds } = useWorkTimer(state.workStartTime);
  const [itemTimeLogs, setItemTimeLogs] = useState<ItemTimeLog[]>([]);
  const { speak, announceItem, announcePalletChange, announceComplete, announceAllComplete, announceRemaining, announceContainerSummary, announceOk, announceProgress } =
    useSpeech();

  const prevItemRef = useRef<string | null>(null);
  const loadedContainerRef = useRef<string | null>(null);
  const masterLoadedRef = useRef(false);
  const linkedRef = useRef<string | null>(null);
  const announcedThresholdsRef = useRef<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('work');
  const [menuOpen, setMenuOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingClosing, setLoadingClosing] = useState(false);
  const [jkpShipments, setJkpShipments] = useState<JkpShipment[]>([]);
  const jkpUserLoadedRef = useRef(false);
  const [appReady, setAppReady] = useState(false);

  // 作業ページ表示中は画面スリープを防止（Wake Lock API）
  useEffect(() => {
    if (viewMode !== 'work' || state.items.length === 0) return;
    let wl: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ('wakeLock' in navigator) {
          wl = await navigator.wakeLock.request('screen');
        }
      } catch { /* ユーザー拒否やバックグラウンド時は無視 */ }
    };
    request();
    // タブ復帰時に再取得
    const onVisibility = () => { if (document.visibilityState === 'visible') request(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      wl?.release();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [viewMode, state.items.length]);

  // CNS品目一覧マスタデータ＋JKPデータを起動時に自動読込
  useEffect(() => {
    if (masterLoadedRef.current) return;
    masterLoadedRef.current = true;
    const init = async () => {
      try {
        // マスタデータ取得
        const [masterItems] = await Promise.all([
          fetchMasterData(),
          fetchJkpFromGitHub().then((wb) => {
            if (wb) {
              const { shipments } = parseJkpUpdata(wb);
              if (shipments.length > 0) setJkpShipments(shipments);
            }
          }).catch(() => {}),
        ]);
        if (masterItems.length > 0) loadMaster(masterItems);
      } finally {
        setAppReady(true);
      }
    };
    init();
  }, [loadMaster]);

  // コンテナ品目にマスタデータを自動紐付（気高コード＋新建高コード両方で検索）
  useEffect(() => {
    if (state.items.length === 0 || state.masterItems.length === 0) return;
    const container = state.containers[state.selectedContainerIdx];
    const key = container ? `${container.containerNo}-${state.selectedContainerIdx}` : '';
    if (linkedRef.current === key) return;
    linkedRef.current = key;

    // linkItemsWithMaster で一括紐付
    const { linkedItems } = linkItemsWithMaster(state.items, state.masterItems);
    linkedItems.forEach((linked, idx) => {
      const orig = state.items[idx];
      // 変更があったアイテムだけ更新
      if (linked.newPartNumber !== orig.newPartNumber ||
          linked.partNumber !== orig.partNumber ||
          linked.description !== orig.description) {
        const updates: Partial<typeof orig> = {};
        for (const k of Object.keys(linked) as (keyof typeof linked)[]) {
          if (linked[k] !== orig[k]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updates as any)[k] = linked[k];
          }
        }
        if (Object.keys(updates).length > 0) updateItem(idx, updates);
      }
    });
  }, [state.items, state.masterItems, state.containers, state.selectedContainerIdx, updateItem]);

  // 品目切替時の自動アナウンス（コンテナ読込直後の最初の品目はスキップ — 概要コールと混ざるため）
  const firstItemSkipRef = useRef(true);
  useEffect(() => {
    if (!currentItem || !state.autoAnnounce) return;
    if (prevItemRef.current !== currentItem.id) {
      prevItemRef.current = currentItem.id;
      if (firstItemSkipRef.current) {
        firstItemSkipRef.current = false;
        return; // 最初の品目コールをスキップ
      }
      // 完了コールとの重複回避（1.5秒待機）
      setTimeout(() => announceItem(currentItem, state.items), 1500);
    }
  }, [currentItem, state.autoAnnounce, announceItem, state.items]);

  // コンテナ読み込み時の概要アナウンス（初回のみ）
  useEffect(() => {
    if (state.containers.length === 0 || state.items.length === 0) return;
    const container = state.containers[state.selectedContainerIdx];
    if (!container) return;
    const key = `${container.containerNo}-${state.selectedContainerIdx}`;
    if (loadedContainerRef.current === key) return;
    loadedContainerRef.current = key;
    announcedThresholdsRef.current = new Set();
    firstItemSkipRef.current = true; // 概要コール中は品目コールをスキップ
    // 少し遅延して概要アナウンス
    const timer = setTimeout(() => {
      announceContainerSummary(state.items, container.containerNo);
    }, 800);
    return () => clearTimeout(timer);
  }, [state.containers, state.selectedContainerIdx, state.items, announceContainerSummary]);

  // 進捗マイルストーンアナウンス（50%, 80%）
  useEffect(() => {
    if (state.items.length === 0) return;
    const pct = state.completedIds.size / state.items.length * 100;
    // 50%: 残り半分コール、80%: あと少しコール
    if (pct >= 50 && !announcedThresholdsRef.current.has(50)) {
      announcedThresholdsRef.current.add(50);
      setTimeout(() => speak('残り半分です。'), 2500);
    }
    if (pct >= 80 && !announcedThresholdsRef.current.has(80)) {
      announcedThresholdsRef.current.add(80);
      setTimeout(() => speak('あと少しです。頑張りましょう。'), 2500);
    }
  }, [state.completedIds.size, state.items.length, announceProgress, state.items, state.completedIds]);

  // 読込完了→100%表示1秒→フェードアウト
  const closeLoading = useCallback(() => {
    setLoadingProgress(100);
    setTimeout(() => {
      setLoadingClosing(true);
      setTimeout(() => {
        setLoadingMsg(null);
        setLoadingProgress(0);
        setLoadingClosing(false);
      }, 500); // フェードアウト0.5秒
    }, 1000); // 100%表示1秒
  }, []);

  const handleFileLoaded = useCallback(
    async (file: File) => {
      loadedContainerRef.current = null;
      linkedRef.current = null;
      setLoadingMsg('Excelファイルを読み込み中...');
      setLoadingProgress(10);
      try {
        // 1. 作業ファイルをパース
        const result = await parseExcelFile(file);
        if (result.containers.length === 0) return;
        setLoadingProgress(25);

        // 2. GitHubから最新マスタを確実に取得（Meas.等の最新データ反映）
        setLoadingMsg('GitHubから最新の品目一覧を取得中...');
        setLoadingProgress(35);
        const masterItems = await fetchMasterData();
        if (masterItems.length > 0) {
          loadMaster(masterItems);
        }
        setLoadingProgress(60);

        // 3. マスタと紐付（気高コード＋新建高コード両方で検索）
        setLoadingMsg(`マスタデータと紐付中... (マスタ${masterItems.length}件)`);
        setLoadingProgress(70);
        const allItems = result.containers.flatMap(c => c.items);
        const { linkedItems, linked, total } = linkItemsWithMaster(allItems, masterItems);

        // 4. 紐付済みアイテムをコンテナに書き戻す
        let offset = 0;
        for (const c of result.containers) {
          const count = c.items.length;
          c.items = linkedItems.slice(offset, offset + count);
          offset += count;
        }

        setLoadingMsg(`紐付完了: ${linked}/${total}件  データを表示中...`);
        setLoadingProgress(90);

        // 5. データをロード（紐付済みの状態で表示）
        loadData(result.containers);
        const totalItems = result.containers.reduce((sum, c) => sum + c.items.length, 0);
        saveRecentFile(file, result.containers.length, totalItems, 'container');

        // 紐付済みなのでuseEffectの再紐付をスキップさせる
        const container = result.containers[0];
        if (container) {
          linkedRef.current = `${container.containerNo}-0`;
        }

        // 表示完了まで少し待機
        await new Promise((r) => setTimeout(r, 200));
      } finally {
        closeLoading();
      }
    },
    [loadData, loadMaster, closeLoading]
  );

  const handleAqssLoaded = useCallback(
    async (files: File[]) => {
      setLoadingMsg('AQSSファイルを読み込み中...');
      try {
        let totalUpdated = 0;
        for (const file of files) {
          const buffer = await file.arrayBuffer();
          const aqssMap = parseAqssExcel(buffer);
          // AQSSのキーは新建高コード → partNumber(気高)とnewPartNumber(新建高)の両方で検索
          state.items.forEach((item, idx) => {
            const aqss = aqssMap.get(item.partNumber)
              || (item.newPartNumber ? aqssMap.get(item.newPartNumber) : undefined);
            if (aqss) { updateItem(idx, aqss); totalUpdated++; }
          });
        }
        setLoadingMsg(`AQSS読込完了: ${totalUpdated}件更新`);
        await new Promise((r) => setTimeout(r, 1000));
      } finally {
        closeLoading();
      }
    },
    [state.items, updateItem, closeLoading]
  );

  // AQSSファイルのみでコンテナを新規作成
  const handleAqssContainerLoaded = useCallback(
    async (invoiceFile: File, packingFile?: File) => {
      loadedContainerRef.current = null;
      linkedRef.current = null;
      setLoadingMsg('AQSSファイルからコンテナを作成中...');
      try {
        const container = await parseAqssToContainer(invoiceFile, packingFile);
        if (!container || container.items.length === 0) {
          setLoadingMsg('AQSSファイルから品目を抽出できませんでした');
          await new Promise((r) => setTimeout(r, 2000));
          return;
        }

        // マスタと紐付
        setLoadingMsg('GitHubから最新の品目一覧を取得中...');
        const masterItems = await fetchMasterData();
        if (masterItems.length > 0) {
          loadMaster(masterItems);
        }

        setLoadingMsg(`マスタデータと紐付中... (マスタ${masterItems.length}件)`);
        const { linkedItems, linked, total } = linkItemsWithMaster(container.items, masterItems);
        container.items = linkedItems;

        setLoadingMsg(`紐付完了: ${linked}/${total}件 (${container.items.length}品目)`);
        loadData([container]);
        saveRecentFile(invoiceFile, 1, container.items.length, 'aqss');

        // 紐付済みなのでuseEffectの再紐付をスキップ
        linkedRef.current = `${container.containerNo}-0`;

        await new Promise((r) => setTimeout(r, 500));
      } finally {
        closeLoading();
      }
    },
    [loadData, loadMaster, closeLoading]
  );

  // マスターデータ（CNS品目一覧）をファイルから読込
  const handleMasterLoaded = useCallback(
    async (file: File) => {
      setLoadingMsg('マスターデータを読み込み中...');
      try {
        const buffer = await file.arrayBuffer();
        const masterItems = parseMasterExcel(buffer);
        if (masterItems.length === 0) {
          setLoadingMsg('マスターデータの解析に失敗しました');
          await new Promise((r) => setTimeout(r, 2000));
          return;
        }

        // マスタデータを更新
        loadMaster(masterItems);
        masterLoadedRef.current = true;

        // 既存コンテナ品目があれば再紐付
        if (state.items.length > 0) {
          setLoadingMsg(`マスタ${masterItems.length}件で紐付中...`);
          const { linkedItems, linked, total } = linkItemsWithMaster(state.items, masterItems);
          linkedItems.forEach((updatedItem, idx) => {
            const orig = state.items[idx];
            if (!orig) return;
            const updates: Partial<typeof orig> = {};
            for (const k of Object.keys(updatedItem) as (keyof typeof updatedItem)[]) {
              if (updatedItem[k] !== orig[k]) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (updates as any)[k] = updatedItem[k];
              }
            }
            if (Object.keys(updates).length > 0) updateItem(idx, updates);
          });
          linkedRef.current = null;
          setLoadingMsg(`マスタ読込完了: ${masterItems.length}件, 紐付${linked}/${total}件`);
        } else {
          setLoadingMsg(`マスタ読込完了: ${masterItems.length}件`);
        }

        saveRecentFile(file, 1, masterItems.length, 'master');
        await new Promise((r) => setTimeout(r, 1500));
      } finally {
        closeLoading();
      }
    },
    [loadMaster, state.items, updateItem, closeLoading]
  );

  const handleJkpLoaded = useCallback(
    async (file: File) => {
      jkpUserLoadedRef.current = true;  // ユーザー操作による読込
      loadedContainerRef.current = null;
      linkedRef.current = null;
      setLoadingMsg('JKPファイルを読み込み中...');
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });

        // Sheet1: 鍋品目リスト
        const sheet1Items = parseJkpSheet1(wb);
        // 体積Ｍ３: CBM・箱寸
        const volumeMap = parseJkpVolume(wb);
        // updata: 出荷スケジュール（船積日行で対象列を判定）
        const { shipments, activeDates } = parseJkpUpdata(wb);
        setJkpShipments(shipments);

        // 今日〜2週間先で実際に出荷数量がある日付のみ対象
        const today = new Date().toISOString().slice(0, 10);
        const twoWeeksLater = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        const scheduleDates = getScheduleDatesInRange(shipments, today, twoWeeksLater);

        if (scheduleDates.length === 0) {
          setLoadingMsg(`${today}〜${twoWeeksLater}の出荷データがありません (updata:${shipments.length}件, アクティブ日:${activeDates.length}件)`);
          await new Promise((r) => setTimeout(r, 3000));
          return;
        }

        setLoadingMsg(`${scheduleDates.length}日分のデータ検出（船積日基準）。変換中...`);

        // 日付ごとにContainerを作成: "タイガー鍋(3/25)" 形式
        const containers = [];
        let totalItems = 0;
        for (const date of scheduleDates) {
          const items = jkpToContainerItems(sheet1Items, volumeMap, shipments, date);
          if (items.length === 0) continue;
          const dateLabel = date.slice(5).replace('-', '/');
          containers.push({
            date,
            containerNo: `タイガー鍋(${dateLabel})`,
            items,
          });
          totalItems += items.length;
        }

        if (containers.length === 0) {
          setLoadingMsg('対象日の出荷データが0件です');
          await new Promise((r) => setTimeout(r, 2000));
          return;
        }

        // GitHubから最新マスタを取得してリンク
        setLoadingMsg(`${containers.length}日分 ${totalItems}品目検出。マスタデータを取得中...`);
        const masterItems = await fetchMasterData();
        if (masterItems.length > 0) {
          loadMaster(masterItems);
        }

        // 各コンテナの品目をマスタと紐付
        setLoadingMsg(`マスタデータと紐付中... (${totalItems}品目 × マスタ${masterItems.length}件)`);
        let linkedTotal = 0;
        for (const c of containers) {
          const { linkedItems, linked } = linkItemsWithMaster(c.items, masterItems);
          c.items = linkedItems;
          linkedTotal += linked;
        }

        setLoadingMsg(`紐付完了: ${linkedTotal}/${totalItems}件  作業シートを表示中...`);
        loadData(containers);
        saveRecentFile(file, containers.length, totalItems, 'jkp');

        // 紐付済みなのでuseEffectの再紐付をスキップ
        linkedRef.current = `${containers[0].containerNo}-0`;

        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        console.error('JKP parse error:', e);
        setLoadingMsg(`JKP読込エラー: ${e instanceof Error ? e.message : String(e)}`);
        await new Promise((r) => setTimeout(r, 3000));
      } finally {
        closeLoading();
      }
    },
    [loadData, loadMaster, closeLoading]
  );

  const handleAnnounce = useCallback(() => {
    if (currentItem) announceItem(currentItem, state.items);
  }, [currentItem, announceItem, state.items]);

  const handleContainerSummary = useCallback(() => {
    const container = state.containers[state.selectedContainerIdx];
    if (container) {
      announceContainerSummary(state.items, container.containerNo, state.completedIds, workRawSeconds);
    }
  }, [state.containers, state.selectedContainerIdx, state.items, state.completedIds, workRawSeconds, announceContainerSummary]);

  const handleProgress = useCallback(() => {
    announceProgress(state.items, state.completedIds);
  }, [state.items, state.completedIds, announceProgress]);

  // OKコマンドの5秒クールダウン
  const okCooldownRef = useRef(0);

  /** OKコマンド: パレット1つ消費、なくなったら自動完了 */
  const handleConfirmOk = useCallback(() => {
    if (!currentItem) return;
    // 5秒クールダウン（タイムスタンプベースで確実に解除）
    if (Date.now() - okCooldownRef.current < 5000) return;
    okCooldownRef.current = Date.now();

    // 端数の検査抜き数
    const rawFrac = currentItem.fraction % 1 !== 0 ? Math.ceil(currentItem.fraction) : currentItem.fraction;
    const fractionDeducted = rawFrac > 0 ? rawFrac - 1 : 0;

    // パレット0・端数0 → 完了処理
    if (currentItem.palletCount <= 0 && currentItem.fraction <= 0) {
      completeItem(currentItem.id);
      announceOk('', 0, 0);
      const remaining = state.items.filter((it) => !state.completedIds.has(it.id)).length - 1;
      if (remaining <= 0) setTimeout(() => announceAllComplete(), 1500);
      return;
    }

    // 消費時間を記録
    if (state.itemStartTime) {
      const elapsed = Math.floor((Date.now() - state.itemStartTime) / 1000);
      setItemTimeLogs(prev => [...prev, { itemName: currentItem.itemName, elapsed, timestamp: Date.now() }]);
    }

    // パレットがあればパレット1つ減らす
    if (currentItem.palletCount > 0) {
      decreaseQty();
      const newPallet = currentItem.palletCount - 1;
      if (newPallet <= 0 && currentItem.fraction <= 0) {
        setTimeout(() => {
          completeItem(currentItem.id);
          announceOk('', 0, 0);
          const remaining = state.items.filter((it) => !state.completedIds.has(it.id)).length - 1;
          if (remaining <= 0) setTimeout(() => announceAllComplete(), 1500);
        }, 100);
      } else {
        announceOk('', newPallet, fractionDeducted);
      }
    } else {
      // パレット0でケースのみの場合は完了
      completeItem(currentItem.id);
      announceOk('', 0, 0);
      const remaining = state.items.filter((it) => !state.completedIds.has(it.id)).length - 1;
      if (remaining <= 0) setTimeout(() => announceAllComplete(), 1500);
    }
  }, [currentItem, decreaseQty, completeItem, state.items, state.completedIds, state.itemStartTime, announceOk, announceAllComplete]);

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
    if (!currentItem) return;

    // Auto-complete if pallet is already 0
    if (currentItem.palletCount === 0) {
      const name = currentItem.itemName;
      const remaining = state.items.filter((it) => !state.completedIds.has(it.id)).length - 1;
      completeItem(currentItem.id);
      announceComplete(name);
      if (remaining <= 0) {
        setTimeout(() => announceAllComplete(), 1500);
      }
      return;
    }

    decreaseQty();
    // 消費時間を記録（パレット減少）
    if (state.itemStartTime) {
      const elapsed = Math.floor((Date.now() - state.itemStartTime) / 1000);
      setItemTimeLogs(prev => [...prev, {
        itemName: currentItem.itemName,
        elapsed,
        timestamp: Date.now(),
      }]);
    }
    setTimeout(() => {
      const el = document.querySelector('[data-pallet-count]');
      if (el) {
        const p = Number(el.getAttribute('data-pallet-count'));
        const fraction = currentItem.fraction;
        const fractionCeil = Math.max(0, (fraction % 1 !== 0 ? Math.ceil(fraction) : fraction) - 1); // 検査抜き
        let qtyText = '';
        if (p > 0 && fractionCeil > 0) {
          qtyText = `残り${p}パレットと${fractionCeil}ケース`;
        } else if (p > 0) {
          qtyText = `残り${p}パレット`;
        } else if (fractionCeil > 0) {
          qtyText = `残り${fractionCeil}ケース`;
        } else {
          qtyText = '残りなし';
        }
        speak(qtyText);
      }
    }, 50);
  }, [currentItem, decreaseQty, speak, state.itemStartTime, state.items, state.completedIds, completeItem, announceComplete, announceAllComplete]);

  const handleComplete = useCallback(() => {
    if (!currentItem) return;
    const name = currentItem.itemName;
    const remaining = state.items.length - 1;
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
        case 'CONFIRM_OK':
          handleConfirmOk();
          break;
        case 'CONTAINER_SUMMARY':
          handleContainerSummary();
          break;
        case 'QUERY_PROGRESS':
          handleProgress();
          break;
        case 'UNDO_DECREASE':
          handleIncrease();
          speak('パレットを1つ戻しました。');
          break;
        case 'QUERY_TYPE_COUNT': {
          const counts: Record<string, number> = {};
          const remaining = state.items.filter(it => !state.completedIds.has(it.id));
          for (const it of remaining) counts[it.type] = (counts[it.type] || 0) + 1;
          const parts: string[] = [];
          for (const [t, c] of Object.entries(counts)) parts.push(`${t}が${c}種類`);
          speak(`残り${remaining.length}品目。${parts.join('、')}。`);
          break;
        }
      }
    },
    [moveNext, movePrev, handleComplete, handleAnnounce, handleIncrease, handleDecrease, currentItem, state.items, state.items.length, state.completedIds, speak, handleConfirmOk, handleContainerSummary, handleProgress]
  );

  const { isListening, isSpeaking, isSupported, lastTranscript, toggleListening } =
    useSpeechRecognition({ onCommand: handleVoiceCommand });

  // 初期ロード中はスプラッシュ画面
  if (!appReady) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #0c0a1d 0%, #141028 30%, #0e1225 70%, #0a0c1e 100%)',
        zIndex: 999,
      }}>
        <style>{`
          @keyframes neonPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
          @keyframes dotFlow { 0%,20% { opacity: 0.15; } 40% { opacity: 1; } 60%,100% { opacity: 0.15; } }
        `}</style>
        {/* キューブアイコン（2D・アニメーションなし） */}
        <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 28 }}>
          <div style={{
            position: 'absolute', inset: -16,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 45%, transparent 70%)',
            animation: 'neonPulse 2.5s ease-in-out infinite',
          }} />
          <svg width="72" height="72" viewBox="0 0 64 64" fill="none"
            style={{ position: 'relative', animation: 'neonPulse 2.5s ease-in-out infinite' }}>
            <g transform="translate(32,32)" stroke="#fff" strokeWidth="3" strokeLinejoin="round" fill="none">
              <polygon points="0,-20.88 18,-10.44 0,0 -18,-10.44"/>
              <polygon points="-18,-10.44 0,0 0,20.88 -18,10.44"/>
              <polygon points="18,-10.44 0,0 0,20.88 18,10.44"/>
            </g>
          </svg>
        </div>
        {/* Loading文字 + ドット（下に配置） */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 16, fontWeight: 600, color: '#fff', fontFamily: 'Inter, sans-serif',
            letterSpacing: 3,
            textShadow: '0 0 10px rgba(255,255,255,0.7), 0 0 20px rgba(255,255,255,0.35), 0 0 40px rgba(255,255,255,0.15)',
          }}>Loading</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <span key={i} style={{
                display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.3)',
                animation: `dotFlow 2s ease-in-out ${i * 0.3}s infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.containers.length === 0 && !(jkpUserLoadedRef.current && jkpShipments.length > 0)) {
    return (
      <>
        <FileDropZone onFileLoaded={handleFileLoaded} onAqssLoaded={handleAqssLoaded} onAqssContainerLoaded={handleAqssContainerLoaded} onJkpLoaded={handleJkpLoaded} onMasterLoaded={handleMasterLoaded} />
        {loadingMsg && <LoadingOverlay message={loadingMsg} progress={loadingProgress} closing={loadingClosing} />}
      </>
    );
  }

  // JKPデータのみ（コンテナなし、ユーザー明示読込時のみ）: JKPスケジュールページ表示
  if (state.containers.length === 0 && jkpUserLoadedRef.current && jkpShipments.length > 0) {
    return (
      <div className="app-layout" style={{ background: 'var(--bg-primary)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
          background: '#1a1d2e', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
        }}>
          <button onClick={() => { setJkpShipments([]); setViewMode('work'); }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>JKP出荷スケジュール</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <JkpSchedulePage shipments={jkpShipments} />
        </div>
      </div>
    );
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
      {manualOpen && <ManualPage onClose={() => setManualOpen(false)} />}
      <VoiceFeedback transcript={lastTranscript} isListening={isListening} />
      {loadingMsg && <LoadingOverlay message={loadingMsg} progress={loadingProgress} closing={loadingClosing} />}

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
            {/* 一覧ページ削除 */}
            <button className={`menu-item ${viewMode === 'edit' ? 'active' : ''}`} onClick={() => switchView('edit')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              管理
            </button>
            <div className="menu-divider" />
            <button className={`menu-item ${viewMode === 'analytics' ? 'active' : ''}`} onClick={() => switchView('analytics')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              分析
            </button>
            <button className={`menu-item ${viewMode === 'history' ? 'active' : ''}`} onClick={() => switchView('history')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              履歴
            </button>
            <div className="menu-divider" />
            <button className="menu-item" onClick={() => { setManualOpen(true); setMenuOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              マニュアル
            </button>
            <div className="menu-divider" />
            <div className="menu-version">
              CNS Ver 1.7
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
          workElapsed={workElapsed}
          workRawSeconds={workRawSeconds}
          onMenuToggle={() => setMenuOpen(!menuOpen)}
          onResetWorkTimer={() => { resetWorkTimer(); setItemTimeLogs([]); }}
          itemTimeLogs={itemTimeLogs}
          completionLog={state.completionLog}
          onContainerAnnounce={handleContainerSummary}
          hasItems={state.items.length > 0}
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
                    onCompleteItem={(id: string) => {
                      const item = state.items.find(it => it.id === id);
                      completeItem(id);
                      if (item) {
                        announceComplete(item.itemName);
                      }
                    }}
                    onUncompleteItem={uncompleteItem}
                    onDecrementPallet={handleDecrease}
                  />
                )}
              </div>
              <div className="list-panel-side">
                <ItemListPanel items={state.items} currentIdx={state.currentItemIdx} onSelect={handleSelectItem} onComplete={completeItem} />
              </div>
            </>
          )}

          {viewMode === 'list' && (
            <div className="full-panel">
              <ItemListPanel items={state.items} currentIdx={state.currentItemIdx} onSelect={handleSelectItem} />
            </div>
          )}

          {viewMode === 'analytics' && (
            <div className="full-panel">
              <ContainerAnalyticsPage
                items={state.items}
                completedIds={state.completedIds}
                containerNo={state.containers[state.selectedContainerIdx]?.containerNo || ''}
              />
            </div>
          )}

          {viewMode === 'jkp' && (
            <div className="full-panel">
              <JkpSchedulePage shipments={jkpShipments} />
            </div>
          )}

          {viewMode === 'history' && (
            <div className="full-panel" style={{ padding: 16, overflowY: 'auto' }}>
              <HistoryPanel />
            </div>
          )}

          {viewMode === 'edit' && (
            <div className="full-panel">
              <ItemEditPage
                items={(() => {
                  // コンテナ品目 + マスタ品目（重複排除）を統合
                  const containerParts = new Set(state.items.map((it) => it.partNumber));
                  const masterOnly = state.masterItems.filter((it) => !containerParts.has(it.partNumber));
                  return [...state.items, ...masterOnly];
                })()}
                containerNo={state.containers[state.selectedContainerIdx]?.containerNo || ''}
                containerPartNumbers={new Set(state.items.map((it) => it.partNumber))}
                loadingMsg={loadingMsg}
                onUpdateItem={(idx, updates) => {
                  // Container items are first in the merged list, master-only items follow
                  if (idx < state.items.length) {
                    updateItem(idx, updates);
                  } else {
                    // Convert merged-list index to masterItems index
                    const containerParts = new Set(state.items.map((it) => it.partNumber));
                    const masterOnly = state.masterItems.filter((it) => !containerParts.has(it.partNumber));
                    const masterOnlyIdx = idx - state.items.length;
                    if (masterOnlyIdx >= 0 && masterOnlyIdx < masterOnly.length) {
                      const masterRealIdx = state.masterItems.indexOf(masterOnly[masterOnlyIdx]);
                      if (masterRealIdx >= 0) updateMasterItem(masterRealIdx, updates);
                    }
                  }
                }}
                onAddItem={addItem}
                onDeleteItem={deleteItem}
                onSelectAndGoDetail={handleSelectAndGoDetail}
                onMasterReload={async () => {
                  setLoadingMsg('GitHubから最新の品目一覧を取得中...');
                  try {
                    masterLoadedRef.current = false;
                    // 1. マスタデータを取得・紐付
                    const { masterItems: newMaster, linkedItems, linked: linkedCount, total } =
                      await fetchAndLinkMaster(state.items);
                    if (newMaster.length > 0) {
                      loadMaster(newMaster);
                      // 紐付結果を反映
                      linkedItems.forEach((updatedItem, idx) => {
                        const orig = state.items[idx];
                        if (!orig) return;
                        const updates: Partial<typeof orig> = {};
                        for (const k of Object.keys(updatedItem) as (keyof typeof updatedItem)[]) {
                          if (updatedItem[k] !== orig[k]) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (updates as any)[k] = updatedItem[k];
                          }
                        }
                        if (Object.keys(updates).length > 0) updateItem(idx, updates);
                      });
                      linkedRef.current = null;

                      // 2. JKPデータもGitHubから最新を取得
                      setLoadingMsg(`マスタ${newMaster.length}件取得完了。JKPデータを取得中...`);
                      try {
                        const jkpWb = await fetchJkpFromGitHub();
                        if (jkpWb) {
                          const { shipments } = parseJkpUpdata(jkpWb);
                          if (shipments.length > 0) {
                            setJkpShipments(shipments);
                            setLoadingMsg(`再読込完了: マスタ${newMaster.length}件, 紐付${linkedCount}/${total}件, JKP${shipments.length}品目`);
                          } else {
                            setLoadingMsg(`再読込完了: マスタ${newMaster.length}件, 紐付${linkedCount}/${total}件 (JKPデータなし)`);
                          }
                        } else {
                          setLoadingMsg(`再読込完了: マスタ${newMaster.length}件, 紐付${linkedCount}/${total}件`);
                        }
                      } catch {
                        setLoadingMsg(`再読込完了: マスタ${newMaster.length}件, 紐付${linkedCount}/${total}件`);
                      }
                    } else {
                      setLoadingMsg('マスタデータの取得に失敗しました');
                    }
                    await new Promise((r) => setTimeout(r, 1500));
                  } finally {
                    closeLoading();
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* フローティングマイクボタン（右下固定） */}
        {viewMode === 'work' && isSupported && (
          <>
            {isSpeaking && (
              <style>{`
                @keyframes speakBar1 { 0%,100% { height: 20%; } 50% { height: 80%; } }
                @keyframes speakBar2 { 0%,100% { height: 40%; } 40% { height: 95%; } }
                @keyframes speakBar3 { 0%,100% { height: 60%; } 30% { height: 100%; } 70% { height: 35%; } }
                @keyframes speakBar4 { 0%,100% { height: 50%; } 60% { height: 90%; } }
                @keyframes speakBar5 { 0%,100% { height: 30%; } 45% { height: 75%; } }
                @keyframes speakBar6 { 0%,100% { height: 15%; } 55% { height: 65%; } }
                @keyframes speakBar7 { 0%,100% { height: 25%; } 35% { height: 70%; } }
              `}</style>
            )}
            <button onClick={() => {
              if (isSpeaking && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                return;
              }
              toggleListening();
            }}
              className={`mic-float-btn ${isListening && !isSpeaking ? 'mic-btn-recording' : ''}`}
              style={{
                position: 'fixed', bottom: 20, zIndex: 100,
                width: 56, height: 56, borderRadius: '50%',
                background: isSpeaking
                  ? 'radial-gradient(circle at 35% 35%, #b48eff, #8b5cf6 50%, #6d28d9 80%, #4c1d95)'
                  : isListening
                    ? 'radial-gradient(circle at 35% 35%, #ff6b6b, #dc2626 60%, #991b1b)'
                    : 'radial-gradient(circle at 35% 35%, #7c9bff, #4a6ef7 50%, #3b52d4 80%, #2a3aaa)',
                border: isSpeaking ? '2px solid rgba(167,139,250,0.6)'
                  : isListening ? '2px solid rgba(255,100,100,0.6)' : '2px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                boxShadow: isSpeaking
                  ? '0 0 24px rgba(139,92,246,0.5), 0 0 48px rgba(139,92,246,0.2), inset 0 1px 2px rgba(255,255,255,0.15)'
                  : isListening
                    ? '0 0 24px rgba(239,68,68,0.5), 0 0 48px rgba(239,68,68,0.2), inset 0 1px 2px rgba(255,255,255,0.2)'
                    : '0 4px 20px rgba(74,110,247,0.35), 0 0 40px rgba(107,82,212,0.15), inset 0 1px 2px rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}>
              {isSpeaking ? (
                /* 音声コール中: 音声波形アイコン（7本の棒が不規則に伸縮） */
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
                  {[
                    { dur: '0.8s', delay: '0s', anim: 'speakBar1' },
                    { dur: '0.6s', delay: '0.1s', anim: 'speakBar2' },
                    { dur: '0.7s', delay: '0.05s', anim: 'speakBar3' },
                    { dur: '0.5s', delay: '0.15s', anim: 'speakBar4' },
                    { dur: '0.65s', delay: '0.08s', anim: 'speakBar5' },
                    { dur: '0.75s', delay: '0.12s', anim: 'speakBar6' },
                    { dur: '0.55s', delay: '0.03s', anim: 'speakBar7' },
                  ].map((b, i) => (
                    <div key={i} style={{
                      width: 3, borderRadius: 2,
                      background: '#fff',
                      boxShadow: '0 0 4px rgba(255,255,255,0.5)',
                      animation: `${b.anim} ${b.dur} ease-in-out ${b.delay} infinite`,
                    }} />
                  ))}
                </div>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' }}>
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  {!isListening && <><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>}
                </svg>
              )}
              {isListening && !isSpeaking && (
                <span style={{
                  position: 'absolute', inset: -4, borderRadius: '50%',
                  border: '2px solid rgba(239,68,68,0.5)',
                  animation: 'mic-ring-pulse 1.5s ease-out infinite',
                }} />
              )}
              {isSpeaking && (
                <span style={{
                  position: 'absolute', inset: -4, borderRadius: '50%',
                  border: '2px solid rgba(167,139,250,0.5)',
                  animation: 'mic-ring-pulse 1.5s ease-out infinite',
                }} />
              )}
            </button>
          </>
        )}
        <UpdateNotification />
      </div>
    </>
  );
}
