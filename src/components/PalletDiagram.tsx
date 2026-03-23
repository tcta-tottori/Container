'use client';

import { ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface PalletDiagramProps {
  palletCount: number;
  fraction: number;
  qtyPerPallet: number;
  type: ItemType;
}

/**
 * 30個パターンのレイアウト情報
 * 1段 = 横向き3個 + 縦向き3個 = 6個
 * 5段積みで合計30個
 * 各段で横/縦が交互に入れ替わるインターロッキング
 */
interface LayerBox {
  /** パレット上のX位置（0-1の比率） */
  rx: number;
  /** パレット上のY位置（0-1の比率） */
  ry: number;
  /** 幅（0-1の比率） */
  rw: number;
  /** 奥行き（0-1の比率） */
  rd: number;
}

/** 30個パターン: 1段6個(3列×2行, 全て縦向き)×5段 */
function get30Layout(): LayerBox[][] {
  const layers: LayerBox[][] = [];
  for (let l = 0; l < 5; l++) {
    const boxes: LayerBox[] = [];
    // 3列×2行、すべて縦向き
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        boxes.push({
          rx: col * 0.333,
          ry: row * 0.5,
          rw: 0.333,
          rd: 0.5,
        });
      }
    }
    layers.push(boxes);
  }
  return layers;
}

/**
 * 35個パターン: 1段7個×5段
 * 1段目: 左に横向き3個(縦に3段) + 右に縦向き4個(2列×2行)
 * 2段目: 左に縦向き4個(2列×2行) + 右に横向き3個(縦に3段) ← 左右逆
 * 交互に5段積み
 *
 * 横向き箱: 幅が広く奥行きが浅い（横長）
 * 縦向き箱: 幅が狭く奥行きが深い（縦長）
 * パレット上で左右に分割:
 *   横向き3個側 = パレット幅の約43% (横長の箱が3個縦並び)
 *   縦向き4個側 = パレット幅の約57% (2列×2行)
 */
function get35Layout(): LayerBox[][] {
  const layers: LayerBox[][] = [];
  // 左右の幅比率
  const leftW = 0.43;
  const rightW = 1 - leftW;

  for (let l = 0; l < 5; l++) {
    const boxes: LayerBox[] = [];
    if (l % 2 === 0) {
      // 奇数段: 左=横向き3個(縦に3段), 右=縦向き4個(2列×2行)
      // 左: 横向き3個 (幅leftW, 高さ1/3ずつ)
      for (let i = 0; i < 3; i++) {
        boxes.push({ rx: 0, ry: i * 0.333, rw: leftW, rd: 0.333 });
      }
      // 右: 縦向き2列×2行
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          boxes.push({
            rx: leftW + col * (rightW / 2),
            ry: row * 0.5,
            rw: rightW / 2,
            rd: 0.5,
          });
        }
      }
    } else {
      // 偶数段: 左=縦向き4個(2列×2行), 右=横向き3個(縦に3段) ← 左右逆
      // 左: 縦向き2列×2行
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          boxes.push({
            rx: col * (leftW / 2),
            ry: row * 0.5,
            rw: leftW / 2,
            rd: 0.5,
          });
        }
      }
      // 右: 横向き3個
      for (let i = 0; i < 3; i++) {
        boxes.push({ rx: leftW, ry: i * 0.333, rw: rightW, rd: 0.333 });
      }
    }
    layers.push(boxes);
  }
  return layers;
}

/** 汎用グリッドパターン */
function getGenericLayout(q: number): { layers: number; perLayer: number } {
  let layers = 5;
  let perLayer = Math.ceil(q / layers);
  if (perLayer > 8) {
    layers = Math.ceil(q / 7);
    perLayer = Math.ceil(q / layers);
  }
  return { layers, perLayer };
}

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** アイソメトリック3D箱を描画 */
function IsoBox({
  cx, cy, bw, bd, bh, filled, colors, opacity = 1,
}: {
  /** 前面左下のX */
  cx: number;
  /** 前面左下のY */
  cy: number;
  /** 前面の幅 */
  bw: number;
  /** 奥行き（上面のY方向） */
  bd: number;
  /** 高さ（前面の高さ） */
  bh: number;
  filled: boolean;
  colors: { accent: string };
  opacity?: number;
}) {
  if (!filled) {
    return (
      <g opacity={0.12}>
        <rect x={cx} y={cy - bh} width={bw} height={bh} rx={0.5}
          fill="none" stroke={colors.accent} strokeWidth={0.4} strokeDasharray="1.5,1.5" />
      </g>
    );
  }

  const isoX = bd * 0.55;
  const isoY = bd * 0.35;

  const topColor = colors.accent;
  const frontColor = adjustBrightness(colors.accent, -25);
  const sideColor = adjustBrightness(colors.accent, -50);

  const topY = cy - bh;

  return (
    <g opacity={opacity}>
      {/* 前面 */}
      <rect x={cx} y={topY} width={bw} height={bh} rx={0.4}
        fill={frontColor} stroke={adjustBrightness(frontColor, -15)} strokeWidth={0.25} />
      {/* 上面 */}
      <polygon
        points={`${cx},${topY} ${cx + isoX},${topY - isoY} ${cx + bw + isoX},${topY - isoY} ${cx + bw},${topY}`}
        fill={topColor} stroke={adjustBrightness(topColor, -10)} strokeWidth={0.25} />
      {/* 右側面 */}
      <polygon
        points={`${cx + bw},${topY} ${cx + bw + isoX},${topY - isoY} ${cx + bw + isoX},${topY + bh - isoY} ${cx + bw},${topY + bh}`}
        fill={sideColor} stroke={adjustBrightness(sideColor, -10)} strokeWidth={0.25} />
    </g>
  );
}

