'use client';

import { useRef, useState, useEffect } from 'react';
import { CompletionLogEntry } from '@/hooks/useContainerData';
import { WeatherData, wbgtLevel } from '@/lib/weatherNews';
import { SwitchBotReading } from '@/lib/switchbot';
import { MenuIcon, ThermometerIcon, HumidityIcon } from '@/components/AppIcons';

export interface ItemTimeLog {
  itemName: string;
  elapsed: number; // seconds
  timestamp: number;
}

/**
 * 経過時間を「秒との間の : 」が動かない形で並べる。
 *
 * 数字は書体によって字ごとの幅が違うので、1文字ずつ同じ幅の枠に入れて揺れを止める。
 * さらに左右を同じ幅で確保しているので、1時間を超えて "1:05:23" と桁が増えても
 * 増えたぶんは左へ伸びるだけで、中央の : は同じ場所に留まる。
 */
function ElapsedDigits({ value }: { value: string }) {
  // 秒の直前の : を中央に置く（"05:23" → 05 / 23、"1:05:23" → 1:05 / 23）
  const cut = value.lastIndexOf(':');
  const left = cut >= 0 ? value.slice(0, cut) : value;
  const right = cut >= 0 ? value.slice(cut + 1) : '';

  const chars = (s: string) =>
    s.split('').map((c, i) => (
      <span key={i} className={c === ':' ? 'hdr-time-ch hdr-time-sep' : 'hdr-time-ch'}>{c}</span>
    ));

  return (
    <>
      <span className="hdr-time-left">{chars(left)}</span>
      <span className="hdr-time-sep hdr-time-colon">:</span>
      <span className="hdr-time-right">{chars(right)}</span>
    </>
  );
}

interface HeaderBarProps {
  workElapsed: string;
  workRawSeconds: number;
  onMenuToggle: () => void;
  onResetWorkTimer: () => void;
  itemTimeLogs: ItemTimeLog[];
  completionLog: CompletionLogEntry[];
  /** ヘッダー右の気温表示（気象庁データ） */
  weather?: WeatherData | null;
  /** SwitchBot の実測値。あれば実測を優先して表示する */
  switchbot?: SwitchBotReading | null;
  /** 気温表示のタップ（詳細ポップアップを開く） */
  onOpenClimate?: () => void;
  /**
   * コンテナを読み込み済みか。
   * 読み込み済みのときは、下スワイプの再読み込みで作業内容が消えるため確認をはさむ。
   */
  hasLoadedData?: boolean;
  /** ヘッダーを左右にスワイプしたとき（せせらぎモードを開く）。作業ページでのみ渡す */
  onSwipeToRiver?: () => void;
}

const TEMP_COLOR = '#fb923c'; // 気温（オレンジ）
const HUM_COLOR = '#38bdf8';  // 湿度（水色）

/* ===== ヘッダーを下にスワイプして再読み込み ===== */
/** 指の移動量に掛ける係数（引くほど重く感じるようにする） */
const PULL_RESIST = 0.55;
/** これ以上引いたら離したときに再読み込みする */
const PULL_TRIGGER = 72;
/** どれだけ引いてもここで止まる */
const PULL_MAX = 108;
/** これ以下の動きはタップ扱い（ボタンを押せるようにするため） */
const DRAG_SLOP = 8;
/** ヘッダーを左右にこれだけ動かしたら、せせらぎモードを開く */
const SWIPE_X_TRIGGER = 64;

/** 引っぱっている間に出る矢印（しきい値を超えると回って色が変わる） */
function PullIndicator({
  pull, ready, refreshing, dragging,
}: { pull: number; ready: boolean; refreshing: boolean; dragging: boolean }) {
  if (pull <= 0 && !refreshing) return null;
  const progress = Math.min(1, pull / PULL_TRIGGER);
  return (
    <div
      className={`pull-refresh${ready ? ' ready' : ''}${refreshing ? ' spinning' : ''}`}
      style={{
        transform: `translate(-50%, ${pull}px)`,
        opacity: Math.min(1, progress * 1.4),
        transition: dragging ? 'opacity 0.15s linear' : 'transform 0.32s cubic-bezier(0.22, 0.9, 0.28, 1), opacity 0.25s ease',
      }}
      aria-hidden="true"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: refreshing ? undefined : `rotate(${progress * 180}deg)` }}>
        <path d="M12 4v12" />
        <polyline points="6 11 12 17 18 11" />
      </svg>
    </div>
  );
}

