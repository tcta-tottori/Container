'use client';

import { ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface PalletDiagramProps {
  palletCount: number;
  fraction: number;
  qtyPerPallet: number;
  type: ItemType;
}

/* ===== アイソメトリック変換 ===== */
const A30 = Math.PI / 6;
const CS = Math.cos(A30);
const SN = Math.sin(A30);
function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * CS, (x + y) * SN - z];
}
function pts(...c: [number, number][]): string {
  return c.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/*
 * 可視面: x=min (左面), y=min (正面), z=max (上面)
 * 描画順: z昇順 → y降順 → x降順
 */

/* ===== 段ボール箱 ===== */
function Box({ x, y, z, w, d, h, ghost, accent }: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  ghost: boolean; accent: string;
}) {
  if (ghost) {
    const q = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)] as [number, number][];
    return <polygon points={pts(...q)} fill="none" stroke={accent} strokeWidth={0.12} strokeDasharray="1,1" opacity={0.12} />;
  }

  const left = [iso(x, y, z + h), iso(x, y + d, z + h), iso(x, y + d, z), iso(x, y, z)] as [number, number][];
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];

  // テープ
  const tw = w * 0.14;
  const tx = x + (w - tw) / 2;
  const tapeTop = [iso(tx, y, z + h), iso(tx + tw, y, z + h), iso(tx + tw, y + d, z + h), iso(tx, y + d, z + h)] as [number, number][];
  const tapeFront = [iso(tx, y, z + h), iso(tx + tw, y, z + h), iso(tx + tw, y, z + h * 0.83), iso(tx, y, z + h * 0.83)] as [number, number][];

  return (
    <g>
      <polygon points={pts(...left)} fill="#c4923a" stroke="#8a6520" strokeWidth={0.5} strokeLinejoin="round" />
      <polygon points={pts(...front)} fill="#dba84e" stroke="#8a6520" strokeWidth={0.5} strokeLinejoin="round" />
      <polygon points={pts(...top)} fill="#efd07a" stroke="#8a6520" strokeWidth={0.5} strokeLinejoin="round" />
      <polygon points={pts(...tapeTop)} fill="rgba(255,255,255,0.35)" stroke="none" />
      <polygon points={pts(...tapeFront)} fill="rgba(255,255,255,0.25)" stroke="none" />
    </g>
  );
}

/* ===== パレット台 ===== */
function PalletBase({ x, y, z, w, d, h }: {
  x: number; y: number; z: number; w: number; d: number; h: number;
}) {
  const sk = '#2d3636';
  const left = [iso(x, y, z + h), iso(x, y + d, z + h), iso(x, y + d, z), iso(x, y, z)] as [number, number][];
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];

  const hw = w * 0.2, hh = h * 0.5, hz = z + h * 0.15;
  const forkFront = [0.15, 0.55].map((pct, i) => {
    const hx = x + w * pct;
    const q = [iso(hx, y, hz + hh), iso(hx + hw, y, hz + hh), iso(hx + hw, y, hz), iso(hx, y, hz)] as [number, number][];
    return <polygon key={`ff${i}`} points={pts(...q)} fill="#222c2c" stroke={sk} strokeWidth={0.3} />;
  });
  const forkLeft = [0.15, 0.55].map((pct, i) => {
    const hy = y + d * pct;
    const hd = d * 0.2;
    const q = [iso(x, hy, hz + hh), iso(x, hy + hd, hz + hh), iso(x, hy + hd, hz), iso(x, hy, hz)] as [number, number][];
    return <polygon key={`fl${i}`} points={pts(...q)} fill="#222c2c" stroke={sk} strokeWidth={0.3} />;
  });

  return (
    <g>
      <polygon points={pts(...left)} fill="#525c5c" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={pts(...front)} fill="#687070" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={pts(...top)} fill="#8a9494" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      {forkLeft}{forkFront}
    </g>
  );
}

/* ===== ボックス位置定義 =====
 * 下段: 後ろ2 + 前3 = 5
 * 上段: 後ろ2 + 前2 = 4
 * パターン: 5, 4, 5, 4 ... (最大18)
 */
interface BoxSlot { x: number; y: number; z: number; }

