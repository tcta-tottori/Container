'use client';

import { ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface PalletDiagramProps {
  palletCount: number;
  fraction: number;
  qtyPerPallet: number;
  type: ItemType;
  itemName?: string;
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

/* ===== ジャーポット判定 ===== */
function isJarPot(name: string): boolean {
  return /^JP[A-Z]/.test(name) || name.includes('ジャーポット');
}

/* ===== 段ボール箱（参照画像準拠: 3面+テープ十字） ===== */
function Box({ x, y, z, w, d, h, ghost, accent }: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  ghost: boolean; accent: string;
}) {
  if (ghost) {
    const q = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)] as [number, number][];
    return <polygon points={pts(...q)} fill="none" stroke={accent} strokeWidth={0.12} strokeDasharray="1,1" opacity={0.12} />;
  }

  const sk = '#5a4020';
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const top   = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];
  const left  = [iso(x, y, z + h), iso(x, y + d, z + h), iso(x, y + d, z), iso(x, y, z)] as [number, number][];

  const tw = w * 0.12;
  const tx = x + (w - tw) / 2;
  const td = d * 0.12;
  const ty = y + (d - td) / 2;
  const tapeV = [iso(tx, y, z + h), iso(tx + tw, y, z + h), iso(tx + tw, y + d, z + h), iso(tx, y + d, z + h)] as [number, number][];
  const tapeH = [iso(x, ty, z + h), iso(x + w, ty, z + h), iso(x + w, ty + td, z + h), iso(x, ty + td, z + h)] as [number, number][];
  const tapeFV = [iso(tx, y, z + h), iso(tx + tw, y, z + h), iso(tx + tw, y, z + h * 0.78), iso(tx, y, z + h * 0.78)] as [number, number][];
  const tapeLV = [iso(x, ty, z + h), iso(x, ty + td, z + h), iso(x, ty + td, z + h * 0.78), iso(x, ty, z + h * 0.78)] as [number, number][];

  return (
    <g>
      <polygon points={pts(...front)} fill="#dea550" stroke={sk} strokeWidth={0.7} strokeLinejoin="round" />
      <polygon points={pts(...top)}   fill="#e8c06a" stroke={sk} strokeWidth={0.7} strokeLinejoin="round" />
      <polygon points={pts(...left)}  fill="#c08a3a" stroke={sk} strokeWidth={0.7} strokeLinejoin="round" />
      <polygon points={pts(...tapeV)} fill="rgba(255,255,255,0.4)" stroke="none" />
      <polygon points={pts(...tapeH)} fill="rgba(255,255,255,0.35)" stroke="none" />
      <polygon points={pts(...tapeFV)} fill="rgba(255,255,255,0.25)" stroke="none" />
      <polygon points={pts(...tapeLV)} fill="rgba(255,255,255,0.2)" stroke="none" />
    </g>
  );
}

/* ===== パレット台 ===== */
function PalletBase({ x, y, z, w, d, h }: {
  x: number; y: number; z: number; w: number; d: number; h: number;
}) {
  const sk = '#2a2e36';
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const top   = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];
  const left  = [iso(x, y, z + h), iso(x, y + d, z + h), iso(x, y + d, z), iso(x, y, z)] as [number, number][];

  const hw = w * 0.2, hh = h * 0.45, hz = z + h * 0.18;
  const forkFront = [0.15, 0.58].map((pct, i) => {
    const hx = x + w * pct;
    const q = [iso(hx, y, hz + hh), iso(hx + hw, y, hz + hh), iso(hx + hw, y, hz), iso(hx, y, hz)] as [number, number][];
    return <polygon key={`ff${i}`} points={pts(...q)} fill="#1a1e24" stroke={sk} strokeWidth={0.4} />;
  });
  const forkLeft = [0.15, 0.58].map((pct, i) => {
    const hy = y + d * pct;
    const hd = d * 0.18;
    const q = [iso(x, hy, hz + hh), iso(x, hy + hd, hz + hh), iso(x, hy + hd, hz), iso(x, hy, hz)] as [number, number][];
    return <polygon key={`fl${i}`} points={pts(...q)} fill="#1a1e24" stroke={sk} strokeWidth={0.4} />;
  });

  return (
    <g>
      <polygon points={pts(...front)} fill="#555d68" stroke={sk} strokeWidth={0.8} strokeLinejoin="round" />
      <polygon points={pts(...top)}   fill="#6b7280" stroke={sk} strokeWidth={0.8} strokeLinejoin="round" />
      <polygon points={pts(...left)}  fill="#444c56" stroke={sk} strokeWidth={0.8} strokeLinejoin="round" />
      {forkFront}{forkLeft}
    </g>
  );
}

