'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ContainerItem } from '@/lib/types';
import { displayQuantities } from '@/lib/itemQuantity';
import { usePalletTap } from '@/hooks/usePalletTap';
import { ThermometerIcon, HumidityIcon } from '@/components/AppIcons';
import { isRiverWaterFxEnabled } from '@/lib/riverSettings';
import PalletDiagram from './PalletDiagram';

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
  /** 経過時間の下に出す気温・湿度（SwitchBot があれば実測、なければ気象庁） */
  climate?: { temperature: number; humidity: number } | null;
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
/** 端数パレットの自動回転（作業画面と同じ 15 秒で1回転） */
const FRACTION_SPIN_DEG_PER_SEC = 360 / 15;
/** 端数パレットを触ってから自動回転に戻るまで */
const FRACTION_IDLE_MS = 2500;

/* ===== 水越しの歪み（SVG フィルタ） ===== */
/** フィルタの id。CSS の filter: url(#...) から参照する */
const WATER_FX_ID = 'riverWaterFx';
/** 出てくるときに歪みが収まるまでの時間(ms)。出現アニメと合わせる */
const FX_IN_MS = 1600;
/** 沈むときに歪みが強くなるまでの時間(ms)。沈むアニメと合わせる */
const FX_OUT_MS = 1400;
/** 歪みの最大量(px)。これ以上だと文字が読めなくなる */
const FX_MAX = 16;

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
  onClose, item, onDecreasePallet, onIncreasePallet, onNextItem, onPrevItem, workElapsed, climate,
}: RiverModeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const [hintVisible, setHintVisible] = useState(true);
  /** 品目情報が浮かび上がっているか。key を変えると出現アニメをやり直す */
  const [info, setInfo] = useState<{ shown: boolean; key: number }>({ shown: false, key: 0 });
  const infoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 水越しの歪みを掛けるか（設定ページで切り替える。開いたときの値を使う） */
  const [waterFx] = useState(() => isRiverWaterFxEnabled());
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

  /** 端数パレットを上下スワイプ → 品目の切り替え（機種名と同じ操作） */
  const handleFractionSwipeY = useCallback((dy: number) => {
    if (dy < 0) onNextItem?.();
    else onPrevItem?.();
    surfaceInfo(true);
  }, [onNextItem, onPrevItem, surfaceInfo]);

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
        <span className="river-topbar-right">
          {workElapsed && <span className="river-elapsed">{workElapsed}</span>}
          {climate && (
            <span className="river-climate">
              <span className="river-climate-item river-climate-temp">
                <ThermometerIcon size={13} strokeWidth={2} />
                {climate.temperature}<span className="river-climate-unit">°C</span>
              </span>
              <span className="river-climate-item river-climate-hum">
                <HumidityIcon size={12} strokeWidth={2} />
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
          shown={info.shown}
          animKey={info.key}
          onPalletTap={handlePalletTap}
          onModelDown={handleModelDown}
          onModelUp={handleModelUp}
          onModelCancel={handleModelCancel}
          onFractionSwipeY={handleFractionSwipeY}
          waterFx={waterFx}
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
  item, shown, animKey, onPalletTap, onModelDown, onModelUp, onModelCancel, onFractionSwipeY, waterFx,
}: {
  item: ContainerItem;
  shown: boolean;
  animKey: number;
  onPalletTap: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onModelDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onModelUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onModelCancel: () => void;
  onFractionSwipeY: (dy: number) => void;
  waterFx: boolean;
}) {
  const { pallets, cartons, pcs } = displayQuantities(item);
  const model = item.representModel?.trim() || item.itemName;

  /* 残りが端数ケースだけになったら、作業画面と同じように端数パレットの積み方を出す */
  const fractionOnly = pallets === 0 && cartons > 0 && item.qtyPerPallet > 0;

  const bodyRef = useRef<HTMLDivElement>(null);
  const dispRef = useRef<SVGFEDisplacementMapElement>(null);
  useWaterDistortion(waterFx, shown, bodyRef, dispRef);

  return (
    /*
     * .river-info は画面いっぱいのマスク層。水面の高さでマスクが切れているので、
     * 中身（.river-info-body）が下から上がってくると水面を境に現れる。
     */
    <div className={`river-stage${shown ? '' : ' hide'}`} key={animKey} aria-hidden={!shown}>
      {waterFx && <WaterFxDefs dispRef={dispRef} />}
      <div className="river-info">
      <div ref={bodyRef} className={`river-info-body${fractionOnly ? ' with-fraction' : ''}`}>
        <div
          className="river-info-line river-info-model"
          onPointerDown={onModelDown}
          onPointerUp={onModelUp}
          onPointerCancel={onModelCancel}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="river-text">{model}</span>
        </div>
        {fractionOnly && <FractionPallet item={item} cartons={cartons} onSwipeY={onFractionSwipeY} />}
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
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * 端数パレットの積み方。
 * 機種名と同じく水面から出てきて、出ている間はゆっくり回り続ける。
 * 横スワイプで手回し、しばらく触らなければ自動回転に戻る。上下スワイプは品目の切り替え。
 */
function FractionPallet({
  item, cartons, onSwipeY,
}: {
  item: ContainerItem;
  cartons: number;
  onSwipeY: (dy: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  /** 表示中の角度。React を挟むとカクつくので ref で持って DOM に直接書く */
  const rotRef = useRef(-35);
  /** 最後に触った時刻。ここから一定時間たつと自動回転に戻る */
  const lastActRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number; lastX: number; moved: boolean } | null>(null);

  // 回転はここで一括して行う（自動回転・手回しのどちらも DOM へ直接反映）
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (now - lastActRef.current > FRACTION_IDLE_MS && !dragRef.current) {
        rotRef.current += FRACTION_SPIN_DEG_PER_SEC * dt;
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
    if (Math.abs(e.clientX - d.x) > 4 || Math.abs(e.clientY - d.y) > 4) d.moved = true;
    // 画面幅いっぱいのスワイプで半回転（作業画面の全画面表示と同じ感覚）
    rotRef.current += (dx / Math.max(1, window.innerWidth)) * 180;
    lastActRef.current = performance.now();
  }, []);

  const onUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    dragRef.current = null;
    lastActRef.current = performance.now();
    if (!d) return;
    const dy = e.clientY - d.y;
    const dx = e.clientX - d.x;
    if (Math.abs(dy) >= SWIPE_Y && Math.abs(dy) > Math.abs(dx)) onSwipeY(dy);
  }, [onSwipeY]);

  return (
    <div
      ref={boxRef}
      className="river-fraction"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { dragRef.current = null; }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="river-fraction-scale">
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
    </div>
  );
}

