'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface RiverModeProps {
  onClose: () => void;
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
/** 写真から作った水面のマスク（動くのは水の上だけ） */
const WATER_MASK = `${BASE}/images/river-water-mask.png`;
/** 写真から作った枝葉のマスク（揺れるのは葉だけ。幹・石・地面は動かさない） */
const LEAF_MASK = `${BASE}/images/river-leaf-mask.png`;

/** 画面下側のこの割合をタップすると閉じる */
const CLOSE_ZONE = 1 / 3;

/** ふわっと光る円のスプライト（流れ・波紋に使い回す） */
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
 * 川の写真を背景に、川の流れ・枝葉の揺れ・靄だけを動かす（地面・石・木の根元は止めたまま）。
 * 画面下 1/3 をタップすると元の画面に戻る。
 */
export default function RiverMode({ onClose }: RiverModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  /** 下 1/3 をタップで閉じる。それ以外は波紋が広がるだけ */
  const handleTap = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y > rect.height * (1 - CLOSE_ZONE)) {
      onClose();
      return;
    }
    ripplesRef.current.push({ x: e.clientX - rect.left, y, t: 0 });
    if (ripplesRef.current.length > 6) ripplesRef.current.shift();
  }, [onClose]);

  // ===== 川の流れ・波紋の描画 =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const blob = makeBlob();
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

    const streaks: Streak[] = Array.from({ length: reduced ? 12 : 30 }, () => spawnStreak(true));

    let time = 0;
    let last = performance.now();
    let raf = 0;

    const draw = (dt: number) => {
      time += dt;
      ctx.clearRect(0, 0, W, H);

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
      {/* 背景（地面・石・木の根元はここで静止したまま） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="river-layer river-base" src={IMG} alt="" draggable={false} />

      {/* 枝葉だけを風で揺らす。マスクは動かない外枠に掛け、中の写真だけを動かす */}
      <div
        className="river-clip"
        aria-hidden="true"
        style={{ WebkitMaskImage: `url(${LEAF_MASK})`, maskImage: `url(${LEAF_MASK})` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="river-layer river-canopy" src={IMG} alt="" draggable={false} />
      </div>

      {/* 川面: 水面マスクの内側で写真を下流へずらし、2枚を交互にフェードして流れを作る */}
      <div
        className="river-clip"
        aria-hidden="true"
        style={{ WebkitMaskImage: `url(${WATER_MASK})`, maskImage: `url(${WATER_MASK})` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="river-layer river-water river-water-a" src={IMG} alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="river-layer river-water river-water-b" src={IMG} alt="" draggable={false} />
      </div>

      {/* 上流の靄 */}
      <div className="river-mist" aria-hidden="true" />

      {/* 流れ・波紋（水面マスクの内側だけ） */}
      <canvas
        ref={canvasRef}
        className="river-canvas"
        style={{ WebkitMaskImage: `url(${WATER_MASK})`, maskImage: `url(${WATER_MASK})` }}
      />

      {/* 戻り方のヒント（数秒で消える） */}
      <div className={`river-hint${hintVisible ? '' : ' hide'}`}>
        画面の下 1/3 をタップで戻ります
      </div>
    </div>
  );
}