function buildSlots(PH: number): BoxSlot[] {
  const bw = 6.8, bd = 6.5, bh = 6.2;
  const PW = 22, PD = 16;

  // 前列3つの x 位置（等間隔）
  const gx = (PW - 3 * bw) / 4;
  const fx = [gx, gx + bw + gx, gx + 2 * (bw + gx)];

  // 後列2つの x 位置（等間隔）
  const gxb = (PW - 2 * bw) / 3;
  const bx = [gxb, gxb + bw + gxb];

  // y 位置
  const gy = (PD - 2 * bd) / 3;
  const fy = gy;
  const by = gy + bd + gy;

  const slots: BoxSlot[] = [];

  const addLayer5 = (z: number) => {
    // 後ろ2つ（fill先: 安定感のため後ろから）
    for (const x of bx) slots.push({ x, y: by, z });
    // 前3つ
    for (const x of fx) slots.push({ x, y: fy, z });
  };

  const addLayer4 = (z: number) => {
    // 後ろ2つ
    for (const x of bx) slots.push({ x, y: by, z });
    // 前2つ（中央寄せ: fx[0]とfx[2]を使用）
    slots.push({ x: fx[0], y: fy, z });
    slots.push({ x: fx[2], y: fy, z });
  };

  // Layer 0: 5, Layer 1: 4, Layer 2: 5, Layer 3: 4 = 合計18
  addLayer5(PH);
  addLayer4(PH + bh);
  addLayer5(PH + bh * 2);
  addLayer4(PH + bh * 3);

  return slots;
}

/* ===== 1パレットスタック ===== */
function Stack({ ox, oy, filled, accent }: {
  ox: number; oy: number; filled: number; accent: string;
}) {
  const PW = 22, PD = 16, PH = 3;
  const bw = 6.8, bd = 6.5, bh = 6.2;

  const allSlots = buildSlots(PH);

  // 必要なレイヤー数を算出（描画範囲を最小限に）
  const layerCaps = [5, 4, 5, 4]; // 各レイヤーの容量
  let maxLayer = 0;
  let acc = 0;
  for (let l = 0; l < layerCaps.length; l++) {
    acc += layerCaps[l];
    if (filled > acc - layerCaps[l]) maxLayer = l;
  }
  const slotsToRender = layerCaps.slice(0, maxLayer + 1).reduce((a, b) => a + b, 0);

  const elems: JSX.Element[] = [];
  elems.push(<PalletBase key="pl" x={0} y={0} z={0} w={PW} d={PD} h={PH} />);

  // 描画順にソート: z昇順 → y降順 → x降順
  const indexed = allSlots
    .slice(0, slotsToRender)
    .map((s, fillIdx) => ({ ...s, fillIdx }));

  indexed.sort((a, b) => {
    if (a.z !== b.z) return a.z - b.z;
    if (a.y !== b.y) return b.y - a.y;
    return b.x - a.x;
  });

  for (const s of indexed) {
    elems.push(
      <Box key={`b${s.fillIdx}`}
        x={s.x} y={s.y} z={s.z}
        w={bw} d={bd} h={bh}
        ghost={s.fillIdx >= filled} accent={accent} />
    );
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

  const maxSlots = 18; // 5+4+5+4
  const mapFrac = (n: number) => Math.min(Math.ceil(n), maxSlots);

  // 投影範囲計算
  const PW = 22, PD = 16, PH = 3;
  const bh = 6.2;
  const totalZ = PH + 2 * bh; // 通常2段まで表示
  const xL = -PD * CS;
  const xR = PW * CS;
  const yB = (PW + PD) * SN;
  const yT = -totalZ - 2;
  const oneW = xR - xL;
  const oneH = yB - yT;
  const sp = oneW * 0.1;

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
              filled={hasFrac ? mapFrac(fraction) : maxSlots}
              accent={colors.accent} />
            <Stack ox={oneW + sp} oy={0}
              filled={maxSlots}
              accent={colors.accent} />
          </>
        ) : (
          <Stack ox={0} oy={0}
            filled={hasFrac ? mapFrac(fraction) : maxSlots}
            accent={colors.accent} />
        )}
      </svg>
    </div>
  );
}