/** パレット台の3D描画 */
function IsoPallet({
  x, y, pw, ph, pd,
}: {
  x: number; y: number; pw: number; ph: number; pd: number;
}) {
  const isoX = pd * 0.55;
  const isoY = pd * 0.35;

  return (
    <g>
      {/* 前面 */}
      <rect x={x} y={y} width={pw} height={ph} rx={1}
        fill="#8D6E63" stroke="#6D4C41" strokeWidth={0.4} />
      {/* 上面 */}
      <polygon
        points={`${x},${y} ${x + isoX},${y - isoY} ${x + pw + isoX},${y - isoY} ${x + pw},${y}`}
        fill="#A1887F" stroke="#8D6E63" strokeWidth={0.3} />
      {/* 右側面 */}
      <polygon
        points={`${x + pw},${y} ${x + pw + isoX},${y - isoY} ${x + pw + isoX},${y + ph - isoY} ${x + pw},${y + ph}`}
        fill="#795548" stroke="#6D4C41" strokeWidth={0.3} />
      {/* スリット */}
      {[0.25, 0.5, 0.75].map((pct, i) => (
        <line key={`slit-${i}`}
          x1={x + pw * pct} y1={y + 1}
          x2={x + pw * pct} y2={y + ph - 1}
          stroke="#6D4C41" strokeWidth={0.4} />
      ))}
    </g>
  );
}

/** 30/35パターン用のインターロッキングパレットブロック描画 */
function InterlockingPalletBlock({
  ox, oy, filledBoxes, totalBoxes, qtyPerPallet, colors, label,
}: {
  ox: number; oy: number;
  filledBoxes: number; totalBoxes: number; qtyPerPallet: number;
  colors: { accent: string };
  label: string;
}) {
  const is30 = qtyPerPallet === 30;
  const is35 = qtyPerPallet === 35;

  if (!is30 && !is35) {
    // 汎用グリッド描画
    return (
      <GenericPalletBlock
        ox={ox} oy={oy}
        filledBoxes={filledBoxes} totalBoxes={totalBoxes}
        qtyPerPallet={qtyPerPallet} colors={colors} label={label}
      />
    );
  }

  const layoutLayers = is30 ? get30Layout() : get35Layout();
  const numLayers = layoutLayers.length;
  const perLayer = is30 ? 6 : 7;

  // パレット全体のサイズ
  const palletFrontW = 82;
  const palletDepth = 14;
  const layerH = 9;
  const gap = 0.5;
  const palletThick = 5;

  const totalStackH = numLayers * (layerH + gap);
  const isoDepth = palletDepth * 0.35;

  // パレット台のY位置
  const palletTopY = oy + totalStackH + isoDepth + 2;

  const elements: JSX.Element[] = [];

  // パレット台
  elements.push(
    <IsoPallet
      key={`${label}-pallet`}
      x={ox - 2} y={palletTopY}
      pw={palletFrontW + 4} ph={palletThick} pd={palletDepth}
    />
  );

  // 下の段から上に描画
  for (let l = numLayers - 1; l >= 0; l--) {
    const layer = layoutLayers[l];
    const layerBaseY = palletTopY - (numLayers - l) * (layerH + gap);

    for (let b = 0; b < layer.length; b++) {
      const globalIdx = l * perLayer + b;
      if (globalIdx >= totalBoxes) continue;

      const box = layer[b];
      const bx = ox + box.rx * palletFrontW;
      const bw = box.rw * palletFrontW - 1;
      const bd = box.rd * palletDepth;
      const isFilled = globalIdx < filledBoxes;

      elements.push(
        <IsoBox
          key={`${label}-${l}-${b}`}
          cx={bx}
          cy={layerBaseY + layerH}
          bw={bw}
          bd={bd}
          bh={layerH}
          filled={isFilled}
          colors={colors}
          opacity={isFilled ? 0.92 : 0.15}
        />
      );
    }
  }

  return <g>{elements}</g>;
}

