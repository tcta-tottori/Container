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
 * パレットあたりのケース数から段数と1段あたりの個数を推定
 * 35個: 5段×7個 (写真参考パターン)
 * 30個: 5段×6個 or 6段×5個
 */
function estimateLayout(q: number): { perLayer: number; layers: number; pattern: number[][] } {
  if (q <= 0) return { perLayer: 1, layers: 1, pattern: [[1]] };

  // 35個パターン: 5段、各段7個 (交互配置)
  if (q === 35) {
    return {
      perLayer: 7,
      layers: 5,
      pattern: [
        // 各段の配置パターン (0=横向き, 1=縦向き)
        // 奇数段: 3横+4縦の交互パターン
        [0, 0, 0, 1, 1, 1, 1],
        [1, 1, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 1],
        [1, 1, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 1],
      ],
    };
  }

  // 30個パターン: 5段×6個
  if (q === 30) {
    return {
      perLayer: 6,
      layers: 5,
      pattern: [
        [0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 1],
      ],
    };
  }

  // 25個パターン: 5段×5個
  if (q === 25) {
    return {
      perLayer: 5,
      layers: 5,
      pattern: Array.from({ length: 5 }, (_, i) =>
        i % 2 === 0 ? [0, 0, 1, 1, 1] : [1, 1, 1, 0, 0]
      ),
    };
  }

  // その他: 段数と1段個数を推定
  let layers = 5;
  let perLayer = Math.ceil(q / layers);
  if (perLayer > 8) {
    layers = Math.ceil(q / 7);
    perLayer = Math.ceil(q / layers);
  }

  const pattern = Array.from({ length: layers }, (_, i) =>
    Array.from({ length: perLayer }, (_, j) =>
      (i + j) % 2 === 0 ? 0 : 1
    )
  );

  return { perLayer, layers, pattern };
}

