'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ContainerItem } from '@/lib/types';
import { displayQuantities } from '@/lib/itemQuantity';
import { usePalletTap } from '@/hooks/usePalletTap';

interface RiverModeProps {
  onClose: () => void;
  /** いま作業中の品目。画面をタップすると川から情報が浮かび上がる */
  item?: ContainerItem | null;
  /** パレット数をタップしたときの処理（作業画面の「減らす」と同じ） */
  onDecreasePallet?: () => void;
  /** パレット数をダブルタップしたときの処理（作業画面の「増やす」と同じ） */
  onIncreasePallet?: () => void;
  /** 機種名を上にスワイプ → 次の品目 */
  onNextItem?: () => void;
  /** 機種名を下にスワイプ → 前の品目 */
  onPrevItem?: () => void;
  /** 作業の経過時間（右上に黄色で出す） */
  workElapsed?: string;
}

/** タップの波紋（水滴が落ちた水面） */
interface Ripple {
  x: number; y: number; t: number;
}

const BASE = process.env.NODE_ENV === 'production' ? '/Container' : '';
/** 継ぎ目が分からないように末尾と先頭をクロスフェードして作ったループ動画（約6.5秒・音声なし） */
const VIDEO_MP4 = `${BASE}/videos/river-loop.mp4`;
/** H.264 を再生できない環境向け（Chromium の一部ビルドなど） */
const VIDEO_WEBM = `${BASE}/videos/river-loop.webm`;
const POSTER = `${BASE}/videos/river-poster.jpg`;

/** 画面下側のこの割合をタップすると閉じる */
const CLOSE_ZONE = 1 / 3;
/** 浮かび上がった品目情報が沈むまでの時間 */
const INFO_MS = 9000;
/** 機種名のスワイプを切り替えとみなす縦の移動量(px) */
const SWIPE_Y = 42;

/** 波紋1つの寿命(秒) */
const RIPPLE_LIFE = 2.2;

/** 時刻を HH:MM で返す */
function nowHhMm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * せせらぎモード。
 * 川のループ動画を全画面（ステータスバー領域まで）で流す休憩用の表示。
 * 上側のタップは水滴の波紋＋品目情報の出し入れ、下 1/3 をタップすると元の画面に戻る。
 */