/** 汎用グリッドパレットブロック */
function GenericPalletBlock({
  ox, oy, filledBoxes, totalBoxes, qtyPerPallet, colors, label,
}: {
  ox: number; oy: number;
  filledBoxes: number; totalBoxes: number; qtyPerPallet: number;
  colors: { accent: string };
  label: string;
}) {
  const { layers, perLayer } = getGenericLayout(qtyPerPallet);
  const boxW = 12;
  const boxH = 8;
  const depth = 8;
  const gapX = 1;
  const gapLayer = 0.5;
  const palletThick = 5;

  const totalStackH = layers * (boxH + gapLayer);
  const isoDepth = depth * 0.35;
  const palletTopY = oy + totalStackH + isoDepth + 2;
  const palletFrontW = perLayer * (boxW + gapX) + 2;

  const elements: JSX.Element[] = [];
  let boxIdx = 0;

  elements.push(
    <IsoPallet
      key={`${label}-pallet`}
      x={ox - 1} y={palletTopY}
      pw={palletFrontW + 2} ph={palletThick} pd={depth}
    />
  );

  for (let l = layers - 1; l >= 0; l--) {
    const layerBaseY = palletTopY - (layers - l) * (boxH + gapLayer);
    for (let c = 0; c < perLayer; c++) {
      if (boxIdx >= totalBoxes) break;
      const isFilled = boxIdx < filledBoxes;
      elements.push(
        <IsoBox
          key={`${label}-${l}-${c}`}
          cx={ox + c * (boxW + gapX)}
          cy={layerBaseY + boxH}
          bw={boxW}
          bd={depth}
          bh={boxH}
          filled={isFilled}
          colors={colors}
          opacity={isFilled ? 0.92 : 0.15}
        />
      );
      boxIdx++;
    }
  }

  return <g>{elements}</g>;
}

/** パレットブロックのサイズを計算 */
function calcBlockSize(qtyPerPallet: number): { w: number; h: number } {
  if (qtyPerPallet === 30 || qtyPerPallet === 35) {
    const palletFrontW = 82;
    const palletDepth = 14;
    const numLayers = 5;
    const layerH = 9;
    const gap = 0.5;
    const palletThick = 5;
    const isoX = palletDepth * 0.55;
    const isoY = palletDepth * 0.35;
    return {
      w: palletFrontW + isoX + 8,
      h: numLayers * (layerH + gap) + isoY + palletThick + 8,
    };
  }
  const { layers, perLayer } = getGenericLayout(qtyPerPallet);
  const boxW = 12;
  const boxH = 8;
  const depth = 8;
  const gapX = 1;
  const gapLayer = 0.5;
  const palletThick = 5;
  const isoX = depth * 0.55;
  const isoY = depth * 0.35;
  return {
    w: perLayer * (boxW + gapX) + isoX + 6,
    h: layers * (boxH + gapLayer) + isoY + palletThick + 8,
  };
}

export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type,
}: PalletDiagramProps) {
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const blockSize = calcBlockSize(qtyPerPallet);

  const showFraction = fraction > 0;
  const totalBlocks = palletCount + (showFraction ? 1 : 0);
  const displayBlocks = Math.min(totalBlocks, 2);
  const blockGap = 8;

  const svgW = Math.max(displayBlocks * (blockSize.w + blockGap) - blockGap + 4, 80);
  const svgH = blockSize.h + 16;

  return (
    <div className="pallet-diagram-container">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '200px' }}
      >
        {/* 満載パレット */}
        {Array.from({ length: Math.min(palletCount, showFraction ? 1 : 2) }).map(
          (_, i) => (
            <InterlockingPalletBlock
              key={`full-${i}`}
              ox={4 + i * (blockSize.w + blockGap)}
              oy={4}
              filledBoxes={qtyPerPallet}
              totalBoxes={qtyPerPallet}
              qtyPerPallet={qtyPerPallet}
              colors={colors}
              label={`full-${i}`}
            />
          )
        )}

        {/* 端数パレット */}
        {showFraction && (
          <InterlockingPalletBlock
            ox={4 + Math.min(palletCount, 1) * (blockSize.w + blockGap)}
            oy={4}
            filledBoxes={fraction}
            totalBoxes={qtyPerPallet}
            qtyPerPallet={qtyPerPallet}
            colors={colors}
            label="frac"
          />
        )}
      </svg>

      <div className="pallet-info">
        {palletCount > 0 && (
          <span className="pallet-count">
            {palletCount}パレット
          </span>
        )}
        {fraction > 0 && (
          <span className="pallet-fraction">
            + 端数 {fraction}ケース
          </span>
        )}
        {totalBlocks > 2 && (
          <span className="pallet-more">
            (他{totalBlocks - 2}パレット)
          </span>
        )}
      </div>
    </div>
  );
}
