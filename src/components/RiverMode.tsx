'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ContainerItem } from '@/lib/types';
import { displayQuantities } from '@/lib/itemQuantity';
import { usePalletTap } from '@/hooks/usePalletTap';
import { useCountUp } from '@/hooks/useCountUp';
import PalletDiagram from './PalletDiagram';
import { playSurfacing, playSubmerging } from '@/lib/waterSplash';
import { getWaterSoundEngine } from '@/lib/waterSound';

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
  /** 作業の経過時間（右上に出す） */
  workElapsed?: string;
  /** 経過時間の下に出す気温・湿度（SwitchBot があれば実測、なければ気象庁） */
  climate?: { temperature: number; humidity: number } | null;
}

/** タップの波紋（水滴が落ちた水面） */
interface Ripple {
  x: number; y: number; t: number;
  /** 広がりの大きさ。しずくが落ちた小さな輪は 1 より小さくする */
  s?: number;
}

/**
 * 品目情報が水面から出てくるときの、水面のほう。
 * 盛り上がり → 割れて広がる輪 → 飛んだしずくが落ちて戻る、を1つの出来事として持つ。
 */
interface Surfacing {
  /** 経過時間(秒) */
  t: number;
  /** 出てくる(true) か 沈む(false) か */
  up: boolean;
  /** 飛び散ったしずく */
  drops: Drop[];
}

/** 水面から飛んだしずく。落ちて水面に当たると小さな輪を残す */
interface Drop {
  x: number; y: number; vx: number; vy: number;
  /** 落ちて消えたか */
  dead: boolean;
  r: number;
}

/** 水面の高さ（画面に対する割合）。CSS の --river-waterline と合わせる */
const WATERLINE_FALLBACK = 0.6;
/** 出てくる水面表現の長さ(秒)。文字がせり上がる時間に合わせる */
const SURFACE_LIFE = 1.7;
/** 水面を横から見ているので、輪は縦につぶれた楕円で描く */
const SURFACE_FLATTEN = 0.26;

const BASE = process.env.NODE_ENV === 'production' ? '/Container' : '';
/**
 * 川のループ動画（約10秒・H.264・音声つき）。
 * せせらぎモードの音は、この動画に入っている川の音を使う。
 */
const VIDEO_MP4 = `${BASE}/videos/river-loop.mp4`;

/** 浮かび上がった品目情報が沈むまでの時間 */
const INFO_MS = 9000;
/** 機種名のスワイプを切り替えとみなす縦の移動量(px) */
const SWIPE_Y = 42;
/** 画面を横にこれだけ動かしたら、せせらぎモードを終わる */
const EXIT_SWIPE_X = 70;
/** これ以下の動きはタップ扱い */
const TAP_SLOP = 10;
/*
 * 出入りの靄。
 * 入るときは、元の画面に白い靄がかかって真っ白になり、そこから晴れて川が出てくる。
 * 戻るときはその逆で、川が白く覆われてから元の画面が現れる。
 */
/** 元の画面が真っ白になるまで（入るとき） */
const MIST_IN_MS = 850;
/** 真っ白から川が見えてくるまで */
const MIST_CLEAR_MS = 1300;
/** 靄が覆いつくすまで（閉じるとき）。この後に元の画面へ戻る */
const MIST_OUT_MS = 850;

/** 表示の段階 */
type RiverPhase = 'fog-in' | 'clearing' | 'shown' | 'fog-out';

/** 波紋1つの寿命(秒)。指を離したあたりで消える短さ */
const RIPPLE_LIFE = 1.5;
/** 波紋の広がる大きさ（画面の短い辺に対する割合）。触った所の周りだけ揺れる */
const RIPPLE_MAX_R = 0.13;

/* ===== 端数パレットの全画面表示（作業画面と同じ見せ方） ===== */
/** 小さい状態から全画面へ広がる時間 */
const PFS_IN_MS = 1400;
/** 全画面から消えるまでの時間 */
const PFS_OUT_MS = 900;
/** 全画面を出しておく時間。触ると最後の操作から数え直す */
const PFS_HOLD_MS = 7000;
/** スワイプをやめてから自動回転に戻るまでの間 */
const PFS_SPIN_DELAY_MS = 300;
/** 自動回転の初速（度/秒）。勢いよく回り始める */
const PFS_SPIN_DPS_START = 260;
/** 落ち着いたあとの速さ（15秒で1回転）。作業画面と同じ */
const PFS_SPIN_DPS_END = 360 / 15;
/** 初速から終速へ近づく時定数（秒） */
const PFS_SPIN_EASE_SEC = 1.8;
/** 画面幅いっぱいのスワイプで回る角度 */
const PFS_SWIPE_DEG = 180;
/** 既定の見る角度 */
const PFS_ROT_Y0 = -35;
/** PalletDiagram の実寸(70px幅)を全画面まで広げる倍率 */
const PFS_SCALE = 4.1;
/** 出はじめ・引っこむときの倍率 */
const PFS_SCALE_FROM = 1.15;