export default function RiverMode({
  onClose, item, onDecreasePallet, onIncreasePallet, onNextItem, onPrevItem, workElapsed,
}: RiverModeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const [hintVisible, setHintVisible] = useState(true);
  /** 品目情報が浮かび上がっているか。key を変えると出現アニメをやり直す */
  const [info, setInfo] = useState<{ shown: boolean; key: number }>({ shown: false, key: 0 });
  const infoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 全画面（ステータスバーを消せた）かどうか。消せたときだけ自前の時計を出す */
  const [ownClock, setOwnClock] = useState(false);
  const [clock, setClock] = useState('');

  /** 情報を浮かび上がらせて、一定時間で沈める */
  const surfaceInfo = useCallback((restart: boolean) => {
    setInfo((prev) => ({ shown: true, key: restart || !prev.shown ? prev.key + 1 : prev.key }));
    if (infoTimer.current) clearTimeout(infoTimer.current);
    infoTimer.current = setTimeout(() => setInfo((prev) => ({ ...prev, shown: false })), INFO_MS);
  }, []);

  /** 情報を川に沈める */
  const sinkInfo = useCallback(() => {
    if (infoTimer.current) { clearTimeout(infoTimer.current); infoTimer.current = null; }
    setInfo((prev) => (prev.shown ? { ...prev, shown: false } : prev));
  }, []);

  useEffect(() => () => { if (infoTimer.current) clearTimeout(infoTimer.current); }, []);

  // ヒントは数秒で消す
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Esc でも戻れる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 表示中は画面を消灯させない
  useEffect(() => {
    let wl: WakeLockSentinel | null = null;
    let released = false;
    (async () => {
      try {
        if ('wakeLock' in navigator) wl = await navigator.wakeLock.request('screen');
      } catch { /* 取得できなくても続行 */ }
      if (released && wl) { try { await wl.release(); } catch { /* ignore */ } }
    })();
    return () => {
      released = true;
      if (wl) { try { void wl.release(); } catch { /* ignore */ } }
    };
  }, []);

  /*
   * ステータスバー領域まで映像で埋める。
   * - 全画面 API が使える端末（Android など）は全画面にしてステータスバーごと隠し、
   *   代わりに時刻だけを自前で描く。
   * - 使えない端末（iOS のホーム画面アプリなど）は black-translucent により
   *   もともと映像がステータスバーの下まで届くので、theme-color だけ黒に寄せる。
   */
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', '#000000');

    const el = rootRef.current;
    let entered = false;
    (async () => {
      try {
        if (el && !document.fullscreenElement && el.requestFullscreen) {
          await el.requestFullscreen({ navigationUI: 'hide' });
          entered = true;
        }
      } catch { /* 全画面にできなくても続行 */ }
      setOwnClock(entered && !!document.fullscreenElement);
    })();

    const onFsChange = () => setOwnClock(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (meta) {
        if (prevTheme === null) meta.removeAttribute('content');
        else meta.setAttribute('content', prevTheme);
      }
      if (document.fullscreenElement) { void document.exitFullscreen().catch(() => { /* ignore */ }); }
    };
  }, []);

  // 自前の時計（全画面でステータスバーを隠したときだけ表示する）
  useEffect(() => {
    if (!ownClock) return;
    setClock(nowHhMm());
    const t = setInterval(() => setClock(nowHhMm()), 10000);
    return () => clearInterval(t);
  }, [ownClock]);

  // 自動再生がブロックされた場合と、バックグラウンド復帰時の再生再開
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const play = () => { void v.play().catch(() => { /* 再生できなくてもポスター画像を表示 */ }); };
    play();
    const onVis = () => { if (!document.hidden) play(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  /**
   * 下 1/3 をタップで閉じる。
   * それ以外は水滴の波紋を落としつつ、品目情報が出ていれば沈め、出ていなければ浮かび上がらせる。
   */
  const handleTap = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y > rect.height * (1 - CLOSE_ZONE)) {
      onClose();
      return;
    }
    ripplesRef.current.push({ x: e.clientX - rect.left, y, t: 0 });
    if (ripplesRef.current.length > 6) ripplesRef.current.shift();
    if (!item) return;
    if (info.shown) sinkInfo();
    else surfaceInfo(true);
  }, [onClose, item, info.shown, sinkInfo, surfaceInfo]);

  /** パレット数: 1回タップで減らす／2回タップで増やす。表示時間は数え直す */
  const palletTap = usePalletTap(
    () => { onDecreasePallet?.(); },
    () => { onIncreasePallet?.(); },
  );
  const handlePalletTap = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    palletTap();
    surfaceInfo(false);
  }, [palletTap, surfaceInfo]);

  /** 機種名を上下にスワイプ → 品目の切り替え */
  const swipeRef = useRef<{ y: number; x: number } | null>(null);
  const handleModelDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    // 指が文字の外へ出ても pointerup を受け取れるようにする
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 対応していなければ無視 */ }
    swipeRef.current = { y: e.clientY, x: e.clientX };
  }, []);
  const handleModelUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dy = e.clientY - start.y;
    const dx = e.clientX - start.x;
    if (Math.abs(dy) < SWIPE_Y || Math.abs(dy) < Math.abs(dx)) return;
    if (dy < 0) onNextItem?.();
    else onPrevItem?.();
    // 切り替えた機種をもう一度水面から出す
    surfaceInfo(true);
  }, [onNextItem, onPrevItem, surfaceInfo]);
  const handleModelCancel = useCallback(() => { swipeRef.current = null; }, []);

  // ===== タップの波紋（水滴が落ちた水面） =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    let raf = 0;

    /*
     * 立体的な円ではなく、真上から見た水面の波紋。
     * 落下点から真円のリングが3本、少しずつ遅れて外へ広がっていく。
     */
    const draw = (dt: number) => {
      ctx.clearRect(0, 0, W, H);
      const ripples = ripplesRef.current;
      if (ripples.length === 0) return;
      ctx.globalCompositeOperation = 'screen';
      const maxR = Math.max(W, H) * 0.34;

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.t += dt;
        if (rp.t > RIPPLE_LIFE) { ripples.splice(i, 1); continue; }

        for (let k = 0; k < 3; k++) {
          // 後ろのリングほど遅れて出る
          const t = rp.t - k * 0.16;
          if (t <= 0) continue;
          const p = Math.min(1, t / RIPPLE_LIFE);
          // 広がりは最初が速く、だんだん緩やかに
          const r = maxR * (1 - Math.pow(1 - p, 2.4)) * (1 - k * 0.14) + 6;
          const fade = Math.pow(1 - p, 1.6);
          ctx.globalAlpha = fade * (0.42 - k * 0.1);
          ctx.lineWidth = (2.2 - k * 0.5) * fade + 0.4;
          ctx.strokeStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 落ちた瞬間のしぶき（中心の小さな円が弾けて消える）
        if (rp.t < 0.34) {
          const p = rp.t / 0.34;
          ctx.globalAlpha = (1 - p) * 0.5;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, 3 + p * 16, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVis = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div ref={rootRef} className="river-root" onPointerDown={handleTap}>
      <video
        ref={videoRef}
        className="river-video"
        poster={POSTER}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
        tabIndex={-1}
      >
        <source src={VIDEO_MP4} type="video/mp4" />
        <source src={VIDEO_WEBM} type="video/webm" />
      </video>

      {/* タップの波紋 */}
      <canvas ref={canvasRef} className="river-canvas" />

      {/* 上端: 左に現在時刻（ステータスバーを隠せたときだけ）／右に作業の経過時間 */}
      <div className="river-topbar">
        <span className="river-clock">{ownClock ? clock : ''}</span>
        {workElapsed && <span className="river-elapsed">{workElapsed}</span>}
      </div>

      {/* 川から浮かび上がる品目情報。一度もタップされていない間は描画しない
          （沈むアニメーションが開いた直後に流れてしまうのを防ぐ） */}
      {item && info.key > 0 && (
        <RiverInfo
          item={item}
          shown={info.shown}
          animKey={info.key}
          onPalletTap={handlePalletTap}
          onModelDown={handleModelDown}
          onModelUp={handleModelUp}
          onModelCancel={handleModelCancel}
        />
      )}

      {/* 戻り方のヒント（数秒で消える） */}
      <div className={`river-hint${hintVisible ? '' : ' hide'}`}>
        {item ? 'タップで品目情報／機種名を上下スワイプで切替／下 1/3 で戻る' : '画面の下 1/3 をタップで戻ります'}
      </div>
    </div>
  );
}

/** 水面から現れる品目情報。文字は白のみ、しずくを垂らしながら出てくる */
function RiverInfo({
  item, shown, animKey, onPalletTap, onModelDown, onModelUp, onModelCancel,
}: {
  item: ContainerItem;
  shown: boolean;
  animKey: number;
  onPalletTap: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onModelDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onModelUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onModelCancel: () => void;
}) {
  const { pallets, cartons, pcs } = displayQuantities(item);
  const model = item.representModel?.trim() || item.itemName;

  return (
    /*
     * .river-info は画面いっぱいのマスク層。水面の高さでマスクが切れているので、
     * 中身（.river-info-body）が下から上がってくると水面を境に現れる。
     */
    <div className={`river-stage${shown ? '' : ' hide'}`} key={animKey} aria-hidden={!shown}>
      {/* 水面の光。マスクの外に置いて、水面の位置そのものを光らせる */}
      <div className="river-surface" />
      <div className="river-info">
      <div className="river-info-body">
        <div
          className="river-info-line river-info-model"
          onPointerDown={onModelDown}
          onPointerUp={onModelUp}
          onPointerCancel={onModelCancel}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="river-text">{model}</span>
          <Drips count={6} spread={0.9} />
        </div>
        <div className="river-info-line river-info-nums">
          <button
            type="button"
            className="river-stat river-stat-tap"
            onPointerDown={onPalletTap}
            onClick={(e) => e.stopPropagation()}
            title="タップでパレットを1枚減らす／ダブルタップで1枚戻す"
          >
            <span className="river-text river-stat-num">{pallets}</span>
            <span className="river-text river-stat-label">PL</span>
          </button>
          <span className="river-stat">
            <span className="river-text river-stat-num">{cartons}</span>
            <span className="river-text river-stat-label">CT</span>
          </span>
          <span className="river-stat">
            <span className="river-text river-stat-num river-stat-num-sm">{pcs.toLocaleString()}</span>
            <span className="river-text river-stat-label">pcs</span>
          </span>
          <Drips count={7} spread={0.94} />
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * 文字から垂れるしずく。
 * 水面から出た直後に、あちこちから大きさと速さの違う滴が落ちる。
 * 落ちきったところで水面に当たったしぶきも出す。
 */
function Drips({ count, spread }: { count: number; spread: number }) {
  return (
    <span className="river-drips" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        // 等間隔だと機械的に見えるので、位置を少しずつずらす
        const base = (i + 0.5) / count;
        const jitter = (((i * 37) % 11) / 11 - 0.5) * (0.9 / count);
        const size = 5 + ((i * 5) % 4);
        return (
          <span
            key={i}
            className="river-drip"
            style={{
              left: `${(50 + (base + jitter - 0.5) * spread * 100).toFixed(2)}%`,
              animationDelay: `${1.02 + ((i * 13) % 9) * 0.11}s`,
              animationDuration: `${1.15 + (i % 4) * 0.18}s`,
              width: `${size}px`,
              height: `${size + 1}px`,
            }}
          />
        );
      })}
    </span>
  );
}
