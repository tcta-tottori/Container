'use client';

import { ItemType } from '@/lib/types';

interface SizeDiagramProps {
  measurements?: string;
  cbm?: number;
  type: ItemType;
  /** コンテナ内の最大寸法（全アイテム共通）。この値を基準にスケーリング */
  maxContainerDim?: number;
}

/** Meas文字列 "55*38*38" → [W, D, H] cm */
export function parseMeas(meas: string): [number, number, number] | null {
  const m = meas.match(/(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * 3D箱のSVGのみ表示（テキストなし）。
 * 添付画像のように前面がしっかり見える立体表示。
 */
export default function SizeDiagram({ measurements, cbm, type, maxContainerDim }: SizeDiagramProps) {
  const dims = measurements ? parseMeas(measurements) : null;
  if (!dims && !cbm) return null;

  const [w, d, h] = dims || [40, 30, 30];

  // maxContainerDimを基準にスケーリング（最大アイテムが画面いっぱい）
  const refDim = maxContainerDim || Math.max(w, d, h, 1);
  const scale = 50 / refDim;
  const sw = w * scale, sd = d * scale, sh = h * scale;

  // 前面がしっかり見える投影角度（やや上方・右寄りから見る）
  const ax = 0.35; // X軸回転（上から見る角度）
  const ay = 0.52; // Y軸回転（右から見る角度）
  const cosX = Math.cos(ax), sinX = Math.sin(ax);
  const cosY = Math.cos(ay), sinY = Math.sin(ay);

  function project(x: number, y: number, z: number): [number, number] {
    // Y軸回転
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    // X軸回転
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    // 透視変換なし（平行投影）
    void z2;
    return [x1, -y1];
  }

  function pts(...c: [number, number][]): string {
    return c.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  }

  // 8頂点（原点を箱の底面中央に）
  const ox = -sw / 2, oz = -sd / 2;
  const v = {
    // 底面
    fbl: project(ox, 0, oz),          // front-bottom-left
    fbr: project(ox + sw, 0, oz),     // front-bottom-right
    bbl: project(ox, 0, oz + sd),     // back-bottom-left
    bbr: project(ox + sw, 0, oz + sd),// back-bottom-right
    // 上面
    ftl: project(ox, sh, oz),          // front-top-left
    ftr: project(ox + sw, sh, oz),     // front-top-right
    btl: project(ox, sh, oz + sd),     // back-top-left
    btr: project(ox + sw, sh, oz + sd),// back-top-right
  };

  // 面の定義（見える3面：前面、右面、上面）
  const frontFace = [v.ftl, v.ftr, v.fbr, v.fbl];
  const rightFace = [v.ftr, v.btr, v.bbr, v.fbr];
  const topFace = [v.ftl, v.btl, v.btr, v.ftr];

  // viewBox計算
  const allPts = Object.values(v);
  const xs = allPts.map(p => p[0]);
  const ys = allPts.map(p => p[1]);
  const pad = 2;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;

  const uid = `box-${type}-${w}-${d}-${h}`;

  return (
    <svg width="100%" height="100%"
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {/* 前面グラデーション — 最も明るい */}
        <linearGradient id={`${uid}-front`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.10)" />
        </linearGradient>
        {/* 右面グラデーション — やや暗い */}
        <linearGradient id={`${uid}-right`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
        </linearGradient>
        {/* 上面グラデーション — 最も明るい */}
        <linearGradient id={`${uid}-top`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
        </linearGradient>
      </defs>

      {/* 右面（奥） */}
      <polygon points={pts(...rightFace)}
        fill={`url(#${uid}-right)`}
        stroke="rgba(255,255,255,0.30)" strokeWidth={0.3} strokeLinejoin="round" />

      {/* 前面（手前） */}
      <polygon points={pts(...frontFace)}
        fill={`url(#${uid}-front)`}
        stroke="rgba(255,255,255,0.40)" strokeWidth={0.3} strokeLinejoin="round" />

      {/* 上面 */}
      <polygon points={pts(...topFace)}
        fill={`url(#${uid}-top)`}
        stroke="rgba(255,255,255,0.40)" strokeWidth={0.3} strokeLinejoin="round" />

      {/* エッジハイライト */}
      <line x1={v.ftl[0]} y1={v.ftl[1]} x2={v.ftr[0]} y2={v.ftr[1]}
        stroke="rgba(255,255,255,0.65)" strokeWidth={0.5} />
      <line x1={v.ftl[0]} y1={v.ftl[1]} x2={v.fbl[0]} y2={v.fbl[1]}
        stroke="rgba(255,255,255,0.55)" strokeWidth={0.4} />
      <line x1={v.ftr[0]} y1={v.ftr[1]} x2={v.btr[0]} y2={v.btr[1]}
        stroke="rgba(255,255,255,0.45)" strokeWidth={0.4} />

      {/* 頂点ハイライト（左上角） */}
      <circle cx={v.ftl[0]} cy={v.ftl[1]} r={0.6}
        fill="rgba(255,255,255,0.8)" />
      <circle cx={v.ftl[0]} cy={v.ftl[1]} r={1.2}
        fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.2} />

      {/* 前面の反射ライン */}
      <line
        x1={v.ftl[0] + (v.ftr[0] - v.ftl[0]) * 0.08 + (v.fbl[0] - v.ftl[0]) * 0.3}
        y1={v.ftl[1] + (v.ftr[1] - v.ftl[1]) * 0.08 + (v.fbl[1] - v.ftl[1]) * 0.3}
        x2={v.ftl[0] + (v.ftr[0] - v.ftl[0]) * 0.55 + (v.fbl[0] - v.ftl[0]) * 0.3}
        y2={v.ftl[1] + (v.ftr[1] - v.ftl[1]) * 0.55 + (v.fbl[1] - v.ftl[1]) * 0.3}
        stroke="rgba(255,255,255,0.10)" strokeWidth={0.3} />
    </svg>
  );
}
