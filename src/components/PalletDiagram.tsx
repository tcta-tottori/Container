'use client';

import { ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface PalletDiagramProps {
  palletCount: number;
  fraction: number;
  qtyPerPallet: number;
  type: ItemType;
}

/* ===== アイソメトリック座標変換 ===== */
const ISO_ANGLE = Math.PI / 6;
const COS = Math.cos(ISO_ANGLE);
const SIN = Math.sin(ISO_ANGLE);

function iso(x3: number, y3: number, z3: number): [number, number] {
  return [(x3 - y3) * COS, (x3 + y3) * SIN - z3];
}

/* ===== 色ユーティリティ ===== */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xFF) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xFF) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xFF) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function pts(...coords: [number, number][]): string {
  return coords.map(([x, y]) => `${x},${y}`).join(' ');
}

/* ===== 箱 ===== */
function Box({
  x, y, z, w, d, h, accent, ghost = false,
}: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  accent: string; ghost?: boolean;
}) {
  if (ghost) {
    const p = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)] as [number, number][];
    return <polygon points={pts(...p)} fill="none" stroke={accent} strokeWidth={0.3} strokeDasharray="2,2" opacity={0.15} />;
  }
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const right = [iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z)] as [number, number][];
  const sk = shade(accent, -70);
  return (
    <g>
      <polygon points={pts(...front)} fill={shade(accent, -30)} stroke={sk} strokeWidth={0.4} />
      <polygon points={pts(...right)} fill={shade(accent, -55)} stroke={sk} strokeWidth={0.4} />
      <polygon points={pts(...top)} fill={accent} stroke={sk} strokeWidth={0.4} />
    </g>
  );
}

/* ===== パレット台 ===== */
function Pallet({ x, y, z, pw, pd, ph }: { x: number; y: number; z: number; pw: number; pd: number; ph: number }) {
  const sk = '#4a5a4a';
  const top = [iso(x, y, z + ph), iso(x + pw, y, z + ph), iso(x + pw, y + pd, z + ph), iso(x, y + pd, z + ph)] as [number, number][];
  const front = [iso(x, y, z + ph), iso(x + pw, y, z + ph), iso(x + pw, y, z), iso(x, y, z)] as [number, number][];
  const right = [iso(x + pw, y, z + ph), iso(x + pw, y + pd, z + ph), iso(x + pw, y + pd, z), iso(x + pw, y, z)] as [number, number][];

  const holeH = ph * 0.5;
  const holeZ = z + ph * 0.15;
  const holeW = pw * 0.25;
  const fHoles = [0.15, 0.55].map((p, i) => {
    const hx = x + pw * p;
    const h = [iso(hx, y, holeZ + holeH), iso(hx + holeW, y, holeZ + holeH), iso(hx + holeW, y, holeZ), iso(hx, y, holeZ)] as [number, number][];
    return <polygon key={`fh${i}`} points={pts(...h)} fill="#3a4a3a" stroke={sk} strokeWidth={0.3} />;
  });
  const sHoles = [0.15, 0.55].map((p, i) => {
    const hy = y + pd * p;
    const hd = pd * 0.25;
    const h = [iso(x + pw, hy, holeZ + holeH), iso(x + pw, hy + hd, holeZ + holeH), iso(x + pw, hy + hd, holeZ), iso(x + pw, hy, holeZ)] as [number, number][];
    return <polygon key={`sh${i}`} points={pts(...h)} fill="#3a4a3a" stroke={sk} strokeWidth={0.3} />;
  });

  return (
    <g>
      <polygon points={pts(...front)} fill="#7a8a7a" stroke={sk} strokeWidth={0.5} />
      <polygon points={pts(...right)} fill="#5a6a5a" stroke={sk} strokeWidth={0.5} />
      <polygon points={pts(...top)} fill="#8a9a8a" stroke={sk} strokeWidth={0.5} />
      {fHoles}{sHoles}
    </g>
  );
}

/* ===== 1パレットブロック ===== */
function PalletStack({
  ox, oy, filledBoxes, accent,
}: {
  ox: number; oy: number;
  filledBoxes: number;
  accent: string;
}) {
  const PW = 24, PD = 24, PH = 2.5;
  const cols = 3, rows = 2;
  const perLayer = cols * rows;
  const layers = 5;
  const bw = PW / cols, bd = PD / rows, bh = 4;

  // 充填マップ（下から詰める）
  const filled: boolean[][] = [];
  let rem = filledBoxes;
  for (let l = 0; l < layers; l++) {
    const row: boolean[] = [];
    for (let i = 0; i < perLayer; i++) {
      row.push(rem > 0);
      if (rem > 0) rem--;
    }
    filled.push(row);
  }

  // 表示段数
  let topLayer = 0;
  for (let l = 0; l < layers; l++) {
    if (filled[l].some(Boolean)) topLayer = l;
  }
  const displayLayers = filledBoxes > 0 ? topLayer + 1 : 1;

  const elems: JSX.Element[] = [];
  elems.push(<Pallet key="p" x={0} y={0} z={0} pw={PW} pd={PD} ph={PH} />);

  for (let l = 0; l < displayLayers; l++) {
    const z = PH + l * bh;
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const isFilled = filled[l][idx];
        elems.push(
          <Box key={`b${l}-${idx}`}
            x={c * bw + 0.3} y={r * bd + 0.3} z={z}
            w={bw - 0.6} d={bd - 0.6} h={bh - 0.3}
            accent={accent} ghost={!isFilled} />
        );
      }
    }
  }

  return <g transform={`translate(${ox}, ${oy})`}>{elems}</g>;
}

/* ===== メインコンポーネント ===== */
export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type,
}: PalletDiagramProps) {
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const hasFraction = fraction > 0;
  const showTwo = palletCount >= 2 || (palletCount >= 1 && hasFraction);

  // 1ブロックのアイソメ投影サイズ概算
  // PW=24, PD=24 → iso X幅 ≈ 24*COS*2 ≈ 41.6, Y高さ ≈ 24*SIN*2 + 5*5 + 2.5 ≈ 51.5
  const blockIsoW = 42;
  const blockIsoH = 50;
  const gap = 6;

  const numBlocks = showTwo ? 2 : 1;
  const totalW = numBlocks * blockIsoW + (numBlocks - 1) * gap;
  const totalH = blockIsoH;

  // viewBox: アイソメ原点が中央上に来るので、X方向は左右に広がる
  const vbX = -blockIsoW / 2 - 2;
  const vbY = -totalH + 8;
  const vbW = totalW + 8;
  const vbH = totalH + 4;

  return (
    <div className="pallet-diagram-container">
      <svg
        width="100%"
        height="100%"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '160px' }}
      >
        {showTwo ? (
          <>
            {/* 左: 端数パレット（欠けがある方） */}
            <PalletStack
              ox={0} oy={0}
              filledBoxes={hasFraction ? fraction : qtyPerPallet}
              accent={colors.accent}
            />
            {/* 右: 満載パレット */}
            <PalletStack
              ox={blockIsoW + gap} oy={0}
              filledBoxes={qtyPerPallet}
              accent={colors.accent}
            />
          </>
        ) : (
          <PalletStack
            ox={0} oy={0}
            filledBoxes={hasFraction ? fraction : qtyPerPallet}
            accent={colors.accent}
          />
        )}
      </svg>
    </div>
  );
}
