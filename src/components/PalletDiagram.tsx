'use client';

import { ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface PalletDiagramProps {
  palletCount: number;
  fraction: number;
  qtyPerPallet: number;
  type: ItemType;
}

/* ===== アイソメトリック ===== */
const A30 = Math.PI / 6;
const CS = Math.cos(A30);
const SN = Math.sin(A30);
function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * CS, (x + y) * SN - z];
}
function p(...c: [number, number][]): string {
  return c.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/*
 * アイソメトリックの可視面:
 * 視線方向 = (+1, +1, -1) → 手前に向く法線は (-x, -y, +z) 方向
 * 可視面: x=min (左面), y=min (正面), z=max (上面)
 */

/* ===== 段ボール箱（3面: 左面・正面・上面） ===== */
function Box({ x, y, z, w, d, h, ghost, accent }: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  ghost: boolean; accent: string;
}) {
  if (ghost) {
    const q = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)] as [number, number][];
    return <polygon points={p(...q)} fill="none" stroke={accent} strokeWidth={0.15} strokeDasharray="1,1" opacity={0.15} />;
  }

  // 左面 (x=x): 画面の左下方向 — 最も暗い
  const left = [
    iso(x, y, z + h), iso(x, y + d, z + h),
    iso(x, y + d, z), iso(x, y, z),
  ] as [number, number][];

  // 正面 (y=y): 画面の右下方向 — 中間の明るさ
  const front = [
    iso(x, y, z + h), iso(x + w, y, z + h),
    iso(x + w, y, z), iso(x, y, z),
  ] as [number, number][];

  // 上面 (z=z+h): 画面の上方向 — 最も明るい
  const top = [
    iso(x, y, z + h), iso(x + w, y, z + h),
    iso(x + w, y + d, z + h), iso(x, y + d, z + h),
  ] as [number, number][];

  // テープ（上面の中央帯）
  const tw = w * 0.14;
  const tx = x + (w - tw) / 2;
  const tapeTop = [
    iso(tx, y, z + h), iso(tx + tw, y, z + h),
    iso(tx + tw, y + d, z + h), iso(tx, y + d, z + h),
  ] as [number, number][];

  // テープ（正面にたれる部分）
  const tapeFront = [
    iso(tx, y, z + h), iso(tx + tw, y, z + h),
    iso(tx + tw, y, z + h * 0.82), iso(tx, y, z + h * 0.82),
  ] as [number, number][];

  return (
    <g>
      {/* 左面 (暗め) */}
      <polygon points={p(...left)} fill="#c4923a" stroke="#8a6520" strokeWidth={0.5} strokeLinejoin="round" />
      {/* 正面 (中間) */}
      <polygon points={p(...front)} fill="#dba84e" stroke="#8a6520" strokeWidth={0.5} strokeLinejoin="round" />
      {/* 上面 (明るい) */}
      <polygon points={p(...top)} fill="#efd07a" stroke="#8a6520" strokeWidth={0.5} strokeLinejoin="round" />
      {/* テープ */}
      <polygon points={p(...tapeTop)} fill="rgba(255,255,255,0.35)" stroke="none" />
      <polygon points={p(...tapeFront)} fill="rgba(255,255,255,0.25)" stroke="none" />
    </g>
  );
}