/** 3Dアイソメトリック箱を描画 */
function Box3D({
  x, y, w, h, d, filled, colors, opacity = 1,
}: {
  x: number; y: number; w: number; h: number; d: number;
  filled: boolean; colors: { bg: string; accent: string; text: string };
  opacity?: number;
}) {
  if (!filled) {
    // 空の位置はゴースト表示
    return (
      <g opacity={0.15}>
        <rect x={x} y={y} width={w} height={h} rx={1}
          fill="none" stroke={colors.accent} strokeWidth={0.5} strokeDasharray="2,2" />
      </g>
    );
  }

  // アイソメトリック3D箱
  const topColor = colors.accent;
  const frontColor = adjustBrightness(colors.accent, -20);
  const sideColor = adjustBrightness(colors.accent, -40);

  return (
    <g opacity={opacity}>
      {/* 前面 */}
      <rect x={x} y={y} width={w} height={h} rx={0.5}
        fill={frontColor} stroke={adjustBrightness(frontColor, -15)} strokeWidth={0.3} />
      {/* 上面（平行四辺形） */}
      <polygon
        points={`${x},${y} ${x + d * 0.6},${y - d * 0.4} ${x + w + d * 0.6},${y - d * 0.4} ${x + w},${y}`}
        fill={topColor} stroke={adjustBrightness(topColor, -10)} strokeWidth={0.3} />
      {/* 右側面（平行四辺形） */}
      <polygon
        points={`${x + w},${y} ${x + w + d * 0.6},${y - d * 0.4} ${x + w + d * 0.6},${y + h - d * 0.4} ${x + w},${y + h}`}
        fill={sideColor} stroke={adjustBrightness(sideColor, -10)} strokeWidth={0.3} />
    </g>
  );
}

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function PalletBlock({
  x, y, filledBoxes, totalBoxes, qtyPerPallet, colors, label,
}: {
  x: number; y: number; filledBoxes: number; totalBoxes: number;
  qtyPerPallet: number; colors: { bg: string; accent: string; text: string };
  label: string;
}) {
  const { perLayer, layers } = estimateLayout(qtyPerPallet);
  const boxW = 12;
  const boxH = 7;
  const depth = 6;
  const gapX = 1.5;
  const gapY = 1;

  let boxIdx = 0;
  const boxes = [];

  // 下の段から上に描画（奥から手前へ）
  for (let layer = layers - 1; layer >= 0; layer--) {
    for (let col = 0; col < perLayer; col++) {
      if (boxIdx >= totalBoxes) break;
      const bx = x + col * (boxW + gapX);
      const by = y + layer * (boxH + gapY);
      const isFilled = boxIdx < filledBoxes;

      boxes.push(
        <Box3D
          key={`${label}-${boxIdx}`}
          x={bx}
          y={by}
          w={boxW}
          h={boxH}
          d={depth}
          filled={isFilled}
          colors={colors}
          opacity={isFilled ? 0.95 : 0.2}
        />
      );
      boxIdx++;
    }
  }

  // パレット台（3D）
  const palletY = y + layers * (boxH + gapY);
  const palletW = perLayer * (boxW + gapX) + 4;
  const palletH = 5;

  return (
    <g>
      {/* パレット台 - 前面 */}
      <rect x={x - 2} y={palletY} width={palletW} height={palletH} rx={1}
        fill="#8D6E63" stroke="#6D4C41" strokeWidth={0.5} />
      {/* パレット台 - 上面 */}
      <polygon
        points={`${x - 2},${palletY} ${x - 2 + depth * 0.6},${palletY - depth * 0.4} ${x + palletW + depth * 0.6 - 2},${palletY - depth * 0.4} ${x + palletW - 2},${palletY}`}
        fill="#A1887F" stroke="#8D6E63" strokeWidth={0.3} />
      {/* パレット台 - 右側面 */}
      <polygon
        points={`${x + palletW - 2},${palletY} ${x + palletW + depth * 0.6 - 2},${palletY - depth * 0.4} ${x + palletW + depth * 0.6 - 2},${palletY + palletH - depth * 0.4} ${x + palletW - 2},${palletY + palletH}`}
        fill="#795548" stroke="#6D4C41" strokeWidth={0.3} />
      {/* パレット台スリット */}
      {[0.2, 0.5, 0.8].map((pct, i) => (
        <line key={`slit-${label}-${i}`}
          x1={x - 2 + palletW * pct} y1={palletY + 1}
          x2={x - 2 + palletW * pct} y2={palletY + palletH - 1}
          stroke="#6D4C41" strokeWidth={0.5} />
      ))}
      {/* 箱 */}
      {boxes}
    </g>
  );
}

export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type,
}: PalletDiagramProps) {
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const { perLayer, layers } = estimateLayout(qtyPerPallet);

  const boxW = 12;
  const boxH = 7;
  const depth = 6;
  const gapX = 1.5;
  const gapY = 1;

  const blockW = perLayer * (boxW + gapX) + depth * 0.6 + 4;
  const blockH = layers * (boxH + gapY) + depth * 0.4 + 12;

  const showFraction = fraction > 0;
  const totalBlocks = palletCount + (showFraction ? 1 : 0);
  const displayBlocks = Math.min(totalBlocks, 3);
  const blockGap = 10;

  const svgW = Math.max(displayBlocks * (blockW + blockGap) - blockGap + 8, 100);
  const svgH = blockH + 20;

  return (
    <div className="pallet-diagram-container">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '180px' }}
      >
        <defs>
          <linearGradient id={`grad-${type}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.accent} stopOpacity={0.1} />
            <stop offset="100%" stopColor={colors.accent} stopOpacity={0.03} />
          </linearGradient>
        </defs>

        {/* 満載パレット */}
        {Array.from({ length: Math.min(palletCount, showFraction ? 2 : 3) }).map(
          (_, i) => (
            <PalletBlock
              key={`full-${i}`}
              x={4 + i * (blockW + blockGap)}
              y={4}
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
          <PalletBlock
            x={4 + Math.min(palletCount, 2) * (blockW + blockGap)}
            y={4}
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
        {totalBlocks > 3 && (
          <span className="pallet-more">
            (他{totalBlocks - 3}パレット)
          </span>
        )}
      </div>
    </div>
  );
}
