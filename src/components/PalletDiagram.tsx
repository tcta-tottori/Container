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
// 3D座標 (x右, y奥, z上) → 2D画面座標
const ISO_ANGLE = Math.PI / 6; // 30度
const COS = Math.cos(ISO_ANGLE);
const SIN = Math.sin(ISO_ANGLE);

function isoProject(x3d: number, y3d: number, z3d: number): { x: number; y: number } {
  return {
    x: (x3d - y3d) * COS,
    y: (x3d + y3d) * SIN - z3d,
  };
}

/* ===== 色ユーティリティ ===== */
function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/* ===== アイソメトリック3Dボックス ===== */
function IsoBox3D({
  x3d, y3d, z3d, w, d, h, filled, accent, opacity = 1,
}: {
  x3d: number; y3d: number; z3d: number;
  w: number; d: number; h: number;
  filled: boolean; accent: string; opacity?: number;
}) {
  if (!filled) {
    // ゴースト（空き位置）
    const p0 = isoProject(x3d, y3d, z3d);
    const p1 = isoProject(x3d + w, y3d, z3d);
    const p2 = isoProject(x3d + w, y3d + d, z3d);
    const p3 = isoProject(x3d, y3d + d, z3d);
    const top = `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
    return (
      <polygon points={top} fill="none" stroke={accent} strokeWidth={0.3}
        strokeDasharray="2,2" opacity={0.15} />
    );
  }

  const topColor = accent;
  const frontColor = adjustBrightness(accent, -30);
  const sideColor = adjustBrightness(accent, -55);
  const strokeColor = adjustBrightness(accent, -70);

  // 8頂点
  const ftl = isoProject(x3d, y3d, z3d + h);       // front-top-left
  const ftr = isoProject(x3d + w, y3d, z3d + h);    // front-top-right
  const fbr = isoProject(x3d + w, y3d, z3d);         // front-bottom-right
  const fbl = isoProject(x3d, y3d, z3d);              // front-bottom-left
  const btl = isoProject(x3d, y3d + d, z3d + h);    // back-top-left
  const btr = isoProject(x3d + w, y3d + d, z3d + h); // back-top-right
  const bbr = isoProject(x3d + w, y3d + d, z3d);      // back-bottom-right

  const topFace = `${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`;
  const frontFace = `${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${fbr.x},${fbr.y} ${fbl.x},${fbl.y}`;
  const rightFace = `${ftr.x},${ftr.y} ${btr.x},${btr.y} ${bbr.x},${bbr.y} ${fbr.x},${fbr.y}`;

  return (
    <g opacity={opacity}>
      <polygon points={frontFace} fill={frontColor} stroke={strokeColor} strokeWidth={0.4} />
      <polygon points={rightFace} fill={sideColor} stroke={strokeColor} strokeWidth={0.4} />
      <polygon points={topFace} fill={topColor} stroke={strokeColor} strokeWidth={0.4} />
    </g>
  );
}

/* ===== アイソメトリックパレット台 ===== */
function IsoPallet3D({
  x3d, y3d, z3d, pw, pd, ph,
}: {
  x3d: number; y3d: number; z3d: number;
  pw: number; pd: number; ph: number;
}) {
  const palletColor = '#7a8a7a';
  const palletDark = '#5a6a5a';
  const palletTop = '#8a9a8a';
  const stroke = '#4a5a4a';

  const ftl = isoProject(x3d, y3d, z3d + ph);
  const ftr = isoProject(x3d + pw, y3d, z3d + ph);
  const fbr = isoProject(x3d + pw, y3d, z3d);
  const fbl = isoProject(x3d, y3d, z3d);
  const btl = isoProject(x3d, y3d + pd, z3d + ph);
  const btr = isoProject(x3d + pw, y3d + pd, z3d + ph);
  const bbr = isoProject(x3d + pw, y3d + pd, z3d);

  const topFace = `${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${btr.x},${btr.y} ${btl.x},${btl.y}`;
  const frontFace = `${ftl.x},${ftl.y} ${ftr.x},${ftr.y} ${fbr.x},${fbr.y} ${fbl.x},${fbl.y}`;
  const rightFace = `${ftr.x},${ftr.y} ${btr.x},${btr.y} ${bbr.x},${bbr.y} ${fbr.x},${fbr.y}`;

  // 前面の穴（フォークリフト用）
  const holeW = pw * 0.25;
  const holeH = ph * 0.5;
  const holeZ = z3d + ph * 0.15;

  const holes = [0.15, 0.55].map((pct, i) => {
    const hx = x3d + pw * pct;
    const h0 = isoProject(hx, y3d, holeZ + holeH);
    const h1 = isoProject(hx + holeW, y3d, holeZ + holeH);
    const h2 = isoProject(hx + holeW, y3d, holeZ);
    const h3 = isoProject(hx, y3d, holeZ);
    return (
      <polygon key={`hole-f-${i}`}
        points={`${h0.x},${h0.y} ${h1.x},${h1.y} ${h2.x},${h2.y} ${h3.x},${h3.y}`}
        fill="#3a4a3a" stroke={stroke} strokeWidth={0.3} />
    );
  });

  // 右側面の穴
  const sideHoles = [0.15, 0.55].map((pct, i) => {
    const hy = y3d + pd * pct;
    const hd = pd * 0.25;
    const h0 = isoProject(x3d + pw, hy, holeZ + holeH);
    const h1 = isoProject(x3d + pw, hy + hd, holeZ + holeH);
    const h2 = isoProject(x3d + pw, hy + hd, holeZ);
    const h3 = isoProject(x3d + pw, hy, holeZ);
    return (
      <polygon key={`hole-r-${i}`}
        points={`${h0.x},${h0.y} ${h1.x},${h1.y} ${h2.x},${h2.y} ${h3.x},${h3.y}`}
        fill="#3a4a3a" stroke={stroke} strokeWidth={0.3} />
    );
  });

  return (
    <g>
      <polygon points={frontFace} fill={palletColor} stroke={stroke} strokeWidth={0.5} />
      <polygon points={rightFace} fill={palletDark} stroke={stroke} strokeWidth={0.5} />
      <polygon points={topFace} fill={palletTop} stroke={stroke} strokeWidth={0.5} />
      {holes}
      {sideHoles}
    </g>
  );
}

/* ===== レイアウト定義 ===== */
interface BoxPos { col: number; row: number; bw: number; bd: number; }

function get30Layout(): BoxPos[][] {
  // 3列×2行, 全段同じ
  const layer: BoxPos[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      layer.push({ col, row, bw: 1, bd: 1 });
    }
  }
  return Array.from({ length: 5 }, () => [...layer]);
}

function get35Layout(): BoxPos[][] {
  const layers: BoxPos[][] = [];
  for (let l = 0; l < 5; l++) {
    const boxes: BoxPos[] = [];
    if (l % 2 === 0) {
      // 左: 横向き3個(col0, row0-2) → 幅43%, 奥行33%ずつ
      for (let i = 0; i < 3; i++) {
        boxes.push({ col: 0, row: i, bw: 1.3, bd: 0.67 });
      }
      // 右: 縦向き2×2
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          boxes.push({ col: 1.3 + c * 0.85, row: r * 1.0, bw: 0.85, bd: 1.0 });
        }
      }
    } else {
      // 左: 縦向き2×2
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          boxes.push({ col: c * 0.85, row: r * 1.0, bw: 0.85, bd: 1.0 });
        }
      }
      // 右: 横向き3個
      for (let i = 0; i < 3; i++) {
        boxes.push({ col: 1.7, row: i, bw: 1.3, bd: 0.67 });
      }
    }
    layers.push(boxes);
  }
  return layers;
}

function getGenericLayout(q: number): { layers: number; cols: number; rows: number } {
  if (q <= 4) return { layers: Math.ceil(q / 2), cols: 2, rows: 1 };
  if (q <= 12) return { layers: Math.ceil(q / 4), cols: 2, rows: 2 };
  if (q <= 20) return { layers: 4, cols: Math.ceil(q / 4 / 2), rows: 2 };
  return { layers: 5, cols: Math.ceil(q / 5 / 2), rows: 2 };
}

/* ===== 端数充填マップ ===== */
function buildFilledMap(numLayers: number, perLayer: number, filled: number, total: number): boolean[][] {
  if (filled >= total) {
    return Array.from({ length: numLayers }, () => Array(perLayer).fill(true));
  }
  const map = Array.from({ length: numLayers }, () => Array(perLayer).fill(false));
  let rem = filled;
  for (let l = 0; l < numLayers && rem > 0; l++) {
    if (rem >= perLayer) {
      map[l] = Array(perLayer).fill(true);
      rem -= perLayer;
    } else {
      // 四隅優先
      const corners = perLayer === 6 ? [0, 2, 3, 5] : perLayer === 7 ? [0, 2, 3, 6] : [0, perLayer - 1];
      const mid = Array.from({ length: perLayer }, (_, i) => i).filter(i => !corners.includes(i));
      const order = [...corners, ...mid];
      for (let i = 0; i < rem && i < order.length; i++) {
        map[l][order[i]] = true;
      }
      rem = 0;
    }
  }
  return map;
}

/* ===== パレットブロック描画 ===== */
function PalletBlock({
  ox, oy, filledBoxes, totalBoxes, qtyPerPallet, accent, label,
}: {
  ox: number; oy: number;
  filledBoxes: number; totalBoxes: number; qtyPerPallet: number;
  accent: string; label: string;
}) {
  const is30 = qtyPerPallet === 30;
  const is35 = qtyPerPallet === 35;

  // パレット台の3Dサイズ
  const palletW = 30;
  const palletD = 30;
  const palletH = 3;

  // 箱の基本サイズ
  const boxH = 5;

  const elements: JSX.Element[] = [];

  if (is30 || is35) {
    const layoutLayers = is30 ? get30Layout() : get35Layout();
    const perLayer = is30 ? 6 : 7;
    const filledMap = buildFilledMap(layoutLayers.length, perLayer, filledBoxes, totalBoxes);

    // 表示段数
    let topLayer = 0;
    for (let l = 0; l < layoutLayers.length; l++) {
      if (filledMap[l].some(Boolean)) topLayer = l;
    }
    const displayLayers = topLayer + 1;

    // パレット台
    elements.push(
      <IsoPallet3D key={`${label}-p`}
        x3d={0} y3d={0} z3d={0} pw={palletW} pd={palletD} ph={palletH} />
    );

    // 箱の描画（奥→手前、下→上の順で描画）
    for (let l = 0; l < displayLayers; l++) {
      const layer = layoutLayers[l];
      const z = palletH + l * boxH;

      if (is30) {
        // 3列×2行、均等配置
        const bw = palletW / 3;
        const bd = palletD / 2;
        // 奥の行から描画
        for (let row = 1; row >= 0; row--) {
          for (let col = 0; col < 3; col++) {
            const idx = row * 3 + col;
            elements.push(
              <IsoBox3D key={`${label}-${l}-${idx}`}
                x3d={col * bw} y3d={row * bd} z3d={z}
                w={bw - 0.5} d={bd - 0.5} h={boxH - 0.3}
                filled={filledMap[l][idx]} accent={accent}
                opacity={filledMap[l][idx] ? 0.95 : 0.1} />
            );
          }
        }
      } else {
        // 35個: カスタムレイアウト、奥の箱から描画
        const sorted = layer.map((b, i) => ({ ...b, idx: i }))
          .sort((a, b) => b.row - a.row || a.col - b.col);

        const scale = palletW / 3;
        for (const box of sorted) {
          elements.push(
            <IsoBox3D key={`${label}-${l}-${box.idx}`}
              x3d={box.col * scale} y3d={box.row * (palletD / 2)} z3d={z}
              w={box.bw * scale - 0.5} d={box.bd * (palletD / 2) - 0.5} h={boxH - 0.3}
              filled={filledMap[l][box.idx]} accent={accent}
              opacity={filledMap[l][box.idx] ? 0.95 : 0.1} />
          );
        }
      }
    }
  } else {
    // 汎用グリッド
    const { layers, cols, rows } = getGenericLayout(qtyPerPallet);
    const perLayer = cols * rows;
    const filledMap = buildFilledMap(layers, perLayer, filledBoxes, totalBoxes);

    let topLayer = 0;
    for (let l = 0; l < layers; l++) {
      if (filledMap[l].some(Boolean)) topLayer = l;
    }
    const displayLayers = topLayer + 1;

    const bw = palletW / cols;
    const bd = palletD / rows;

    elements.push(
      <IsoPallet3D key={`${label}-p`}
        x3d={0} y3d={0} z3d={0} pw={palletW} pd={palletD} ph={palletH} />
    );

    for (let l = 0; l < displayLayers; l++) {
      const z = palletH + l * boxH;
      for (let row = rows - 1; row >= 0; row--) {
        for (let col = 0; col < cols; col++) {
          const i = row * cols + col;
          elements.push(
            <IsoBox3D key={`${label}-${l}-${i}`}
              x3d={col * bw} y3d={row * bd} z3d={z}
              w={bw - 0.5} d={bd - 0.5} h={boxH - 0.3}
              filled={filledMap[l][i]} accent={accent}
              opacity={filledMap[l][i] ? 0.95 : 0.1} />
          );
        }
      }
    }
  }

  // ox, oyでオフセット
  return <g transform={`translate(${ox}, ${oy})`}>{elements}</g>;
}

/* ===== メインコンポーネント ===== */
export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type,
}: PalletDiagramProps) {
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];

  const showFraction = fraction > 0;
  const totalBlocks = palletCount + (showFraction ? 1 : 0);
  const displayBlocks = Math.min(totalBlocks, 2);

  // SVGサイズ（アイソメトリック投影後のサイズを概算）
  const blockW = 65;
  const blockH = 70;
  const blockGap = 10;

  const svgW = Math.max(displayBlocks * (blockW + blockGap), 70);
  const svgH = blockH + 10;

  // 中央のオフセット（アイソメトリックはX方向が負にもなるので）
  const centerX = svgW / (displayBlocks > 1 ? 2.5 : 2);
  const centerY = svgH * 0.7;

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
        {Array.from({ length: Math.min(palletCount, showFraction ? 1 : 2) }).map((_, i) => (
          <PalletBlock
            key={`full-${i}`}
            ox={centerX + i * (blockW + blockGap)}
            oy={centerY}
            filledBoxes={qtyPerPallet}
            totalBoxes={qtyPerPallet}
            qtyPerPallet={qtyPerPallet}
            accent={colors.accent}
            label={`full-${i}`}
          />
        ))}

        {/* 端数パレット */}
        {showFraction && (
          <PalletBlock
            ox={centerX + Math.min(palletCount, 1) * (blockW + blockGap)}
            oy={centerY}
            filledBoxes={fraction}
            totalBoxes={qtyPerPallet}
            qtyPerPallet={qtyPerPallet}
            accent={colors.accent}
            label="frac"
          />
        )}
      </svg>

      <div className="pallet-info">
        {palletCount > 0 && <span className="pallet-count">{palletCount}パレット</span>}
        {fraction > 0 && <span className="pallet-fraction">+ 端数 {fraction}ケース</span>}
        {totalBlocks > 2 && <span className="pallet-more">(他{totalBlocks - 2}パレット)</span>}
      </div>
    </div>
  );
}