/* ===== ラミネートバンドル ===== */
function LaminateBundle({ x, y, z, cw, cd, h, horizontal, ghost, accent }: {
  x: number; y: number; z: number;
  cw: number; cd: number; h: number;
  horizontal: boolean;
  ghost: boolean; accent: string;
}) {
  const bw = horizontal ? cw * 2 : cd;
  const bd = horizontal ? cd : cw * 2;

  if (ghost) {
    const q = [iso(x, y, z), iso(x + bw, y, z), iso(x + bw, y + bd, z), iso(x, y + bd, z)] as [number, number][];
    return <polygon points={pts(...q)} fill="none" stroke={accent} strokeWidth={0.1} strokeDasharray="1,1" opacity={0.1} />;
  }

  const ig = 0.15;
  const cases: JSX.Element[] = [];
  if (horizontal) {
    cases.push(<Box key="c0" x={x} y={y} z={z} w={cw - ig} d={cd} h={h} ghost={false} accent={accent} />);
    cases.push(<Box key="c1" x={x + cw} y={y} z={z} w={cw - ig} d={cd} h={h} ghost={false} accent={accent} />);
  } else {
    cases.push(<Box key="c0" x={x} y={y} z={z} w={cd} d={cw - ig} h={h} ghost={false} accent={accent} />);
    cases.push(<Box key="c1" x={x} y={y + cw} z={z} w={cd} d={cw - ig} h={h} ghost={false} accent={accent} />);
  }

  const m = 0.08;
  const wx = x - m, wy = y - m, ww = bw + m * 2, wd = bd + m * 2, wh = h + m;
  const wrapLeft = [iso(wx, wy, z + wh), iso(wx, wy + wd, z + wh), iso(wx, wy + wd, z), iso(wx, wy, z)] as [number, number][];
  const wrapFront = [iso(wx, wy, z + wh), iso(wx + ww, wy, z + wh), iso(wx + ww, wy, z), iso(wx, wy, z)] as [number, number][];
  const wrapTop = [iso(wx, wy, z + wh), iso(wx + ww, wy, z + wh), iso(wx + ww, wy + wd, z + wh), iso(wx, wy + wd, z + wh)] as [number, number][];

  const bandH = 0.4;
  const bands: JSX.Element[] = [];
  for (const pct of [0.25, 0.72]) {
    const bz = z + h * pct;
    const bf = [iso(wx, wy, bz + bandH), iso(wx + ww, wy, bz + bandH), iso(wx + ww, wy, bz), iso(wx, wy, bz)] as [number, number][];
    bands.push(<polygon key={`bf${pct}`} points={pts(...bf)} fill="rgba(200,230,255,0.22)" stroke="none" />);
    const bl = [iso(wx, wy, bz + bandH), iso(wx, wy + wd, bz + bandH), iso(wx, wy + wd, bz), iso(wx, wy, bz)] as [number, number][];
    bands.push(<polygon key={`bl${pct}`} points={pts(...bl)} fill="rgba(180,210,240,0.18)" stroke="none" />);
  }

  const refY = z + h * 0.5;
  const ref = [iso(wx + ww * 0.1, wy, refY + 0.2), iso(wx + ww * 0.7, wy, refY + 0.2),
               iso(wx + ww * 0.7, wy, refY), iso(wx + ww * 0.1, wy, refY)] as [number, number][];

  return (
    <g>
      {cases}
      <polygon points={pts(...wrapLeft)} fill="rgba(180,215,250,0.12)" stroke="rgba(150,190,230,0.35)" strokeWidth={0.3} strokeLinejoin="round" />
      <polygon points={pts(...wrapFront)} fill="rgba(190,220,250,0.1)" stroke="rgba(150,190,230,0.35)" strokeWidth={0.3} strokeLinejoin="round" />
      <polygon points={pts(...wrapTop)} fill="rgba(220,240,255,0.08)" stroke="rgba(150,190,230,0.35)" strokeWidth={0.3} strokeLinejoin="round" />
      {bands}
      <polygon points={pts(...ref)} fill="rgba(255,255,255,0.15)" stroke="none" />
    </g>
  );
}

