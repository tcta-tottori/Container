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
 * 添付画像のような透明ガラスキューブを描画。
 * - 正面が大きく見える角度
 * - 半透明の面（背面エッジが透けて見える）
 * - 明るいエッジハイライト
 */
export default function SizeDiagram({ measurements, cbm, type, maxContainerDim }: SizeDiagramProps) {
  const dims = measurements ? parseMeas(measurements) : null;
  if (!dims && !cbm) return null;

  const [w, d, h] = dims || [40, 30, 30];

  // maxContainerDimを基準にスケーリング
  const refDim = maxContainerDim || Math.max(w, d, h, 1);
  const scale = 100 / refDim;
  const sw = w * scale, sd = d * scale, sh = h * scale;

  // アイソメトリック投影（添付画像に近い角度）
  // 参照画像: 正面が最も大きく、右面と上面がやや見える角度
  // 30度のアイソメトリックをベースに、正面が支配的な角度に調整
  const angX = 25 * Math.PI / 180; // 上方から見下ろす角度（25度）
  const angY = 35 * Math.PI / 180; // 右方向への回転（35度）

  const cosX = Math.cos(angX), sinX = Math.sin(angX);
  const cosY = Math.cos(angY), sinY = Math.sin(angY);

  function project(x: number, y: number, z: number): [number, number] {
    // Y軸回転 → X軸回転
    const rx = x * cosY + z * sinY;
    const rz = -x * sinY + z * cosY;
    const ry = y * cosX + rz * sinX;
    const rz2 = -y * sinX + rz * cosX;
    void rz2;
    return [rx, -ry];
  }

  function p2s(pt: [number, number]): string {
    return `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`;
  }

  function pts(...c: [number, number][]): string {
    return c.map(p2s).join(' ');
  }

  // 8頂点（原点を底面中央に）
  const ox = -sw / 2, oz = -sd / 2;

  // 底面4頂点
  const fbl = project(ox, 0, oz);           // 前-下-左
  const fbr = project(ox + sw, 0, oz);      // 前-下-右
  const bbl = project(ox, 0, oz + sd);      // 奥-下-左
  const bbr = project(ox + sw, 0, oz + sd); // 奥-下-右

  // 上面4頂点
  const ftl = project(ox, sh, oz);           // 前-上-左
  const ftr = project(ox + sw, sh, oz);      // 前-上-右
  const btl = project(ox, sh, oz + sd);      // 奥-上-左
  const btr = project(ox + sw, sh, oz + sd); // 奥-上-右

  // viewBox計算
  const allPts = [fbl, fbr, bbl, bbr, ftl, ftr, btl, btr];
  const xs = allPts.map(p => p[0]);
  const ys = allPts.map(p => p[1]);
  const pad = 3;
  const minX = Math.min(...xs) - pad;
  const maxXv = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxYv = Math.max(...ys) + pad;

  const uid = `box3d-${type}-${w}-${d}-${h}`;

  return (
    <svg width="100%" height="100%"
      viewBox={`${minX} ${minY} ${maxXv - minX} ${maxYv - minY}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {/* 前面（最も明るい面） */}
        <linearGradient id={`${uid}-front`} x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="rgba(220,220,230,0.22)" />
          <stop offset="50%" stopColor="rgba(200,200,215,0.16)" />
          <stop offset="100%" stopColor="rgba(180,180,195,0.12)" />
        </linearGradient>
        {/* 右面（やや暗い） */}
        <linearGradient id={`${uid}-right`} x1="0%" y1="0%" x2="100%" y2="80%">
          <stop offset="0%" stopColor="rgba(200,200,215,0.18)" />
          <stop offset="100%" stopColor="rgba(160,160,180,0.08)" />
        </linearGradient>
        {/* 上面（最も明るく光が当たる） */}
        <linearGradient id={`${uid}-top`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(230,230,240,0.24)" />
          <stop offset="100%" stopColor="rgba(210,210,225,0.14)" />
        </linearGradient>
        {/* ガラスハイライト */}
        <radialGradient id={`${uid}-glow`} cx="30%" cy="25%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* === 背面エッジ（透明キューブなので透けて見える） === */}
      {/* 奥-下辺 */}
      <line x1={bbl[0]} y1={bbl[1]} x2={bbr[0]} y2={bbr[1]}
        stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} />
      {/* 奥-左辺 */}
      <line x1={bbl[0]} y1={bbl[1]} x2={btl[0]} y2={btl[1]}
        stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} />
      {/* 奥-右辺（下） */}
      <line x1={bbr[0]} y1={bbr[1]} x2={btr[0]} y2={btr[1]}
        stroke="rgba(255,255,255,0.06)" strokeWidth={0.3} />
      {/* 前-下-左→奥-下-左 */}
      <line x1={fbl[0]} y1={fbl[1]} x2={bbl[0]} y2={bbl[1]}
        stroke="rgba(255,255,255,0.07)" strokeWidth={0.3} />
      {/* 前-下-右→奥-下-右 */}
      <line x1={fbr[0]} y1={fbr[1]} x2={bbr[0]} y2={bbr[1]}
        stroke="rgba(255,255,255,0.06)" strokeWidth={0.3} />

      {/* === 面の塗り（半透明ガラス） === */}
      {/* 右面 */}
      <polygon points={pts(ftr, btr, bbr, fbr)}
        fill={`url(#${uid}-right)`} />

      {/* 前面 */}
      <polygon points={pts(ftl, ftr, fbr, fbl)}
        fill={`url(#${uid}-front)`} />

      {/* 上面 */}
      <polygon points={pts(ftl, btl, btr, ftr)}
        fill={`url(#${uid}-top)`} />

      {/* 前面にガラスのハイライト（光の反射） */}
      <polygon points={pts(ftl, ftr, fbr, fbl)}
        fill={`url(#${uid}-glow)`} />

      {/* === 前面エッジ（明るい） === */}
      {/* 前面-下辺 */}
      <line x1={fbl[0]} y1={fbl[1]} x2={fbr[0]} y2={fbr[1]}
        stroke="rgba(255,255,255,0.35)" strokeWidth={0.5} />
      {/* 前面-左辺 */}
      <line x1={ftl[0]} y1={ftl[1]} x2={fbl[0]} y2={fbl[1]}
        stroke="rgba(255,255,255,0.45)" strokeWidth={0.6} />
      {/* 前面-右辺 */}
      <line x1={ftr[0]} y1={ftr[1]} x2={fbr[0]} y2={fbr[1]}
        stroke="rgba(255,255,255,0.30)" strokeWidth={0.5} />

      {/* === 上面エッジ（最も明るい） === */}
      {/* 上面-前辺（最も目立つ水平線） */}
      <line x1={ftl[0]} y1={ftl[1]} x2={ftr[0]} y2={ftr[1]}
        stroke="rgba(255,255,255,0.70)" strokeWidth={0.8} />
      {/* 上面-左辺 */}
      <line x1={ftl[0]} y1={ftl[1]} x2={btl[0]} y2={btl[1]}
        stroke="rgba(255,255,255,0.40)" strokeWidth={0.5} />
      {/* 上面-右辺 */}
      <line x1={ftr[0]} y1={ftr[1]} x2={btr[0]} y2={btr[1]}
        stroke="rgba(255,255,255,0.35)" strokeWidth={0.5} />
      {/* 上面-奥辺 */}
      <line x1={btl[0]} y1={btl[1]} x2={btr[0]} y2={btr[1]}
        stroke="rgba(255,255,255,0.20)" strokeWidth={0.4} />

      {/* === 頂点ハイライト（左上角＝最も光が当たる） === */}
      <circle cx={ftl[0]} cy={ftl[1]} r={1.0}
        fill="rgba(255,255,255,0.90)" />
      <circle cx={ftl[0]} cy={ftl[1]} r={2.0}
        fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth={0.3} />

      {/* 右上角のサブハイライト */}
      <circle cx={ftr[0]} cy={ftr[1]} r={0.5}
        fill="rgba(255,255,255,0.40)" />

      {/* 中央の縦エッジ接点ハイライト */}
      <circle cx={ftr[0]} cy={ftr[1]} r={0.3}
        fill="rgba(255,255,255,0.50)" />
    </svg>
  );
}
