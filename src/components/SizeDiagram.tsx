'use client';

import { COLOR_MAP } from '@/data/colorMap';
import { ItemType } from '@/lib/types';

interface SizeDiagramProps {
  measurements?: string;
  cbm?: number;
  grossWeight?: number;
  type: ItemType;
}

/** Meas文字列 "55*38*38" → [W, D, H] cm */
function parseMeas(meas: string): [number, number, number] | null {
  const m = meas.match(/(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** アイソメトリック投影 */
const A30 = Math.PI / 6;
const COS = Math.cos(A30);
const SIN = Math.sin(A30);
function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * COS, (x + y) * SIN - z];
}
function pts(...c: [number, number][]): string {
  return c.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

export default function SizeDiagram({ measurements, cbm, grossWeight, type }: SizeDiagramProps) {
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const dims = measurements ? parseMeas(measurements) : null;

  if (!dims && !cbm) return null;

  const [w, d, h] = dims || [40, 30, 30];
  const maxDim = Math.max(w, d, h, 1);
  const scale = 28 / maxDim;
  const sw = w * scale, sd = d * scale, sh = h * scale;

  // 投影範囲
  const totalH = sh + 4;
  const xL = -sd * COS - 3;
  const xR = sw * COS + 3;
  const yB = (sw + sd) * SIN + 3;
  const yT = -totalH - 3;
  const vw = xR - xL;
  const vh = yB - yT;

  // 面の頂点
  const front = [iso(0, 0, sh), iso(sw, 0, sh), iso(sw, 0, 0), iso(0, 0, 0)] as [number, number][];
  const top = [iso(0, 0, sh), iso(sw, 0, sh), iso(sw, sd, sh), iso(0, sd, sh)] as [number, number][];
  const left = [iso(0, 0, sh), iso(0, sd, sh), iso(0, sd, 0), iso(0, 0, 0)] as [number, number][];

  // エッジハイライト
  const topFrontEdge = [iso(0, 0, sh), iso(sw, 0, sh)];
  const topLeftEdge = [iso(0, 0, sh), iso(0, sd, sh)];
  const topCorner = iso(0, 0, sh);

  // 寸法ラベル位置
  const wMid = iso(sw / 2, 0, 0);
  const dMid = iso(0, sd / 2, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, width: '100%', height: '100%' }}>
      <svg width="100%" height="100%"
        viewBox={`${xL} ${yT} ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '100%', flex: 1, minHeight: 0 }}
      >
        <defs>
          <linearGradient id={`face-front-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
          </linearGradient>
          <linearGradient id={`face-left-${type}`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
          </linearGradient>
          <linearGradient id={`face-top-${type}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
        </defs>

        {/* 正面 — 半透明グラデーション */}
        <polygon points={pts(...front)}
          fill={`url(#face-front-${type})`}
          stroke="rgba(255,255,255,0.35)" strokeWidth={0.3} strokeLinejoin="round" />

        {/* 左面 — 少し暗い半透明 */}
        <polygon points={pts(...left)}
          fill={`url(#face-left-${type})`}
          stroke="rgba(255,255,255,0.25)" strokeWidth={0.3} strokeLinejoin="round" />

        {/* 上面 — 明るい半透明 */}
        <polygon points={pts(...top)}
          fill={`url(#face-top-${type})`}
          stroke="rgba(255,255,255,0.35)" strokeWidth={0.3} strokeLinejoin="round" />

        {/* 上面の前辺エッジハイライト — 白い光 */}
        <line x1={topFrontEdge[0][0]} y1={topFrontEdge[0][1]}
          x2={topFrontEdge[1][0]} y2={topFrontEdge[1][1]}
          stroke="rgba(255,255,255,0.6)" strokeWidth={0.5} />
        <line x1={topLeftEdge[0][0]} y1={topLeftEdge[0][1]}
          x2={topLeftEdge[1][0]} y2={topLeftEdge[1][1]}
          stroke="rgba(255,255,255,0.45)" strokeWidth={0.4} />

        {/* 頂点のスターハイライト */}
        <circle cx={topCorner[0]} cy={topCorner[1]} r={0.8}
          fill="rgba(255,255,255,0.7)" />
        <circle cx={topCorner[0]} cy={topCorner[1]} r={1.5}
          fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={0.2} />

        {/* 正面の反射ライン */}
        <line x1={front[0][0] + (front[1][0] - front[0][0]) * 0.1}
          y1={front[0][1] + (front[3][1] - front[0][1]) * 0.3}
          x2={front[0][0] + (front[1][0] - front[0][0]) * 0.6}
          y2={front[0][1] + (front[3][1] - front[0][1]) * 0.3}
          stroke="rgba(255,255,255,0.12)" strokeWidth={0.3} />

        {/* 寸法ラベル */}
        {dims && (
          <>
            <text x={wMid[0]} y={wMid[1] + 3.5} textAnchor="middle"
              style={{ fontSize: 2.8, fill: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {w}
            </text>
            <text x={dMid[0] - 3} y={dMid[1]} textAnchor="middle"
              style={{ fontSize: 2.8, fill: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {d}
            </text>
            <text x={iso(sw, 0, sh / 2)[0] + 2.5} y={iso(sw, 0, sh / 2)[1]}
              textAnchor="start"
              style={{ fontSize: 2.8, fill: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {h}
            </text>
          </>
        )}
      </svg>

      {/* 寸法テキスト情報 — 右揃え */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end',
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)',
        flexShrink: 0, paddingBottom: 2, width: '100%',
      }}>
        {dims && (
          <span style={{ color: colors.accent, fontWeight: 700, fontSize: 11 }}>
            {w}×{d}×{h}<span style={{ fontSize: 8, opacity: 0.6 }}>cm</span>
          </span>
        )}
        {cbm != null && cbm > 0 && (
          <span>{cbm.toFixed(2)}<span style={{ fontSize: 8, opacity: 0.6 }}>m³</span></span>
        )}
        {grossWeight != null && grossWeight > 0 && (
          <span>{grossWeight.toFixed(1)}<span style={{ fontSize: 8, opacity: 0.6 }}>kg</span></span>
        )}
      </div>
    </div>
  );
}
