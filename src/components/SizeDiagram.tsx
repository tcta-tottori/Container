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
const CS = Math.cos(A30);
const SN = Math.sin(A30);
function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * CS, (x + y) * SN - z];
}
function pts(...c: [number, number][]): string {
  return c.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/** 参照ボックスの最大サイズ(cm) — 統一枠 */
const REF_MAX = 80;

export default function SizeDiagram({ measurements, cbm, grossWeight, type }: SizeDiagramProps) {
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const dims = measurements ? parseMeas(measurements) : null;

  if (!dims && !cbm) return null;

  // 正規化 (最大辺をREF_MAX基準のスケールに)
  const [w, d, h] = dims || [40, 30, 30];
  const maxDim = Math.max(w, d, h, 1);
  const scale = 28 / maxDim; // 描画空間28単位に正規化
  const sw = w * scale, sd = d * scale, sh = h * scale;

  // 参照枠 (REF_MAX cmのキューブ = 常に同じサイズ)
  const refScale = 28 / REF_MAX;
  const rw = REF_MAX * refScale, rd = REF_MAX * refScale, rh = REF_MAX * refScale;

  // 投影範囲
  const totalW = Math.max(rw, sw), totalD = Math.max(rd, sd), totalH = Math.max(rh, sh) + 2;
  const xL = -totalD * CS - 2;
  const xR = totalW * CS + 2;
  const yB = (totalW + totalD) * SN + 2;
  const yT = -totalH - 4;
  const vw = xR - xL;
  const vh = yB - yT;

  // 面の頂点
  const front = [iso(0, 0, sh), iso(sw, 0, sh), iso(sw, 0, 0), iso(0, 0, 0)] as [number, number][];
  const top = [iso(0, 0, sh), iso(sw, 0, sh), iso(sw, sd, sh), iso(0, sd, sh)] as [number, number][];
  const left = [iso(0, 0, sh), iso(0, sd, sh), iso(0, sd, 0), iso(0, 0, 0)] as [number, number][];

  // 参照枠（薄い破線）
  const refFront = [iso(0, 0, rh), iso(rw, 0, rh), iso(rw, 0, 0), iso(0, 0, 0)] as [number, number][];
  const refTop = [iso(0, 0, rh), iso(rw, 0, rh), iso(rw, rd, rh), iso(0, rd, rh)] as [number, number][];
  const refLeft = [iso(0, 0, rh), iso(0, rd, rh), iso(0, rd, 0), iso(0, 0, 0)] as [number, number][];

  // 寸法ラベル位置
  const wMid = iso(sw / 2, 0, 0);
  const dMid = iso(0, sd / 2, 0);
  const hMid = iso(0, 0, sh / 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', height: '100%' }}>
      <svg width="100%" height="100%"
        viewBox={`${xL} ${yT} ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '100%', flex: 1, minHeight: 0 }}
      >
        {/* 参照枠 (80cm cube, 薄い破線) */}
        <polygon points={pts(...refFront)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.15} strokeDasharray="1,1" />
        <polygon points={pts(...refTop)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.15} strokeDasharray="1,1" />
        <polygon points={pts(...refLeft)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.15} strokeDasharray="1,1" />

        {/* 実物ボックス */}
        <polygon points={pts(...front)} fill={`${colors.accent}35`} stroke={colors.accent} strokeWidth={0.4} strokeLinejoin="round" />
        <polygon points={pts(...top)} fill={`${colors.accent}20`} stroke={colors.accent} strokeWidth={0.4} strokeLinejoin="round" />
        <polygon points={pts(...left)} fill={`${colors.accent}28`} stroke={colors.accent} strokeWidth={0.4} strokeLinejoin="round" />

        {/* 上面ハイライト */}
        <polygon points={pts(...top)} fill="rgba(255,255,255,0.06)" stroke="none" />

        {/* 寸法ラベル */}
        {dims && (
          <>
            <text x={wMid[0]} y={wMid[1] + 3.5} textAnchor="middle"
              style={{ fontSize: 2.8, fill: colors.accent, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {w}
            </text>
            <text x={dMid[0] - 3} y={dMid[1]} textAnchor="middle"
              style={{ fontSize: 2.8, fill: `${colors.accent}bb`, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {d}
            </text>
            <text x={hMid[0] + (sw > 0 ? iso(sw, 0, sh / 2)[0] + 2.5 : 3)} y={hMid[1]}
              textAnchor="start"
              style={{ fontSize: 2.8, fill: `${colors.accent}bb`, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {h}
            </text>
          </>
        )}
      </svg>

      {/* 寸法テキスト情報 */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)',
        flexShrink: 0, paddingBottom: 2,
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
