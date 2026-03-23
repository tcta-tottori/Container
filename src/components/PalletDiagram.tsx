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

/* ===== 段ボール箱（3面: 左面・正面・上面） ===== */
function Box({ x, y, z, w, d, h, ghost, accent }: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  ghost: boolean; accent: string;
}) {
  if (ghost) {
    const q = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)] as [number, number][];
    return <polygon points={pts(...q)} fill="none" stroke={accent} strokeWidth={0.12} strokeDasharray="1,1" opacity={0.12} />;
  }

  // 正面 (y=min): 画面の右下方向
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  // 上面 (z=max): 画面の上方向
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];
  // 左面 (x=min): 画面の左下方向 — 最後に描画して確実に見えるようにする
  const left = [iso(x, y, z + h), iso(x, y + d, z + h), iso(x, y + d, z), iso(x, y, z)] as [number, number][];

  // テープ
  const tw = w * 0.14, tx = x + (w - tw) / 2;
  const tapeTop = [iso(tx, y, z + h), iso(tx + tw, y, z + h), iso(tx + tw, y + d, z + h), iso(tx, y + d, z + h)] as [number, number][];
  const tapeFront = [iso(tx, y, z + h), iso(tx + tw, y, z + h), iso(tx + tw, y, z + h * 0.83), iso(tx, y, z + h * 0.83)] as [number, number][];

  const sk = '#705020';
  return (
    <g>
      {/* 正面 → 上面 → 左面 の順 (左面を最後に描画して確実に表示) */}
      <polygon points={pts(...front)} fill="#daa54c" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={pts(...top)} fill="#f0d580" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={pts(...left)} fill="#b08030" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={pts(...tapeTop)} fill="rgba(255,255,255,0.3)" stroke="none" />
      <polygon points={pts(...tapeFront)} fill="rgba(255,255,255,0.2)" stroke="none" />
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
      {/* 正面 → 上面 → 左面 の順 (左面を最後に描画) */}
      <polygon points={pts(...front)} fill="#687070" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={pts(...top)} fill="#8a9494" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={pts(...left)} fill="#4a5454" stroke={sk} strokeWidth={0.6} strokeLinejoin="round" />
      {forkFront}{forkLeft}
    </g>
  );
}