/** 時刻を HH:MM で返す */
function nowHhMm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * せせらぎモード。
 * 川のループ動画を全画面（ステータスバー領域まで）で流す休憩用の表示。
 * 開始と終了は靄が流れるように切り替わる。
 * 画面タップで品目情報の出し入れ、横スワイプで元の画面へ戻る。
 */
export default function RiverMode({
  onClose, item, onDecreasePallet, onIncreasePallet, onNextItem, onPrevItem, workElapsed, climate,
}: RiverModeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  /** いま進行中の「水面が割れる」表現。無いときは null */
  const surfaceRef = useRef<Surfacing | null>(null);
  const [hintVisible, setHintVisible] = useState(true);
  /** 品目情報が浮かび上がっているか。key を変えると出現アニメをやり直す */
  const [info, setInfo] = useState<{ shown: boolean; key: number }>({ shown: false, key: 0 });
  const infoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 表示の段階。靄がかかる→晴れる→表示中→靄が覆う、と進む */
  const [phase, setPhase] = useState<RiverPhase>('fog-in');
  const closingRef = useRef(false);
  /** 端数パレットの全画面表示を出しているか */
  const [palletFs, setPalletFs] = useState(false);
  /** 全画面（ステータスバーを消せた）かどうか。消せたときだけ自前の時計を出す */
  const [ownClock, setOwnClock] = useState(false);
  const [clock, setClock] = useState('');

  /** 靄をかけてから元の画面へ戻る */
  const closeWithMist = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setPhase('fog-out');
    setTimeout(onClose, MIST_OUT_MS);
  }, [onClose]);

  // 開いた直後: 元の画面が白くなる → 川を出す → 靄が晴れる
  useEffect(() => {
    const toClear = setTimeout(() => {
      if (!closingRef.current) setPhase('clearing');
    }, MIST_IN_MS);
    const toShown = setTimeout(() => {
      if (!closingRef.current) setPhase('shown');
    }, MIST_IN_MS + MIST_CLEAR_MS);
    return () => { clearTimeout(toClear); clearTimeout(toShown); };
  }, []);

  /** 水面が割れる／呑まれる表現を始める */
  const startSurfacing = useCallback((up: boolean) => {
    const drops: Drop[] = [];
    if (up) {
      // 割れた水面から飛び散るしずく。中心ほど高く上がる
      const n = 7;
      for (let i = 0; i < n; i++) {
        // 等間隔だと落ちた跡が並んでしまうので、位置も速さもばらつかせる
        const spread = ((i + Math.random() * 0.8) / n) * 2 - 1; // -1..1
        drops.push({
          x: spread * (0.2 + Math.random() * 0.18),
          y: 0,
          vx: spread * (0.12 + Math.random() * 0.12),
          vy: -(0.5 + Math.random() * 0.75) * (1 - Math.abs(spread) * 0.4),
          dead: false,
          r: 1.1 + Math.random() * 1.6,
        });
      }
    }
    surfaceRef.current = { t: 0, up, drops };
    if (up) playSurfacing();
    else playSubmerging();
  }, []);

  /*
   * 出す・沈めるは、水面表現と音を1回だけ鳴らしたいので
   * 「いま出ているか」を ref でも持っておき、状態更新の外で判断する。
   */
  const shownRef = useRef(false);

  /** 情報を浮かび上がらせて、一定時間で沈める */
  const surfaceInfo = useCallback((restart: boolean) => {
    const fresh = restart || !shownRef.current;
    shownRef.current = true;
    if (fresh) startSurfacing(true);
    setInfo((prev) => ({ shown: true, key: fresh ? prev.key + 1 : prev.key }));

    if (infoTimer.current) clearTimeout(infoTimer.current);
    infoTimer.current = setTimeout(() => {
      infoTimer.current = null;
      if (!shownRef.current) return;
      shownRef.current = false;
      startSurfacing(false);
      setInfo((prev) => ({ ...prev, shown: false }));
    }, INFO_MS);
  }, [startSurfacing]);

  /** 情報を川に沈める */
  const sinkInfo = useCallback(() => {
    if (infoTimer.current) { clearTimeout(infoTimer.current); infoTimer.current = null; }
    if (!shownRef.current) return;
    shownRef.current = false;
    startSurfacing(false);
    setInfo((prev) => ({ ...prev, shown: false }));
  }, [startSurfacing]);

  useEffect(() => () => { if (infoTimer.current) clearTimeout(infoTimer.current); }, []);

  // ヒントは数秒で消す
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Esc でも戻れる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWithMist(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeWithMist]);

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

  /*
   * 再生と音。
   *
   * 自動再生は「音が出ない」ことが条件なので、まず消音のまま流し始めて、
   * 流れ出してから音を出す（せせらぎモードはタップで開くので、この形なら通る）。
   * 音の大きさは「水の音」設定に合わせるので、絞っていれば小さく、0 なら鳴らない。
   */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const applyVolume = () => {
      let vol = 0.4;
      try { vol = getWaterSoundEngine().getVolume(); } catch { /* 既定のまま */ }
      v.volume = Math.max(0, Math.min(1, vol));
      v.muted = vol <= 0.001;
    };

    const play = () => {
      v.muted = true;
      void v.play()
        .then(() => {
          applyVolume();
          /*
           * 音を出した拍子に止められる端末があるため、その場合は
           * 消音に戻してでも映像だけは流し続ける（真っ暗になるのを防ぐ）。
           */
          window.setTimeout(() => {
            if (v.paused) { v.muted = true; void v.play().catch(() => { /* ignore */ }); }
          }, 300);
        })
        .catch(() => { /* 再生できなくても表示は続ける */ });
    };
    play();

    // 「水の音」の音量を動かしたら、こちらにも効かせる
    let unsubscribe: (() => void) | null = null;
    try { unsubscribe = getWaterSoundEngine().subscribe(applyVolume); } catch { /* ignore */ }

    const onVis = () => { if (!document.hidden) play(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      unsubscribe?.();
    };
  }, []);

  /* ===== 数量。端数だけになったら作業画面と同じように積み方を全画面で出す ===== */
  const quantities = item ? displayQuantities(item) : null;
  const fractionOnly = !!item && !!quantities
    && quantities.pallets === 0 && quantities.cartons > 0 && item.qtyPerPallet > 0;
  /** 自動表示は1品目につき1回だけ */
  const autoShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!item || !fractionOnly) return;
    if (autoShownRef.current === item.id) return;
    autoShownRef.current = item.id;
    setPalletFs(true);
  }, [item, fractionOnly]);

  /**
   * 画面の操作。
   * 横スワイプで元の画面へ戻り、タップは品目情報の出し入れ。
   */
  const gestureRef = useRef<{ x: number; y: number } | null>(null);
  const handleDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    gestureRef.current = { x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    ripplesRef.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t: 0 });
    if (ripplesRef.current.length > 6) ripplesRef.current.shift();
  }, []);
  const handleUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = gestureRef.current;
    gestureRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) >= EXIT_SWIPE_X && Math.abs(dx) > Math.abs(dy)) {
      closeWithMist();
      return;
    }
    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) return;
    if (!item) return;
    if (info.shown) sinkInfo();
    else surfaceInfo(true);
  }, [closeWithMist, item, info.shown, sinkInfo, surfaceInfo]);

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

  /** カートン数のタップ → 端数パレットの積み方を全画面で見る */
  const handleCartonTap = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (quantities && quantities.cartons > 0) setPalletFs(true);
  }, [quantities]);

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
    // 機種名の上でも、横に大きく払ったらせせらぎモードを終わる
    if (Math.abs(dx) >= EXIT_SWIPE_X && Math.abs(dx) > Math.abs(dy)) { closeWithMist(); return; }
    if (Math.abs(dy) < SWIPE_Y || Math.abs(dy) < Math.abs(dx)) return;
    if (dy < 0) onNextItem?.();
    else onPrevItem?.();
    // 切り替えた機種をもう一度水面から出す
    surfaceInfo(true);
  }, [onNextItem, onPrevItem, surfaceInfo, closeWithMist]);
  const handleModelCancel = useCallback(() => { swipeRef.current = null; }, []);

  // ===== タップの波紋（水滴が落ちた水面） =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;

    // 水面の高さは CSS 側（--river-waterline）に合わせる
    const waterlineRaw = getComputedStyle(document.documentElement)
      .getPropertyValue('--river-waterline').trim();
    const parsed = parseFloat(waterlineRaw);
    const waterline = Number.isFinite(parsed) ? parsed / 100 : WATERLINE_FALLBACK;

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
     * 水滴が落ちた水面。触った所の周りだけが小さく揺れる。
     *
     * 本物の波紋は、外へ広がる山と谷が交互に並ぶ。
     * 明るい線（山）のすぐ内側に暗い線（谷）を重ねて、水面が凹んで見えるようにしている。
     */
    /*
     * 品目情報が水面から出てくるところ。
     *
     * 1. 水面が下から押されて盛り上がる
     * 2. 割れて、輪が横へ広がる
     * 3. 飛んだしずくが落ちて、当たった所に小さな輪が残る
     *
     * 水面は横から見ているので、輪はどれも縦につぶした楕円で描く。
     */
    const drawSurfacing = (dt: number, waterY: number) => {
      const s = surfaceRef.current;
      if (!s) return;
      s.t += dt;
      if (s.t > SURFACE_LIFE) { surfaceRef.current = null; return; }

      const cx = W / 2;
      const p = s.t / SURFACE_LIFE;

      if (s.up) {
        // 1. 盛り上がり（押し上げられて、割れると同時にしぼむ）
        const swell = s.t < 0.42 ? Math.sin((s.t / 0.42) * Math.PI) : 0;
        if (swell > 0.01) {
          const rx = W * 0.3 * (0.45 + swell * 0.55);
          const ry = rx * SURFACE_FLATTEN;
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = swell * 0.3;
          const g = ctx.createRadialGradient(cx, waterY - ry * 0.5, 1, cx, waterY, rx);
          g.addColorStop(0, 'rgba(236,248,255,0.9)');
          g.addColorStop(0.55, 'rgba(190,222,236,0.35)');
          g.addColorStop(1, 'rgba(190,222,236,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(cx, waterY - ry * 0.35, rx, ry * 1.25, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. 横へ広がる輪
        for (let k = 0; k < 3; k++) {
          const t = s.t - (0.24 + k * 0.2);
          if (t <= 0) continue;
          const q = Math.min(1, t / 1.1);
          const rx = W * (0.12 + 0.62 * (1 - Math.pow(1 - q, 2.3)));
          const ry = rx * SURFACE_FLATTEN;
          const fade = Math.pow(1 - q, 1.8) * (1 - k * 0.24);
          if (fade <= 0.01) continue;

          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = fade * 0.42;
          ctx.lineWidth = 2 * fade + 0.5;
          ctx.strokeStyle = '#eaf6ff';
          ctx.beginPath();
          ctx.ellipse(cx, waterY, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();

          // 輪のすぐ内側の影。水面が波打っているように見える
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = fade * 0.22;
          ctx.lineWidth = 2.2 * fade + 0.4;
          ctx.strokeStyle = '#587a8c';
          ctx.beginPath();
          ctx.ellipse(cx, waterY + 1.5, Math.max(1, rx - 5), Math.max(1, ry - 1.4), 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 3. しずく
        ctx.globalCompositeOperation = 'screen';
        for (const d of s.drops) {
          if (d.dead) continue;
          d.vy += 2.1 * dt;          // 落ちる
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          if (d.y >= 0 && d.vy > 0) {
            d.dead = true;
            // 落ちた所に小さな波紋を残す
            ripplesRef.current.push({ x: cx + d.x * W * 0.5, y: waterY, t: 0, s: 0.3 + Math.random() * 0.15 });
            if (ripplesRef.current.length > 10) ripplesRef.current.shift();
            continue;
          }
          const px = cx + d.x * W * 0.5;
          const py = waterY + d.y * H * 0.17;
          ctx.globalAlpha = Math.min(1, 0.75 - p * 0.3);
          ctx.fillStyle = 'rgba(238,250,255,0.9)';
          ctx.beginPath();
          // 落ちる速さに合わせて縦に伸ばすと、しずくらしく見える
          ctx.ellipse(px, py, d.r, d.r * (1 + Math.min(1.6, Math.abs(d.vy) * 1.1)), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // 沈むとき。水面がへこんで、内へ吸い込まれる輪ができる
        const dip = s.t < 0.6 ? Math.sin((s.t / 0.6) * Math.PI) : 0;
        if (dip > 0.01) {
          const rx = W * 0.34;
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = dip * 0.3;
          const g = ctx.createRadialGradient(cx, waterY, 1, cx, waterY, rx);
          g.addColorStop(0, 'rgba(60,92,106,0.9)');
          g.addColorStop(1, 'rgba(60,92,106,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(cx, waterY, rx, rx * SURFACE_FLATTEN * 1.3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let k = 0; k < 2; k++) {
          const t = s.t - k * 0.22;
          if (t <= 0) continue;
          const q = Math.min(1, t / 0.95);
          const rx = W * (0.5 - 0.36 * q);   // 内側へ縮む
          const fade = Math.pow(1 - q, 1.6) * (1 - k * 0.3);
          if (fade <= 0.01) continue;
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = fade * 0.3;
          ctx.lineWidth = 1.8 * fade + 0.4;
          ctx.strokeStyle = '#dcecf6';
          ctx.beginPath();
          ctx.ellipse(cx, waterY, Math.max(1, rx), Math.max(1, rx * SURFACE_FLATTEN), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, W, H);
      drawSurfacing(dt, H * waterline);
      const ripples = ripplesRef.current;
      if (ripples.length === 0) return;
      const maxR = Math.min(W, H) * RIPPLE_MAX_R;

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.t += dt;
        if (rp.t > RIPPLE_LIFE) { ripples.splice(i, 1); continue; }

        for (let k = 0; k < 3; k++) {
          // 後ろの輪ほど遅れて出て、内側に残る
          const t = rp.t - k * 0.13;
          if (t <= 0) continue;
          const p = Math.min(1, t / RIPPLE_LIFE);
          // 広がりは最初が速く、だんだん緩やかに
          const r = maxR * (rp.s ?? 1) * (1 - Math.pow(1 - p, 2.6)) * (1 - k * 0.1) + 3;
          const fade = Math.pow(1 - p, 1.9) * (1 - k * 0.22);
          if (fade <= 0.01) continue;

          // 山（明るい側）
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = fade * 0.34;
          ctx.lineWidth = 1.5 * fade + 0.5;
          ctx.strokeStyle = '#eaf6ff';
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, r, 0, Math.PI * 2);
          ctx.stroke();

          // 谷（すぐ内側の影）。これがあると水面が凹んで見える
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = fade * 0.2;
          ctx.lineWidth = 1.8 * fade + 0.4;
          ctx.strokeStyle = '#5d7f92';
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, Math.max(1, r - 2.4 - k * 0.6), 0, Math.PI * 2);
          ctx.stroke();
        }

        // 落ちた瞬間のへこみ（中心が小さく沈んで戻る）
        if (rp.t < 0.22) {
          const p = rp.t / 0.22;
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = (1 - p) * 0.42;
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = '#eaf6ff';
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, 2 + p * 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
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
    /*
     * 靄がかかりきるまでは、この層を透かして元の画面を見せる（背景も中身も出さない）。
     * 真っ白になってから川に入れ替わるので、切り替わる瞬間が見えない。
     */
    <div
      ref={rootRef}
      className={`river-root${phase === 'fog-in' ? ' bare' : ''}`}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
    >
      <div className="river-content">
      <video
        ref={videoRef}
        className="river-video"
        autoPlay
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
        tabIndex={-1}
      >
        <source src={VIDEO_MP4} type="video/mp4" />
      </video>

      {/* タップの波紋 */}
      <canvas ref={canvasRef} className="river-canvas" />

      {/* 上端: 左に現在時刻（ステータスバーを隠せたときだけ）／右に経過時間・気温・湿度 */}
      <div className="river-topbar">
        <span className="river-clock">{ownClock ? clock : ''}</span>
        <span className="river-topbar-right">
          {workElapsed && <span className="river-elapsed">{workElapsed}</span>}
          {climate && (
            <span className="river-climate">
              <span className="river-climate-temp">
                {climate.temperature}<span className="river-climate-unit">°C</span>
              </span>
              <span className="river-climate-hum">
                {Math.round(climate.humidity)}<span className="river-climate-unit">%</span>
              </span>
            </span>
          )}
        </span>
      </div>

      {/* 川から浮かび上がる品目情報。一度もタップされていない間は描画しない
          （沈むアニメーションが開いた直後に流れてしまうのを防ぐ） */}
      {item && info.key > 0 && (
        <RiverInfo
          item={item}
          /* 端数パレットを全画面で見ている間は、下の文字を沈めておく */
          shown={info.shown && !palletFs}
          animKey={info.key}
          onPalletTap={handlePalletTap}
          onCartonTap={handleCartonTap}
          onModelDown={handleModelDown}
          onModelUp={handleModelUp}
          onModelCancel={handleModelCancel}
        />
      )}

      {/* 端数パレットの積み方（作業画面と同じ全画面表示） */}
      {palletFs && item && quantities && quantities.cartons > 0 && (
        <RiverPalletFs
          item={item}
          cartons={quantities.cartons}
          onDone={() => setPalletFs(false)}
        />
      )}

      {/* 戻り方のヒント（数秒で消える） */}
      <div className={`river-hint${hintVisible ? '' : ' hide'}`}>
        {item
          ? 'タップで情報・上下スワイプで機種切替・横スワイプで戻る'
          : '横にスワイプすると戻ります'}
      </div>
      </div>{/* river-content 閉じ */}

      {/* 出入りの靄。かかる → 晴れる → （戻るとき）また覆う */}
      {phase !== 'shown' && (
        <div className={`river-mist ${phase}`} aria-hidden />
      )}
    </div>
  );
}

/** 水面から現れる品目情報 */
function RiverInfo({
  item, shown, animKey, onPalletTap, onCartonTap, onModelDown, onModelUp, onModelCancel,
}: {
  item: ContainerItem;
  shown: boolean;
  animKey: number;
  onPalletTap: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onCartonTap: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onModelDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onModelUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onModelCancel: () => void;
}) {
  const { pallets, cartons, pcs } = displayQuantities(item);
  const model = item.representModel?.trim() || item.itemName;

  // カートンと総数は作業画面と同じように数字が動く
  const animCT = useCountUp(cartons, String(animKey));
  const animPCS = useCountUp(pcs, String(animKey));

  /*
   * 数えている途中は桁が少ないので、そのままだと幅が変わって PL / CT / pcs の位置がずれる。
   * 最後の値の文字数ぶんの幅を先に確保しておけば、桁が増えても並びが動かない。
   */
  const ctWidth = `${String(cartons).length}ch`;
  const pcsWidth = `${pcs.toLocaleString().length}ch`;
  const plWidth = `${String(pallets).length}ch`;

  return (
    /*
     * .river-info は画面いっぱいのマスク層。水面の高さでマスクが切れているので、
     * 中身（.river-info-body）が下から上がってくると水面を境に現れる。
     */
    <div className={`river-stage${shown ? '' : ' hide'}`} key={animKey} aria-hidden={!shown}>
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
          </div>
          <div className="river-info-line river-info-nums">
            <button
              type="button"
              className="river-stat river-stat-tap"
              onPointerDown={onPalletTap}
              onClick={(e) => e.stopPropagation()}
              title="タップでパレットを1枚減らす／ダブルタップで1枚戻す"
            >
              <span className="river-text river-stat-num" style={{ minWidth: plWidth }}>{pallets}</span>
              <span className="river-text river-stat-label">PL</span>
            </button>
            <button
              type="button"
              className="river-stat river-stat-tap"
              onPointerDown={onCartonTap}
              onClick={(e) => e.stopPropagation()}
              title="タップで端数パレットの積み方を見る"
            >
              <span className="river-text river-stat-num" style={{ minWidth: ctWidth }}>{animCT}</span>
              <span className="river-text river-stat-label">CT</span>
            </button>
            <span className="river-stat">
              <span
                className="river-text river-stat-num river-stat-num-sm"
                style={{ minWidth: pcsWidth }}
              >
                {animPCS.toLocaleString()}
              </span>
              <span className="river-text river-stat-label">pcs</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 端数パレットの積み方を全画面で見せる（作業画面の全画面表示と同じ見せ方）。
 * 小さい状態から回りながら広がり、7秒たつと縮んで消える。
 * 横スワイプで手回しでき、触ると表示時間を数え直す。図をタップするとすぐ閉じる。
 */
function RiverPalletFs({
  item, cartons, onDone,
}: {
  item: ContainerItem;
  cartons: number;
  onDone: () => void;
}) {
  /** 'in' = 広がり中 / 'show' = 表示中 / 'out' = 縮んで消える */
  const [phase, setPhase] = useState<'in' | 'show' | 'out'>('in');
  const boxRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef(PFS_ROT_Y0);
  /** 最後に触った時刻。ここから少し置くと自動回転に戻る */
  const lastActRef = useRef(0);
  /** 自動回転を始めた時刻。ここからの経過で回転速度を落としていく */
  const spinT0Ref = useRef(0);
  const dragRef = useRef<{ x: number; y: number; lastX: number; moved: boolean } | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 表示時間を数え直す */
  const bumpHold = useCallback(() => {
    if (holdRef.current) clearTimeout(holdRef.current);
    holdRef.current = setTimeout(() => setPhase('out'), PFS_HOLD_MS);
  }, []);

  // 広がりきったら表示状態へ
  useEffect(() => {
    if (phase !== 'in') return;
    const t = setTimeout(() => setPhase('show'), PFS_IN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // 表示に入ったところから7秒数える
  useEffect(() => {
    if (phase !== 'show') return;
    bumpHold();
    return () => { if (holdRef.current) clearTimeout(holdRef.current); };
  }, [phase, bumpHold]);

  // 縮みきったら片付ける
  useEffect(() => {
    if (phase !== 'out') return;
    const t = setTimeout(onDone, PFS_OUT_MS);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  /*
   * 回転。React の再描画を挟むとカクつくので、角度は ref に持って
   * 毎フレーム DOM の transform を直接書き換える。
   * 触っていない間は勢いよく回り始め、作業画面と同じ速さまで徐々に落ちる。
   */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    spinT0Ref.current = performance.now();
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragRef.current && now - lastActRef.current > PFS_SPIN_DELAY_MS) {
        const elapsed = (now - spinT0Ref.current) / 1000;
        const dps = PFS_SPIN_DPS_END
          + (PFS_SPIN_DPS_START - PFS_SPIN_DPS_END) * Math.exp(-elapsed / PFS_SPIN_EASE_SEC);
        rotRef.current += dps * dt;
      }
      const body = box.querySelector<HTMLElement>('[data-pallet-body]');
      if (body) body.style.transform = `rotateX(-25deg) rotateY(${rotRef.current}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 対応していなければ無視 */ }
    dragRef.current = { x: e.clientX, y: e.clientY, lastX: e.clientX, moved: false };
    lastActRef.current = performance.now();
  }, []);

  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const dx = e.clientX - d.lastX;
    d.lastX = e.clientX;
    if (Math.abs(e.clientX - d.x) > TAP_SLOP || Math.abs(e.clientY - d.y) > TAP_SLOP) d.moved = true;
    rotRef.current += (dx / Math.max(1, window.innerWidth)) * PFS_SWIPE_DEG;
    lastActRef.current = performance.now();
  }, []);

  const onUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    dragRef.current = null;
    lastActRef.current = performance.now();
    // 回すのをやめたところから、また減速させる
    spinT0Ref.current = performance.now();
    if (d && !d.moved) { setPhase('out'); return; }
    if (phase === 'show') bumpHold();
  }, [phase, bumpHold]);

  // 出はじめと引っこむときは小さく、表示中は全画面いっぱいまで広げる
  const scale = phase === 'show' ? PFS_SCALE : PFS_SCALE_FROM;
  const ms = phase === 'out' ? PFS_OUT_MS : PFS_IN_MS;

  return (
    <div
      className="river-pfs"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { dragRef.current = null; }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={boxRef}
        className="river-pfs-box"
        style={{
          transform: `scale(${scale})`,
          opacity: phase === 'out' ? 0 : 1,
          transition: `transform ${ms}ms cubic-bezier(0.33,0.1,0.2,1), opacity ${ms}ms ease`,
        }}
      >
        <PalletDiagram
          palletCount={0}
          fraction={cartons}
          qtyPerPallet={item.qtyPerPallet}
          type={item.type}
          itemName={item.itemName}
          measurements={item.measurements}
          overrideRotateY={0}
          noIntro
        />
      </div>
      <div className="river-pfs-cap">
        <span className="river-text river-pfs-cap-num">{cartons}</span>
        <span className="river-text river-pfs-cap-label">CT</span>
      </div>
    </div>
  );
}
