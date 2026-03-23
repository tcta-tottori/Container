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
const ANG = Math.PI / 6;
const CX = Math.cos(ANG);
const SX = Math.sin(ANG);

function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * CX, (x + y) * SX - z];
}

function pts(...coords: [number, number][]): string {
  return coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

/* ===== 段ボール箱（参考画像に忠実） ===== */
function CardboardBox({
  x, y, z, w, d, h, ghost = false, accent,
}: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  ghost?: boolean; accent: string;
}) {
  if (ghost) {
    const p = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)] as [number, number][];
    return <polygon points={pts(...p)} fill="none" stroke={accent} strokeWidth={0.2} strokeDasharray="1.5,1.5" opacity={0.2} />;
  }

  // 段ボール色（参考画像に合わせた暖色系）
  const topCol = '#e8c872';       // 上面: 明るいベージュ
  const frontCol = '#d4a84a';     // 前面: やや暗め
  const sideCol = '#c29438';      // 側面: さらに暗め
  const lineCol = '#b8882e';      // 輪郭線
  const tapeCol = 'rgba(255,255,255,0.35)';  // テープ

  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)] as [number, number][];
  const front = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y, z), iso(x, y, z)] as [number, number][];
  const right = [iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z)] as [number, number][];

  // テープの位置（上面中央の線）
  const tMid1 = iso(x + w * 0.42, y, z + h);
  const tMid2 = iso(x + w * 0.58, y, z + h);
  const tMid3 = iso(x + w * 0.42, y + d, z + h);
  const tMid4 = iso(x + w * 0.58, y + d, z + h);

  return (
    <g>
      <polygon points={pts(...front)} fill={frontCol} stroke={lineCol} strokeWidth={0.35} />
      <polygon points={pts(...right)} fill={sideCol} stroke={lineCol} strokeWidth={0.35} />
      <polygon points={pts(...top)} fill={topCol} stroke={lineCol} strokeWidth={0.35} />
      {/* テープ（上面） */}
      <polygon points={pts(tMid1, tMid2, tMid4, tMid3)} fill={tapeCol} stroke="none" />
    </g>
  );
}

/* ===== パレット台（参考画像のグレー台） ===== */
function PalletBase({ x, y, z, pw, pd, ph }: {
  x: number; y: number; z: number; pw: number; pd: number; ph: number;
}) {
  const topC = '#8a9090';
  const frontC = '#6a7272';
  const sideC = '#555e5e';
  const sk = '#3e4848';
  const holeC = '#2e3838';

  const top = [iso(x, y, z + ph), iso(x + pw, y, z + ph), iso(x + pw, y + pd, z + ph), iso(x, y + pd, z + ph)] as [number, number][];
  const front = [iso(x, y, z + ph), iso(x + pw, y, z + ph), iso(x + pw, y, z), iso(x, y, z)] as [number, number][];
  const right = [iso(x + pw, y, z + ph), iso(x + pw, y + pd, z + ph), iso(x + pw, y + pd, z), iso(x + pw, y, z)] as [number, number][];

  // 前面フォーク穴
  const hW = pw * 0.22, hH = ph * 0.55, hZ = z + ph * 0.12;
  const fHoles = [0.12, 0.52].map((pct, i) => {
    const hx = x + pw * pct;
    const h = [iso(hx, y, hZ + hH), iso(hx + hW, y, hZ + hH), iso(hx + hW, y, hZ), iso(hx, y, hZ)] as [number, number][];
    return <polygon key={`fh${i}`} points={pts(...h)} fill={holeC} stroke={sk} strokeWidth={0.3} />;
  });
  // 側面フォーク穴
  const sHoles = [0.12, 0.52].map((pct, i) => {
    const hy = y + pd * pct;
    const hd = pd * 0.22;
    const h = [iso(x + pw, hy, hZ + hH), iso(x + pw, hy + hd, hZ + hH), iso(x + pw, hy + hd, hZ), iso(x + pw, hy, hZ)] as [number, number][];
    return <polygon key={`sh${i}`} points={pts(...h)} fill={holeC} stroke={sk} strokeWidth={0.3} />;
  });

  return (
    <g>
      <polygon points={pts(...front)} fill={frontC} stroke={sk} strokeWidth={0.5} />
      <polygon points={pts(...right)} fill={sideC} stroke={sk} strokeWidth={0.5} />
      <polygon points={pts(...top)} fill={topC} stroke={sk} strokeWidth={0.5} />
      {fHoles}{sHoles}
    </g>
  );
}