/** ヘッダー右: 気温・湿度の数値 + 暑さ指数の色バッジ */
function HeaderClimate({
  weather, switchbot, onOpen,
}: {
  weather?: WeatherData | null;
  switchbot?: SwitchBotReading | null;
  onOpen?: () => void;
}) {
  const r = switchbot || weather;
  if (!r) return null;
  const lv = wbgtLevel(r.wbgt);

  return (
    <button className="header-climate" onClick={onOpen} title="タップで詳細を表示">
      <span className="header-climate-val">
        <span className="header-climate-row" style={{ color: TEMP_COLOR }}>
          <span className="header-climate-num">
            {r.temperature}<span className="header-climate-unit">°C</span>
          </span>
          <ThermometerIcon size={15} strokeWidth={2} />
        </span>
        <span className="header-climate-row" style={{ color: HUM_COLOR }}>
          <span className="header-climate-num" style={{ fontSize: 16 }}>
            {Math.round(r.humidity)}<span className="header-climate-unit" style={{ fontSize: 11 }}>%</span>
          </span>
          <HumidityIcon size={14} strokeWidth={2} />
        </span>
      </span>
      <span
        className="header-wbgt"
        style={{ background: `${lv.color}26`, border: `1.5px solid ${lv.color}`, color: lv.color }}
        title={`暑さ指数 ${r.wbgt}（${lv.label}）`}
      >
        <span className="header-wbgt-num">{r.wbgt}</span>
        <span className="header-wbgt-label">{lv.label}</span>
      </span>
    </button>
  );
}

