'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface RiverModeProps {
  /** 映像に紛れ込ませる情報（機種名・カートン数など） */
  words: string[];
  onClose: () => void;
}

/** 川面を流れる情報テキスト */
interface FloatWord {
  text: string;
  x: number;      // 0..1（画面幅の割合）
  y: number;      // 0..1
  size: number;
  alpha: number;  // 目標の濃さ
  life: number;   // 経過（秒）
  ttl: number;    // 寿命（秒）
  drift: number;  // 横流れ
  wobble: number; // 揺らぎの位相
}

/** 流れの筋 */
interface Streak {
  x: number; y: number; len: number; w: number; v: number; drift: number; a: number;
}

/** タップの波紋 */
interface Ripple {
  x: number; y: number; t: number;
}

const BASE = process.env.NODE_ENV === 'production' ? '/Container' : '';
const IMG = `${BASE}/images/river.jpg`;
/** 写真から作った水面のマスク（流れの筋を水の上だけに出す） */
const WATER_MASK = `${BASE}/images/river-water-mask.png`;

/** ふわっと光る円のスプライト（流れ・もや・波紋に使い回す） */
function makeBlob(): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * せせらぎモード。
 * 川の写真を背景に、木立が風で揺れ・川面が流れる動きを重ね、
 * 作業中の情報（機種名・カートン数など）を水に紛れ込ませて流す。
 * 右下の ✦ をタップすると元の画面に戻る。
 */