/* ===== ジャーポット用スタック ===== */
interface BundleSlot {
  x: number; y: number; z: number;
  horizontal: boolean;
  fillIdx: number;
}

function buildJarPotSlots(PH: number): BundleSlot[] {
  const PW = 22, PD = 22;
  const gOuter = 0.3;
  const cw = (PW - 3 * gOuter) / 4;
  const cd = (PD - 6 * gOuter) / 5;
  const bh = 5.5;

  const slots: BundleSlot[] = [];
  let idx = 0;

  const z0 = PH;
  for (let r = 4; r >= 0; r--) {
    for (let c = 0; c < 2; c++) {
      const x = gOuter + c * (2 * cw + gOuter);
      const y = gOuter + r * (cd + gOuter);
      slots.push({ x, y, z: z0, horizontal: true, fillIdx: idx++ });
    }
  }

  const z1 = PH + bh;
  for (let r = 1; r >= 0; r--) {
    for (let c = 0; c < 5; c++) {
      const x = gOuter + c * (cd + gOuter);
      const y = gOuter + r * (2 * cw + gOuter);
      slots.push({ x, y, z: z1, horizontal: false, fillIdx: idx++ });
    }
  }

  return slots;
}

function JarPotStack({ ox, oy, filled, accent }: {
  ox: number; oy: number; filled: number; accent: string;
}) {
  const PW = 22, PD = 22, PH = 3;
  const gOuter = 0.3;
  const cw = (PW - 3 * gOuter) / 4;
  const cd = (PD - 6 * gOuter) / 5;
  const bh = 5.5;

  const allSlots = buildJarPotSlots(PH);
  const maxLayer0 = 10;
  const slotsToShow = filled > maxLayer0 ? allSlots.length : maxLayer0;
  const renderSlots = allSlots.slice(0, slotsToShow);

  const sorted = [...renderSlots].sort((a, b) => {
    if (a.z !== b.z) return a.z - b.z;
    if (a.y !== b.y) return b.y - a.y;
    return b.x - a.x;
  });

  const elems: JSX.Element[] = [];
  elems.push(<PalletBase key="pl" x={0} y={0} z={0} w={PW} d={PD} h={PH} />);

  for (const s of sorted) {
    elems.push(
      <LaminateBundle key={`b${s.fillIdx}`}
        x={s.x} y={s.y} z={s.z}
        cw={cw} cd={cd} h={bh}
        horizontal={s.horizontal}
        ghost={s.fillIdx >= filled} accent={accent} />
    );
  }

  return <g transform={`translate(${ox},${oy})`}>{elems}</g>;
}

/* ===== 汎用ボックス位置定義 ===== */
interface BoxSlot { x: number; y: number; z: number; }

function buildGenericSlots(PH: number): BoxSlot[] {
  const bw = 7, bd = 7, bh = 6;
  const PS = 22;
  const g = (PS - 3 * bw) / 4;
  const cols3 = [g, g + bw + g, g + 2 * (bw + g)];
  const g2 = (PS - 2 * bd) / 3;
  const rows2 = [g2, g2 + bd + g2];

  const slots: BoxSlot[] = [];
  const addLayer6 = (z: number) => {
    for (const y of rows2) for (const x of cols3) slots.push({ x, y, z });
  };
  const addLayer4 = (z: number) => {
    const g3 = (PS - 2 * bw) / 3;
    const cx = [g3, g3 + bw + g3];
    for (const y of rows2) for (const x of cx) slots.push({ x, y, z });
  };

  addLayer6(PH);
  addLayer4(PH + bh);
  addLayer6(PH + bh * 2);
  return slots;
}