/**
 * 水越しに見える歪みのフィルタ定義。
 * feTurbulence で作った雲状のノイズを feDisplacementMap の変位量に使い、
 * 文字を水面ごしに見たようにゆがませる。
 * ノイズは1回作れば良いので毎フレーム作り直さず、揺れ幅（scale）だけを動かす。
 */
function WaterFxDefs({ dispRef }: { dispRef: React.Ref<SVGFEDisplacementMapElement> }) {
  return (
    <svg className="river-fx-defs" aria-hidden focusable="false">
      <filter
        id={WATER_FX_ID}
        x="-25%" y="-25%" width="150%" height="150%"
        colorInterpolationFilters="sRGB"
        filterUnits="objectBoundingBox"
      >
        {/* 横に長く伸びたゆるやかなノイズ。水面のうねりに近い形になる */}
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.008 0.02"
          numOctaves={1}
          seed={7}
          result="noise"
        />
        {/*
          ノイズをぼかしてから使うのが肝心。
          そのまま使うと変位が急に変わって文字の縁がギザギザに裂けてしまう。
          ぼかすと変位がなだらかにつながり、文字は読めるまま水面ごしのように波打つ。
          ノイズは動かさないので、このぼかしは1回計算されるだけで毎フレームの負担にはならない。
        */}
        <feGaussianBlur in="noise" stdDeviation={3} result="softNoise" />
        <feDisplacementMap
          ref={dispRef}
          in="SourceGraphic"
          in2="softNoise"
          scale={0}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

/**
 * 歪みの掛かり具合を時間で動かす。
 * 出てくるときは大きな歪みから 0 へ（水から上がって落ち着く）、
 * 沈むときは 0 から大きな歪みへ（水に入っていく）。
 * 落ち着いたらフィルタ自体を外して、描画の負担を残さないようにする。
 */
function useWaterDistortion(
  enabled: boolean,
  shown: boolean,
  bodyRef: React.RefObject<HTMLDivElement | null>,
  dispRef: React.RefObject<SVGFEDisplacementMapElement | null>,
) {
  useEffect(() => {
    if (!enabled) return;
    const body = bodyRef.current;
    const disp = dispRef.current;
    if (!body || !disp) return;

    const dur = shown ? FX_IN_MS : FX_OUT_MS;
    const t0 = performance.now();
    let raf = 0;

    body.style.filter = `url(#${WATER_FX_ID})`;

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      // 出るときは収まる方向、沈むときは強くなる方向
      const amount = shown ? Math.pow(1 - p, 1.7) : Math.pow(p, 1.4);
      disp.setAttribute('scale', (FX_MAX * amount).toFixed(2));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else if (shown) {
        // 落ち着いたらフィルタを外す（掛けっぱなしは文字がにじむし重い）
        body.style.filter = '';
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      body.style.filter = '';
    };
  }, [enabled, shown, bodyRef, dispRef]);
}
