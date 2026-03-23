'use client';

import { ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface PalletDiagramProps {
  palletCount: number;
  fraction: number;
  qtyPerPallet: number;
  type: ItemType;
}

/** Qから列数と段数を推定 */
function estimateLayout(q: number): { cols: number; rows: number } {
  if (q <= 12) return { cols: 3, rows: Math.ceil(q / 3) };
  if (q <= 20) return { cols: 5, rows: Math.ceil(q / 5) };
  if (q <= 30) return { cols: 6, rows: Math.ceil(q / 6) };
  if (q <= 35) return { cols: 7, rows: Math.ceil(q / 7) };
  return { cols: 6, rows: Math.ceil(q / 6) };
}

export default function PalletDiagram({
  palletCount,
  fraction,
  qtyPerPallet,
  type,
}: PalletDiagramProps) {
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const { cols, rows } = estimateLayout(qtyPerPallet);

  const boxW = 14;
  const boxH = 10;
  const gap = 2;
  const palletH = 6;

  // 1パレットブロックの幅・高さ
  const blockW = cols * (boxW + gap) - gap;
  const blockH = rows * (boxH + gap) - gap + palletH + 2;

  // 表示するパレット: 満載 + 端数(あれば)
  const showFraction = fraction > 0;
  const totalBlocks = palletCount + (showFraction ? 1 : 0);

  // 最大3ブロック横並び、それ以上はテキスト表示
  const displayBlocks = Math.min(totalBlocks, 3);
  const blockGap = 8;
  const svgW = displayBlocks * (blockW + blockGap) - blockGap + 4;
  const svgH = blockH + 20;

  const renderPallet = (
    x: number,
    y: number,
    filledBoxes: number,
    totalBoxes: number,
    label: string
  ) => {
    const elements = [];
    let boxIdx = 0;

    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < cols; col++) {
        if (boxIdx >= totalBoxes) break;
        const bx = x + col * (boxW + gap);
        const by = y + row * (boxH + gap);
        const isFilled = boxIdx < filledBoxes;

        elements.push(
          <rect
            key={`${label}-${boxIdx}`}
            x={bx}
            y={by}
            width={boxW}
            height={boxH}
            rx={1}
            fill={isFilled ? colors.accent : 'none'}
            stroke={isFilled ? colors.text : colors.accent}
            strokeWidth={isFilled ? 0 : 1}
            strokeDasharray={isFilled ? 'none' : '2,2'}
            opacity={isFilled ? 0.9 : 0.4}
          />
        );
        boxIdx++;
      }
    }

    // パレット台
    const palletY = y + rows * (boxH + gap) - gap + 2;
    elements.push(
      <rect
        key={`${label}-pallet`}
        x={x - 2}
        y={palletY}
        width={blockW + 4}
        height={palletH}
        rx={1}
        fill="#8D6E63"
        opacity={0.7}
      />
    );

    return elements;
  };

  return (
    <div className="flex flex-col items-start">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="mb-1"
      >
        {/* 満載パレット（最大2つ表示） */}
        {Array.from({ length: Math.min(palletCount, showFraction ? 2 : 3) }).map(
          (_, i) => (
            <g key={`full-${i}`}>
              {renderPallet(
                2 + i * (blockW + blockGap),
                2,
                qtyPerPallet,
                qtyPerPallet,
                `full-${i}`
              )}
            </g>
          )
        )}

        {/* 端数パレット */}
        {showFraction && (
          <g>
            {renderPallet(
              2 + Math.min(palletCount, 2) * (blockW + blockGap),
              2,
              fraction,
              qtyPerPallet,
              'frac'
            )}
          </g>
        )}
      </svg>

      <div className="text-xs" style={{ color: colors.text, opacity: 0.8 }}>
        {palletCount > 0 && `× ${palletCount}パレット`}
        {fraction > 0 && ` + 端数 ${fraction}ケース`}
      </div>
    </div>
  );
}