export default function RiverMode({ words, onClose }: RiverModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const wordsRef = useRef(words);
  wordsRef.current = words;
  const ripplesRef = useRef<Ripple[]>([]);
  const [hintVisible, setHintVisible] = useState(true);

  // ヒントは数秒で消す
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 5200);
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

  // タップで波紋
  const handleTap = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    ripplesRef.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t: 0 });
    if (ripplesRef.current.length > 6) ripplesRef.current.shift();
  }, []);

  // ===== 川の流れ・もや・情報テキストの描画 =====
  useEffect(() => {
    const canvas = canvasRef.current;
    const textCanvas = textCanvasRef.current;
    if (!canvas || !textCanvas) return;
    const ctx = canvas.getContext('2d');
    const tctx = textCanvas.getContext('2d');
    if (!ctx || !tctx) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const blob = makeBlob();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      for (const [cv, c2] of [[canvas, ctx], [textCanvas, tctx]] as [HTMLCanvasElement, CanvasRenderingContext2D][]) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    /** 流れは画面中央やや上（上流）から下に向かって広がる */
    const spawnStreak = (initial = false): Streak => {
      const y = initial ? rnd(0.34, 1) : rnd(0.32, 0.42);
      const spread = 0.16 + 0.42 * y;                 // 下に行くほど広がる
      return {
        x: 0.5 + rnd(-spread, spread),
        y,
        len: rnd(0.03, 0.10),
        w: rnd(6, 20),
        v: rnd(0.05, 0.12),
        drift: rnd(-0.05, 0.05),
        a: rnd(0.06, 0.20),
      };
    };
    const spawnWord = (initial = false): FloatWord | null => {
      const list = wordsRef.current;
      if (!list || list.length === 0) return null;
      const y = initial ? rnd(0.4, 0.95) : rnd(0.36, 0.46);
      const spread = 0.1 + 0.3 * y;
      return {
        text: list[Math.floor(Math.random() * list.length)],
        x: 0.5 + rnd(-spread, spread),
        y,
        size: rnd(13, 26),
        alpha: rnd(0.14, 0.42),
        life: 0,
        ttl: rnd(7, 13),
        drift: rnd(-0.03, 0.03),
        wobble: rnd(0, Math.PI * 2),
      };
    };

    const streaks: Streak[] = Array.from({ length: reduced ? 12 : 30 }, () => spawnStreak(true));
    const floats: FloatWord[] = [];
    for (let i = 0; i < 7; i++) {
      const w = spawnWord(true);
      if (w) floats.push(w);
    }

    let time = 0;
    let last = performance.now();
    let raf = 0;

    const draw = (dt: number) => {
      time += dt;
      ctx.clearRect(0, 0, W, H);
      tctx.clearRect(0, 0, W, H);

      // --- 流れの筋（水面マスクで水の上だけに出る） ---
      ctx.globalCompositeOperation = 'screen';
      for (const s of streaks) {
        // 下流ほど速くなる
        const accel = 0.45 + 1.7 * s.y;
        s.y += s.v * accel * dt;
        s.x += s.drift * dt * accel;
        if (s.y > 1.08) Object.assign(s, spawnStreak());
        const len = s.len * H * (0.6 + s.y);
        const wob = Math.sin(time * 1.4 + s.x * 12) * 3;
        // 画面中央付近（水面）だけに乗せる
        const fade = s.y < 0.4 ? Math.max(0, (s.y - 0.3) / 0.1) : 1;
        ctx.globalAlpha = s.a * fade;
        ctx.drawImage(blob, s.x * W - s.w / 2 + wob, s.y * H - len / 2, s.w, len);
      }

      // --- タップの波紋 ---
      const ripples = ripplesRef.current;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.t += dt;
        if (rp.t > 1.8) { ripples.splice(i, 1); continue; }
        const p = rp.t / 1.8;
        const r = 20 + p * 130;
        ctx.globalAlpha = (1 - p) * 0.35;
        ctx.lineWidth = 2 * (1 - p) + 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, r, r * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // --- 水に紛れた情報テキスト（マスクなしのレイヤー） ---
      ctx.globalCompositeOperation = 'source-over';
      tctx.textAlign = 'center';
      tctx.textBaseline = 'middle';
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.life += dt;
        const accel = 0.4 + 1.5 * f.y;
        f.y += 0.028 * accel * dt;
        f.x += f.drift * dt;
        if (f.life > f.ttl || f.y > 1.06) {
          const next = spawnWord();
          if (next) floats[i] = next; else floats.splice(i, 1);
          continue;
        }
        // 出入りのフェード + ゆらぎ
        const fadeIn = Math.min(1, f.life / 1.6);
        const fadeOut = Math.min(1, (f.ttl - f.life) / 2);
        const shimmer = 0.72 + 0.28 * Math.sin(time * 1.1 + f.wobble);
        const wob = Math.sin(time * 0.9 + f.wobble) * 6;
        tctx.globalAlpha = f.alpha * fadeIn * fadeOut * shimmer;
        tctx.font = `600 ${f.size}px var(--font-ui), sans-serif`;
        tctx.fillStyle = '#eafcff';
        tctx.shadowColor = 'rgba(4, 30, 40, 0.85)';
        tctx.shadowBlur = 10;
        tctx.fillText(f.text, f.x * W + wob, f.y * H);
      }
      tctx.shadowBlur = 0;
      tctx.globalAlpha = 1;
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // タブが隠れている間は止める
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
    <div className="river-root" onPointerDown={handleTap}>
      {/* 背景の川 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="river-layer river-base" src={IMG} alt="" draggable={false} />
      {/* 木立（上部）を風で揺らす */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="river-layer river-canopy" src={IMG} alt="" draggable={false} aria-hidden="true" />
      {/* 川面: 同じ写真を水面マスクで切り出し、下流へずらしながら交互にフェードして「流れ」を作る */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="river-layer river-water river-water-a" src={IMG} alt="" draggable={false} aria-hidden="true"
        style={{ WebkitMaskImage: `url(${WATER_MASK})`, maskImage: `url(${WATER_MASK})` }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="river-layer river-water river-water-b" src={IMG} alt="" draggable={false} aria-hidden="true"
        style={{ WebkitMaskImage: `url(${WATER_MASK})`, maskImage: `url(${WATER_MASK})` }}
      />
      {/* 上流のもや */}
      <div className="river-mist" aria-hidden="true" />
      {/* 流れ・波紋（写真から作った水面マスクの内側だけに描く） */}
      <canvas
        ref={canvasRef}
        className="river-canvas"
        style={{ WebkitMaskImage: `url(${WATER_MASK})`, maskImage: `url(${WATER_MASK})` }}
      />
      {/* 水に紛れて流れる情報テキスト */}
      <canvas ref={textCanvasRef} className="river-canvas river-text-canvas" />

      {/* 戻るボタン（写真の輝きと同じ位置の ✦） */}
      <button
        className="river-exit"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
        aria-label="作業画面に戻る"
        title="タップで戻る"
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2c.5 4.3 1.8 6.6 4.6 7.6C13.8 10.6 12.5 13 12 17c-.5-4-1.8-6.4-4.6-7.4C10.2 8.6 11.5 6.3 12 2z" />
          <path d="M18.6 14c.25 2 .9 3.1 2.4 3.6-1.5.5-2.15 1.6-2.4 3.6-.25-2-.9-3.1-2.4-3.6 1.5-.5 2.15-1.6 2.4-3.6z" opacity="0.75" />
        </svg>
      </button>

      {/* 操作ヒント */}
      <div className={`river-hint${hintVisible ? '' : ' hide'}`}>
        右下の ✦ をタップで戻ります
      </div>
    </div>
  );
}