export default function HeaderBar({
  workElapsed,
  workRawSeconds,
  onMenuToggle,
  onResetWorkTimer,
  itemTimeLogs,
  completionLog,
  weather,
  switchbot,
  onOpenClimate,
  hasLoadedData,
  onSwipeToRiver,
}: HeaderBarProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const lastFlashedAt = useRef(0);

  // ===== ヘッダーから下へスワイプして再読み込み =====
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const dragRef = useRef<{ id: number; x0: number; y0: number } | null>(null);
  /** 最新の onSwipeToRiver を onEnd から参照する（依存配列を増やさないため） */
  const swipeToRiverRef = useRef(onSwipeToRiver);
  swipeToRiverRef.current = onSwipeToRiver;
  /** 直前の操作がスワイプだったか（クリックを飲み込む判定に使う） */
  const movedRef = useRef(false);

  const doReload = () => {
    setConfirmReload(false);
    setRefreshing(true);
    setPull(PULL_TRIGGER);
    window.location.reload();
  };

  const startPull = (e: React.PointerEvent<HTMLDivElement>) => {
    if (refreshing || popupOpen || confirmReload) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    movedRef.current = false;
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      if (Math.abs(dy) > DRAG_SLOP || Math.abs(dx) > DRAG_SLOP) movedRef.current = true;
      // 横に動いているときは再読み込みの引っぱりとは見なさない
      if (Math.abs(dx) > Math.abs(dy)) { setPull(0); return; }
      // 引くほど重くなるように減衰させる
      setPull(dy > 0 ? Math.min(dy * PULL_RESIST, PULL_MAX) : 0);
    };
    const onEnd = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const rawDx = e.clientX - d.x0;
      const rawDy = e.clientY - d.y0;
      const dy = rawDy * PULL_RESIST;
      dragRef.current = null;
      setDragging(false);
      // スワイプ直後に発生するクリックは、どこに飛んでも1回だけ握りつぶす。
      // （指を離した位置によってはヘッダーの外に飛ぶので、window で受ける）
      if (movedRef.current) {
        movedRef.current = false;
        const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener('click', swallow, true);
        setTimeout(() => window.removeEventListener('click', swallow, true), 0);
      }
      // 左右どちらのスワイプでも、せせらぎモードを開く
      if (Math.abs(rawDx) >= SWIPE_X_TRIGGER && Math.abs(rawDx) > Math.abs(rawDy)) {
        setPull(0);
        swipeToRiverRef.current?.();
        return;
      }
      if (dy < PULL_TRIGGER) {
        setPull(0);
      } else if (hasLoadedData) {
        // 読み込んだコンテナと作業の進み具合が消えるので、一度確認する
        setPull(0);
        setConfirmReload(true);
      } else {
        doReload();
      }
    };

    // キャプチャ段階で拾う。途中のコンポーネントが stopPropagation しても取りこぼさない
    const opts = { capture: true } as const;
    window.addEventListener('pointermove', onMove, opts);
    window.addEventListener('pointerup', onEnd, opts);
    window.addEventListener('pointercancel', onEnd, opts);
    return () => {
      window.removeEventListener('pointermove', onMove, opts);
      window.removeEventListener('pointerup', onEnd, opts);
      window.removeEventListener('pointercancel', onEnd, opts);
    };
    // hasLoadedData は onEnd の分岐に使うので依存に入れる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, hasLoadedData]);

  const pullReady = pull >= PULL_TRIGGER;

  // 5分ごとに黄色点滅（5秒間）
  useEffect(() => {
    if (workRawSeconds > 0 && workRawSeconds % 300 === 0 && lastFlashedAt.current !== workRawSeconds) {
      lastFlashedAt.current = workRawSeconds;
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [workRawSeconds]);

  return (
    <>
      {/* 引っぱっている量を示す矢印。ヘッダーは overflow: hidden なので外に置く */}
      <PullIndicator pull={pull} ready={pullReady} refreshing={refreshing} dragging={dragging} />

      <div className="app-header" onPointerDown={startPull}>
      {/* 左: メニュー */}
      <div className="header-left">
        <button onClick={onMenuToggle} className="header-btn" title="メニュー" aria-label="メニュー">
          <MenuIcon size={24} strokeWidth={2} />
        </button>
      </div>

      {/* 中央: 経過時間 */}
      <div className="header-center">
        <button
          onClick={() => setPopupOpen(true)}
          className={`header-work-elapsed ${isFlashing ? 'header-elapsed-flash' : ''}`}
          style={{ background: 'transparent', cursor: 'pointer' }}
          title="タップで経過時間の詳細"
          aria-label={`経過時間 ${workElapsed}`}
        >
          <ElapsedDigits value={workElapsed} />
        </button>
      </div>

      {/* 右: 気温・湿度・暑さ指数 */}
      <div className="header-right">
        <HeaderClimate weather={weather} switchbot={switchbot} onOpen={onOpenClimate} />
      </div>
      </div>

      {/* 以下のオーバーレイはヘッダーの外に出す。
          中に置くと、スワイプ直後のクリックを飲み込む処理に巻き込まれてボタンが効かなくなる */}

      {/* 再読み込みの確認（読み込み済みのときだけ） */}
      {confirmReload && (
        <div className="reload-confirm-overlay" onClick={() => setConfirmReload(false)}>
          <div className="reload-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="reload-confirm-title">アプリを更新しますか？</div>
            <div className="reload-confirm-body">
              読み込み中のコンテナと作業の進み具合は消えます。
              ファイルはメニューの「履歴」から読み直せます。
            </div>
            <div className="reload-confirm-actions">
              <button className="reload-confirm-cancel" onClick={() => setConfirmReload(false)}>やめる</button>
              <button className="reload-confirm-ok" onClick={doReload}>更新する</button>
            </div>
          </div>
        </div>
      )}

      {/* 経過時間ポップアップ */}
      {popupOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setPopupOpen(false)}>
          <div style={{
            background: '#1e2130', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: '20px 24px', minWidth: 280, maxWidth: '90vw',
            maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            {/* 経過時間表示 */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>作業経過時間</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                {workElapsed}
              </div>
            </div>

            {/* リセットボタン */}
            <button
              onClick={() => { onResetWorkTimer(); setPopupOpen(false); }}
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, padding: '10px 16px', color: '#ef4444',
                fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 16,
              }}
            >
              経過時間をリセット
            </button>

            {/* 品名別消費時間 */}
            {itemTimeLogs.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>品名別消費時間</div>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {itemTimeLogs.map((log, i) => {
                    const m = Math.floor(log.elapsed / 60);
                    const s = log.elapsed % 60;
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12,
                      }}>
                        <span style={{ color: 'rgba(255,255,255,0.8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                          {log.itemName}
                        </span>
                        <span style={{ color: '#f59e0b', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>
                          {m > 0 ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* 完了品目 */}
            {completionLog.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, marginTop: 12 }}>完了品目</div>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {completionLog.map((entry, i) => {
                    const m = Math.floor(entry.duration / 60);
                    const s = entry.duration % 60;
                    return (
                      <div key={entry.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12,
                      }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0, marginRight: 8, minWidth: 24 }}>
                          #{i + 1}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                          {entry.name}
                        </span>
                        <span style={{ color: '#34d399', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>
                          {m > 0 ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* 閉じるボタン */}
            <button
              onClick={() => setPopupOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '10px 16px', color: 'rgba(255,255,255,0.7)',
                fontWeight: 500, fontSize: 13, cursor: 'pointer', marginTop: 12,
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