function GenericStack({ ox, oy, filled, accent }: {
  ox: number; oy: number; filled: number; accent: string;
}) {
  const PS = 22, PH = 3;
  const bw = 7, bd = 7, bh = 6;
  const allSlots = buildGenericSlots(PH);
  const layerCaps = [6, 4, 6];
  let maxLayer = 0, acc = 0;
  for (let l = 0; l < layerCaps.length; l++) {
    acc += layerCaps[l];
    if (filled > acc - layerCaps[l]) maxLayer = l;
  }
  const slotsToRender = layerCaps.slice(0, maxLayer + 1).reduce((a, b) => a + b, 0);
  const elems: JSX.Element[] = [];
  elems.push(<PalletBase key="pl" x={0} y={0} z={0} w={PS} d={PS} h={PH} />);
  const indexed = allSlots.slice(0, slotsToRender).map((s, i) => ({ ...s, fillIdx: i }));
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

/* ===== メイン =====
 * レイアウト:
 *   右側エリアに配置
 *   [1パレット分の積み方図] [×N] + [端数の積み方図]
 */
export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type, itemName,
}: PalletDiagramProps) {
  void qtyPerPallet;
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const hasFrac = fraction > 0;
  const jarPot = isJarPot(itemName || '');

  const maxSlots = jarPot ? 20 : 16;
  const mapFrac = (n: number) => {
    if (jarPot) return Math.min(Math.ceil(n / 2), maxSlots);
    return Math.min(Math.ceil(n), maxSlots);
  };

  const PW = 22, PD = 22, PH = 3;
  const layerH = jarPot ? 5.5 : 6;
  const totalZ = PH + 2 * layerH;
  const xL = -PD * CS;
  const xR = PW * CS;
  const yB = (PW + PD) * SN;
  const yT = -totalZ - 2;
  const oneW = xR - xL;
  const oneH = yB - yT;

  const StackComponent = jarPot ? JarPotStack : GenericStack;

  // パレット1枚分 + ×Nラベル + 端数図
  const showFrac = hasFrac;
  const fracW = showFrac ? oneW * 0.7 : 0;
  const labelW = palletCount > 0 ? 10 : 0;
  const sp = 3;
  const mainW = palletCount > 0 ? oneW : 0;
  const totalSvgW = mainW + labelW + (showFrac ? sp + fracW : 0) + 4;

  return (
    <div className="pallet-diagram-container" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
      <svg width="100%" height="100%"
        viewBox={`${xL - 2} ${yT - 2} ${totalSvgW} ${oneH + 4}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '100%' }}
      >
        {/* 1パレット分の積み方図 */}
        {palletCount > 0 && (
          <StackComponent ox={0} oy={0}
            filled={maxSlots}
            accent={colors.accent} />
        )}

        {/* ×Nパレット数ラベル（図の右下） */}
        {palletCount > 0 && (
          <text
            x={xR + 1}
            y={yB - 1}
            textAnchor="start"
            style={{
              fontSize: 7, fontWeight: 900, fontFamily: 'var(--font-mono)',
              fill: colors.accent,
            }}
          >
            ×{palletCount}
          </text>
        )}

        {/* 端数の積み方図（右側、少し小さめ、ケース数ラベルなし） */}
        {showFrac && (
          <g transform={`translate(${mainW + labelW + sp}, ${(oneH - oneH * 0.7) / 2 - 2}) scale(0.7)`}>
            <StackComponent ox={0} oy={0}
              filled={mapFrac(fraction)}
              accent={colors.accent} />
          </g>
        )}
      </svg>
    </div>
  );
}