/* ===== パレット台（3面: 左面・正面・上面） ===== */
function Pallet({ x, y, z, w, d, h }: {
  x: number; y: number; z: number; w: number; d: number; h: number;
}) {
  const sk = '#2d3636';

  // 左面 (x=x)
  const left = [
    iso(x, y, z + h), iso(x, y + d, z + h),
    iso(x, y + d, z), iso(x, y, z),
  ] as [number, number][];

  // 正面 (y=y)
  const front = [
    iso(x, y, z + h), iso(x + w, y, z + h),
    iso(x + w, y, z), iso(x, y, z),
  ] as [number, number][];

  // 上面 (z=z+h)
  const top = [
    iso(x, y, z + h), iso(x + w, y, z + h),
    iso(x + w, y + d, z + h), iso(x, y + d, z + h),
  ] as [number, number][];

  // フォークリフト穴（正面: y=y の面）
  const hw = w * 0.2, hh = h * 0.5, hz = z + h * 0.15;
  const forkFront = [0.15, 0.55].map((pct, i) => {
    const hx = x + w * pct;
    const q = [
      iso(hx, y, hz + hh), iso(hx + hw, y, hz + hh),
      iso(hx + hw, y, hz), iso(hx, y, hz),
    ] as [number, number][];
    return <polygon key={`ff${i}`} points={p(...q)} fill="#222c2c" stroke={sk} strokeWidth={0.3} />;
  });

  // フォークリフト穴（左面: x=x の面）
  const forkLeft = [0.15, 0.55].map((pct, i) => {
    const hy = y + d * pct;
    const hd = d * 0.2;
    const q = [
      iso(x, hy, hz + hh), iso(x, hy + hd, hz + hh),
      iso(x, hy + hd, hz), iso(x, hy, hz),
    ] as [number, number][];
    return <polygon key={`fl${i}`} points={p(...q)} fill="#222c2c" stroke={sk} strokeWidth={0.3} />;
  });

  return (
    <g>
      {/* 左面 (暗め) */}
      <polygon points={p(...left)} fill="#525c5c" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      {/* 正面 (中間) */}
      <polygon points={p(...front)} fill="#687070" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      {/* 上面 (明るい) */}
      <polygon points={p(...top)} fill="#8a9494" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      {forkLeft}{forkFront}
    </g>
  );
}

/* ===== 1パレットスタック: 3列 x 3行 x 2段 = 18スロット ===== */
function Stack({ ox, oy, filled, accent }: {
  ox: number; oy: number; filled: number; accent: string;
}) {
  const PW = 22, PD = 22, PH = 3;
  const cols = 3, rows = 3, layers = 2;
  const perLayer = cols * rows; // 9
  const bw = PW / cols, bd = PD / rows, bh = 7;
  const g = 0.4;

  let topL = 0;
  for (let l = 0; l < layers; l++) {
    if (filled > l * perLayer) topL = l;
  }
  const dL = filled > 0 ? topL + 1 : 1;

  const elems: JSX.Element[] = [];
  elems.push(<Pallet key="pl" x={0} y={0} z={0} w={PW} d={PD} h={PH} />);

  // 描画順序: 下→上, 奥→手前(y大→小), 右→左(x大→小)
  for (let l = 0; l < dL; l++) {
    const z = PH + l * bh;
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = cols - 1; c >= 0; c--) {
        const idx = l * perLayer + r * cols + c;
        elems.push(
          <Box key={`${l}-${r}-${c}`}
            x={c * bw + g} y={r * bd + g} z={z}
            w={bw - g * 2} d={bd - g * 2} h={bh - g}
            ghost={idx >= filled} accent={accent} />
        );
      }
    }
  }
  return <g transform={`translate(${ox},${oy})`}>{elems}</g>;
}

/* ===== メイン ===== */
export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type,
}: PalletDiagramProps) {
  void qtyPerPallet;
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const hasFrac = fraction > 0;
  const showTwo = palletCount >= 2 || (palletCount >= 1 && hasFrac);

  // 端数はケース数そのままで表示（最大18スロット）
  const slots = 18;
  const mapFrac = (n: number) => Math.min(Math.ceil(n), slots);

  // 投影範囲の計算
  const PW = 22, PD = 22, PH = 3, totalZ = PH + 2 * 7;
  const xL = -PD * CS;
  const xR = PW * CS;
  const yB = (PW + PD) * SN;
  const yT = -totalZ;
  const oneW = xR - xL;
  const oneH = yB - yT;
  const sp = oneW * 0.12;

  const n = showTwo ? 2 : 1;
  const svgW = n * oneW + (n > 1 ? sp : 0) + 4;
  const svgH = oneH + 4;

  return (
    <div className="pallet-diagram-container">
      <svg width="100%" height="100%"
        viewBox={`${xL - 2} ${yT - 2} ${svgW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '110px' }}
      >
        {showTwo ? (
          <>
            <Stack ox={0} oy={0}
              filled={hasFrac ? mapFrac(fraction) : slots}
              accent={colors.accent} />
            <Stack ox={oneW + sp} oy={0}
              filled={slots}
              accent={colors.accent} />
          </>
        ) : (
          <Stack ox={0} oy={0}
            filled={hasFrac ? mapFrac(fraction) : slots}
            accent={colors.accent} />
        )}
      </svg>
    </div>
  );
}
