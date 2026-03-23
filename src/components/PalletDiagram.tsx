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

/* ===== 段ボール箱（3面を明確に描画） ===== */
function Box({ x, y, z, w, d, h, ghost, accent }: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  ghost: boolean; accent: string;
}) {
  if (ghost) {
    const q = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)] as [number, number][];
    return <polygon points={p(...q)} fill="none" stroke={accent} strokeWidth={0.15} strokeDasharray="1,1" opacity={0.15} />;
  }

  // 3面をすべて描画（front=左手前面, right=右手前面, top=上面）
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const right = [iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z)] as [number, number][];
  const top   = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];

  // テープ（上面の中央帯）
  const tw = w * 0.15;
  const tx = x + (w - tw) / 2;
  const tape = [iso(tx, y, z + h), iso(tx + tw, y, z + h), iso(tx + tw, y + d, z + h), iso(tx, y + d, z + h)] as [number, number][];

  // テープの正面部分
  const tapeFront = [iso(tx, y, z + h), iso(tx + tw, y, z + h), iso(tx + tw, y, z + h - h * 0.15), iso(tx, y, z + h - h * 0.15)] as [number, number][];

  return (
    <g>
      {/* front face (左手前) - 明るめ */}
      <polygon points={p(...front)} fill="#dba84e" stroke="#96692a" strokeWidth={0.5} strokeLinejoin="round" />
      {/* right face (右手前) - 少し暗め */}
      <polygon points={p(...right)} fill="#c4923a" stroke="#96692a" strokeWidth={0.5} strokeLinejoin="round" />
      {/* top face (上面) - 最も明るい */}
      <polygon points={p(...top)} fill="#efd07a" stroke="#96692a" strokeWidth={0.5} strokeLinejoin="round" />
      {/* テープ */}
      <polygon points={p(...tape)} fill="rgba(255,255,255,0.35)" stroke="none" />
      <polygon points={p(...tapeFront)} fill="rgba(255,255,255,0.25)" stroke="none" />
    </g>
  );
}

/* ===== パレット台 ===== */
function Pallet({ x, y, z, w, d, h }: {
  x: number; y: number; z: number; w: number; d: number; h: number;
}) {
  const sk = '#2d3636';
  const top   = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const right = [iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z)] as [number, number][];

  // フォークリフト穴（正面2つ）
  const hw = w * 0.2, hh = h * 0.5, hz = z + h * 0.15;
  const forkHolesFront = [0.15, 0.55].map((pct, i) => {
    const hx = x + w * pct;
    const q = [iso(hx, y, hz + hh), iso(hx + hw, y, hz + hh), iso(hx + hw, y, hz), iso(hx, y, hz)] as [number, number][];
    return <polygon key={`f${i}`} points={p(...q)} fill="#222c2c" stroke={sk} strokeWidth={0.3} />;
  });
  // フォークリフト穴（側面2つ）
  const forkHolesSide = [0.15, 0.55].map((pct, i) => {
    const hy = y + d * pct;
    const hd = d * 0.2;
    const q = [iso(x + w, hy, hz + hh), iso(x + w, hy + hd, hz + hh), iso(x + w, hy + hd, hz), iso(x + w, hy, hz)] as [number, number][];
    return <polygon key={`s${i}`} points={p(...q)} fill="#222c2c" stroke={sk} strokeWidth={0.3} />;
  });

  return (
    <g>
      <polygon points={p(...front)} fill="#687070" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={p(...right)} fill="#525c5c" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={p(...top)} fill="#8a9494" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      {forkHolesFront}{forkHolesSide}
    </g>
  );
}

/* ===== 1パレットスタック: 2列 x 3行 x 2段 = 12ケース ===== */
function Stack({ ox, oy, filled, accent }: {
  ox: number; oy: number; filled: number; accent: string;
}) {
  const PW = 22, PD = 22, PH = 3;
  const cols = 2, rows = 3, layers = 2;
  const perLayer = cols * rows; // 6
  const bw = PW / cols, bd = PD / rows, bh = 7;
  const g = 0.4; // gap between boxes

  let topL = 0;
  for (let l = 0; l < layers; l++) {
    if (filled > l * perLayer) topL = l;
  }
  const dL = filled > 0 ? topL + 1 : 1;

  const elems: JSX.Element[] = [];
  elems.push(<Pallet key="pl" x={0} y={0} z={0} w={PW} d={PD} h={PH} />);

  // 描画順序: 下の段→上の段, 奥→手前, 左→右（奥行きソート）
  for (let l = 0; l < dL; l++) {
    const z = PH + l * bh;
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
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
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const hasFrac = fraction > 0;
  const showTwo = palletCount >= 2 || (palletCount >= 1 && hasFrac);

  const slots = 12;
  const map = (n: number) => qtyPerPallet > 0 ? Math.round((n / qtyPerPallet) * slots) : Math.min(n, slots);

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
              filled={hasFrac ? map(fraction) : slots}
              accent={colors.accent} />
            <Stack ox={oneW + sp} oy={0}
              filled={slots}
              accent={colors.accent} />
          </>
        ) : (
          <Stack ox={0} oy={0}
            filled={hasFrac ? map(fraction) : slots}
            accent={colors.accent} />
        )}
      </svg>
    </div>
  );
}
