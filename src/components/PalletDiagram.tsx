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

/* ===== 段ボール箱 ===== */
function Box({ x, y, z, w, d, h, ghost, accent }: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  ghost: boolean; accent: string;
}) {
  if (ghost) {
    const q = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)] as [number, number][];
    return <polygon points={p(...q)} fill="none" stroke={accent} strokeWidth={0.15} strokeDasharray="1,1" opacity={0.15} />;
  }
  // 段ボール色
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const right = [iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z)] as [number, number][];
  // テープ（上面の中央帯）
  const t1 = iso(x + w * 0.4, y, z + h);
  const t2 = iso(x + w * 0.6, y, z + h);
  const t3 = iso(x + w * 0.4, y + d, z + h);
  const t4 = iso(x + w * 0.6, y + d, z + h);

  return (
    <g>
      <polygon points={p(...front)} fill="#d4a54a" stroke="#a87830" strokeWidth={0.3} />
      <polygon points={p(...right)} fill="#be8e38" stroke="#a87830" strokeWidth={0.3} />
      <polygon points={p(...top)} fill="#e8c870" stroke="#a87830" strokeWidth={0.3} />
      <polygon points={p(t1, t2, t4, t3)} fill="rgba(255,255,255,0.3)" />
    </g>
  );
}

/* ===== パレット台 ===== */
function Pallet({ x, y, z, w, d, h }: {
  x: number; y: number; z: number; w: number; d: number; h: number;
}) {
  const sk = '#3e4848';
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const right = [iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z)] as [number, number][];
  const hw = w * 0.22, hh = h * 0.55, hz = z + h * 0.12;
  const fH = [0.12, 0.52].map((pct, i) => {
    const hx = x + w * pct;
    const q = [iso(hx, y, hz + hh), iso(hx + hw, y, hz + hh), iso(hx + hw, y, hz), iso(hx, y, hz)] as [number, number][];
    return <polygon key={`f${i}`} points={p(...q)} fill="#2e3838" stroke={sk} strokeWidth={0.25} />;
  });
  const sH = [0.12, 0.52].map((pct, i) => {
    const hy = y + d * pct;
    const hd = d * 0.22;
    const q = [iso(x + w, hy, hz + hh), iso(x + w, hy + hd, hz + hh), iso(x + w, hy + hd, hz), iso(x + w, hy, hz)] as [number, number][];
    return <polygon key={`s${i}`} points={p(...q)} fill="#2e3838" stroke={sk} strokeWidth={0.25} />;
  });
  return (
    <g>
      <polygon points={p(...front)} fill="#6a7272" stroke={sk} strokeWidth={0.5} />
      <polygon points={p(...right)} fill="#555e5e" stroke={sk} strokeWidth={0.5} />
      <polygon points={p(...top)} fill="#8a9090" stroke={sk} strokeWidth={0.5} />
      {fH}{sH}
    </g>
  );
}

/* ===== 1パレットスタック: 3列 x 2行 x 5段 = 30ケース ===== */
function Stack({ ox, oy, filled, accent }: {
  ox: number; oy: number; filled: number; accent: string;
}) {
  const PW = 24, PD = 16, PH = 2.5;
  const cols = 3, rows = 2, layers = 5;
  const perLayer = cols * rows; // 6
  const bw = PW / cols, bd = PD / rows, bh = 4.5;
  const g = 0.3;

  let topL = 0;
  for (let l = 0; l < layers; l++) {
    if (filled > l * perLayer) topL = l;
  }
  const dL = filled > 0 ? topL + 1 : 1;

  const elems: JSX.Element[] = [];
  elems.push(<Pallet key="pl" x={0} y={0} z={0} w={PW} d={PD} h={PH} />);

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

  // 30ケース→30スロット(実寸), それ以外はリマップ
  const slots = 30;
  const map = (n: number) => qtyPerPallet > 0 ? Math.round((n / qtyPerPallet) * slots) : n;

  // 投影範囲の計算 (PW=24, PD=16)
  const PW = 24, PD = 16, PH = 2.5, totalZ = PH + 5 * 4.5;
  const xL = -PD * CS;           // 左端
  const xR = PW * CS;            // 右端
  const yB = (PW + PD) * SN;     // 下端
  const yT = -totalZ;            // 上端
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
