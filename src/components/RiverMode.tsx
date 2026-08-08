'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface RiverModeProps {
  onClose: () => void;
}

/** タップの波紋 */
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

/** ふわっと光る円のスプライト（波紋に使う） */
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
 * 川のループ動画を全画面で流す休憩用の表示。
 * 画面上側のタップは波紋が広がるだけ、下 1/3 をタップすると元の画面に戻る。
 */
export default function RiverMode({ onClose }: RiverModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  // ===== タップの波紋 =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    let last = performance.now();
    let raf = 0;

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, W, H);
      const ripples = ripplesRef.current;
      if (ripples.length === 0) return;
      ctx.globalCompositeOperation = 'screen';
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.t += dt;
        if (rp.t > 1.8) { ripples.splice(i, 1); continue; }
        const p = rp.t / 1.8;
        const r = 20 + p * 130;
        ctx.globalAlpha = (1 - p) * 0.32;
        ctx.lineWidth = 2 * (1 - p) + 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, r, r * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        // 中心のきらめき
        ctx.globalAlpha = (1 - p) * 0.14;
        ctx.drawImage(blob, rp.x - r * 0.5, rp.y - r * 0.22, r, r * 0.44);
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
    <div className="river-root" onPointerDown={handleTap}>
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

      {/* 戻り方のヒント（数秒で消える） */}
      <div className={`river-hint${hintVisible ? '' : ' hide'}`}>
        画面の下 1/3 をタップで戻ります
      </div>
    </div>
  );
}