/* ===== ラミネートバンドル（2ケース1まとまり） ===== */
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

  const ig = 0.15; // ケース間の隙間

  // 2つのケースを描画
  const cases: JSX.Element[] = [];
  if (horizontal) {
    cases.push(<Box key="c0" x={x} y={y} z={z} w={cw - ig} d={cd} h={h} ghost={false} accent={accent} />);
    cases.push(<Box key="c1" x={x + cw} y={y} z={z} w={cw - ig} d={cd} h={h} ghost={false} accent={accent} />);
  } else {
    cases.push(<Box key="c0" x={x} y={y} z={z} w={cd} d={cw - ig} h={h} ghost={false} accent={accent} />);
    cases.push(<Box key="c1" x={x} y={y + cw} z={z} w={cd} d={cw - ig} h={h} ghost={false} accent={accent} />);
  }

  // ラミネートラップ（3面に半透明オーバーレイ）
  const m = 0.08; // wrap margin
  const wx = x - m, wy = y - m, ww = bw + m * 2, wd = bd + m * 2, wh = h + m;

  const wrapLeft = [iso(wx, wy, z + wh), iso(wx, wy + wd, z + wh), iso(wx, wy + wd, z), iso(wx, wy, z)] as [number, number][];
  const wrapFront = [iso(wx, wy, z + wh), iso(wx + ww, wy, z + wh), iso(wx + ww, wy, z), iso(wx, wy, z)] as [number, number][];
  const wrapTop = [iso(wx, wy, z + wh), iso(wx + ww, wy, z + wh), iso(wx + ww, wy + wd, z + wh), iso(wx, wy + wd, z + wh)] as [number, number][];

  // ラミネートバンド（上下2本）
  const bandH = 0.4;
  const bands: JSX.Element[] = [];
  for (const pct of [0.25, 0.72]) {
    const bz = z + h * pct;
    // 正面バンド
    const bf = [iso(wx, wy, bz + bandH), iso(wx + ww, wy, bz + bandH), iso(wx + ww, wy, bz), iso(wx, wy, bz)] as [number, number][];
    bands.push(<polygon key={`bf${pct}`} points={pts(...bf)} fill="rgba(200,230,255,0.22)" stroke="none" />);
    // 左面バンド
    const bl = [iso(wx, wy, bz + bandH), iso(wx, wy + wd, bz + bandH), iso(wx, wy + wd, bz), iso(wx, wy, bz)] as [number, number][];
    bands.push(<polygon key={`bl${pct}`} points={pts(...bl)} fill="rgba(180,210,240,0.18)" stroke="none" />);
  }

  // 光の反射（正面にハイライト線）
  const refY = z + h * 0.5;
  const ref = [iso(wx + ww * 0.1, wy, refY + 0.2), iso(wx + ww * 0.7, wy, refY + 0.2),
               iso(wx + ww * 0.7, wy, refY), iso(wx + ww * 0.1, wy, refY)] as [number, number][];

  return (
    <g>
      {cases}
      {/* ラミネートラップ */}
      <polygon points={pts(...wrapLeft)} fill="rgba(180,215,250,0.12)" stroke="rgba(150,190,230,0.35)" strokeWidth={0.3} strokeLinejoin="round" />
      <polygon points={pts(...wrapFront)} fill="rgba(190,220,250,0.1)" stroke="rgba(150,190,230,0.35)" strokeWidth={0.3} strokeLinejoin="round" />
      <polygon points={pts(...wrapTop)} fill="rgba(220,240,255,0.08)" stroke="rgba(150,190,230,0.35)" strokeWidth={0.3} strokeLinejoin="round" />
      {bands}
      <polygon points={pts(...ref)} fill="rgba(255,255,255,0.15)" stroke="none" />
    </g>
  );
}

/* ===== ジャーポット用スタック =====
 * 1段 = 10バンドル(20ケース)
 * Layer 0: 横向き 2列×5行
 * Layer 1: 縦向き 5列×2行（互い違い）
 */
interface BundleSlot {
  x: number; y: number; z: number;
  horizontal: boolean;
  fillIdx: number;
}