/* ===== 1パレット分のスタック ===== */
function PalletStack({
  ox, oy, filledBoxes, accent,
}: {
  ox: number; oy: number;
  filledBoxes: number;
  accent: string;
}) {
  // 参考画像に近い 3列×3行×3段 のレイアウト（パレットサイズ）
  const PW = 26, PD = 26, PH = 3;
  const cols = 3, rows = 3, layers = 3;
  const perLayer = cols * rows;
  const totalSlots = perLayer * layers;
  const bw = PW / cols, bd = PD / rows, bh = (PW * 0.32);
  const gap = 0.4; // 箱の隙間

  // 充填マップ（下段から詰める）
  const filled: boolean[] = [];
  for (let i = 0; i < totalSlots; i++) {
    filled.push(i < filledBoxes);
  }

  // 最上段を決定
  let topLayer = 0;
  for (let l = 0; l < layers; l++) {
    for (let i = 0; i < perLayer; i++) {
      if (filled[l * perLayer + i]) topLayer = l;
    }
  }
  const displayLayers = filledBoxes > 0 ? topLayer + 1 : 1;

  const elems: JSX.Element[] = [];
  elems.push(<PalletBase key="p" x={0} y={0} z={0} pw={PW} pd={PD} ph={PH} />);

  // 描画順: 下段→上段、奥→手前（painter's algorithm）
  for (let l = 0; l < displayLayers; l++) {
    const z = PH + l * bh;
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const idx = l * perLayer + r * cols + c;
        const isFilled = filled[idx];
        elems.push(
          <CardboardBox key={`b${l}-${r}-${c}`}
            x={c * bw + gap} y={r * bd + gap} z={z}
            w={bw - gap * 2} d={bd - gap * 2} h={bh - gap}
            ghost={!isFilled} accent={accent} />
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

  // 1パレット当たりのスロット数（表示用にリマップ）
  const slotsPerPallet = 27; // 3x3x3 = 27 スロット
  const mapToSlots = (cases: number) => {
    if (qtyPerPallet <= 0) return cases;
    return Math.round((cases / qtyPerPallet) * slotsPerPallet);
  };

  // アイソメ投影の概算サイズ
  const blockW = 52;
  const blockH = 58;
  const gap = 8;

  const numBlocks = showTwo ? 2 : 1;
  const totalW = numBlocks * blockW + (numBlocks > 1 ? gap : 0);

  const vbX = -(blockW / 2) - 3;
  const vbY = -blockH + 6;
  const vbW = totalW + 10;
  const vbH = blockH + 8;

  return (
    <div className="pallet-diagram-container">
      <svg
        width="100%"
        height="100%"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '140px' }}
      >
        {showTwo ? (
          <>
            {/* 左: 端数パレット */}
            <PalletStack
              ox={0} oy={0}
              filledBoxes={hasFraction ? mapToSlots(fraction) : slotsPerPallet}
              accent={colors.accent}
            />
            {/* 右: 満載パレット */}
            <PalletStack
              ox={blockW + gap} oy={0}
              filledBoxes={slotsPerPallet}
              accent={colors.accent}
            />
          </>
        ) : (
          <PalletStack
            ox={0} oy={0}
            filledBoxes={hasFraction ? mapToSlots(fraction) : slotsPerPallet}
            accent={colors.accent}
          />
        )}
      </svg>
    </div>
  );
}