function buildJarPotSlots(PH: number): BundleSlot[] {
  const PW = 22, PD = 22;
  // ケースサイズ: 4*cw = PW, 5*cd = PD → cw:cd = 5:4
  const gOuter = 0.3;
  const cw = (PW - 3 * gOuter) / 4; // ≈5.275
  const cd = (PD - 6 * gOuter) / 5; // ≈4.04
  const bh = 5.5;

  const slots: BundleSlot[] = [];
  let idx = 0;

  // Layer 0: 横向きバンドル (2cols × 5rows)
  // bw=2*cw, bd=cd
  const z0 = PH;
  for (let r = 4; r >= 0; r--) {
    for (let c = 0; c < 2; c++) {
      const x = gOuter + c * (2 * cw + gOuter);
      const y = gOuter + r * (cd + gOuter);
      slots.push({ x, y, z: z0, horizontal: true, fillIdx: idx++ });
    }
  }

  // Layer 1: 縦向きバンドル (5cols × 2rows) — 互い違い
  // bw=cd, bd=2*cw
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
  const cw = (PW - 3 * 0.3) / 4;
  const cd = (PD - 6 * 0.3) / 5;
  const bh = 5.5;

  const allSlots = buildJarPotSlots(PH);

  // 表示するレイヤー数
  const maxLayer0 = 10;
  const slotsToShow = filled > maxLayer0 ? allSlots.length : maxLayer0;
  const renderSlots = allSlots.slice(0, slotsToShow);

  // 描画順ソート: z昇順 → y降順 → x降順
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

/* ===== 汎用ボックス位置定義 (5+4パターン) ===== */
interface BoxSlot { x: number; y: number; z: number; }

function buildGenericSlots(PH: number): BoxSlot[] {
  const bw = 6.8, bd = 6.5, bh = 6.2;
  const PW = 22, PD = 16;
  const gx = (PW - 3 * bw) / 4;
  const fx = [gx, gx + bw + gx, gx + 2 * (bw + gx)];
  const gxb = (PW - 2 * bw) / 3;
  const bx = [gxb, gxb + bw + gxb];
  const gy = (PD - 2 * bd) / 3;
  const fy = gy, by = gy + bd + gy;

  const slots: BoxSlot[] = [];
  const addLayer5 = (z: number) => {
    for (const x of bx) slots.push({ x, y: by, z });
    for (const x of fx) slots.push({ x, y: fy, z });
  };
  const addLayer4 = (z: number) => {
    for (const x of bx) slots.push({ x, y: by, z });
    slots.push({ x: fx[0], y: fy, z });
    slots.push({ x: fx[2], y: fy, z });
  };

  addLayer5(PH);
  addLayer4(PH + bh);
  addLayer5(PH + bh * 2);
  addLayer4(PH + bh * 3);
  return slots;
}

function GenericStack({ ox, oy, filled, accent }: {
  ox: number; oy: number; filled: number; accent: string;
}) {
  const PW = 22, PD = 16, PH = 3;
  const bw = 6.8, bd = 6.5, bh = 6.2;
  const allSlots = buildGenericSlots(PH);
  const layerCaps = [5, 4, 5, 4];
  let maxLayer = 0, acc = 0;
  for (let l = 0; l < layerCaps.length; l++) {
    acc += layerCaps[l];
    if (filled > acc - layerCaps[l]) maxLayer = l;
  }
  const slotsToRender = layerCaps.slice(0, maxLayer + 1).reduce((a, b) => a + b, 0);
  const elems: JSX.Element[] = [];
  elems.push(<PalletBase key="pl" x={0} y={0} z={0} w={PW} d={PD} h={PH} />);
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

/* ===== メイン ===== */
export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type, itemName,
}: PalletDiagramProps) {
  void qtyPerPallet;
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const hasFrac = fraction > 0;
  const showTwo = palletCount >= 2 || (palletCount >= 1 && hasFrac);
  const jarPot = isJarPot(itemName || '');

  // スロット数
  const maxSlots = jarPot ? 20 : 18;
  // ジャーポット: 端数をバンドル数に変換 (2ケース=1バンドル)
  const mapFrac = (n: number) => {
    if (jarPot) return Math.min(Math.ceil(n / 2), maxSlots);
    return Math.min(Math.ceil(n), maxSlots);
  };

  // 投影範囲
  const PW = 22, PD = jarPot ? 22 : 16, PH = 3;
  const layerH = jarPot ? 5.5 : 6.2;
  const totalZ = PH + 2 * layerH;
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

  const StackComponent = jarPot ? JarPotStack : GenericStack;

  return (
    <div className="pallet-diagram-container">
      <svg width="100%" height="100%"
        viewBox={`${xL - 2} ${yT - 2} ${svgW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '100%' }}
      >
        {showTwo ? (
          <>
            <StackComponent ox={0} oy={0}
              filled={hasFrac ? mapFrac(fraction) : maxSlots}
              accent={colors.accent} />
            <StackComponent ox={oneW + sp} oy={0}
              filled={maxSlots}
              accent={colors.accent} />
          </>
        ) : (
          <StackComponent ox={0} oy={0}
            filled={hasFrac ? mapFrac(fraction) : maxSlots}
            accent={colors.accent} />
        )}
      </svg>
    </div>
  );
}
