'use client';

import React from 'react';
import { ItemType } from '@/lib/types';
import { cardboardFace } from './SizeDiagram';

interface PalletDiagramProps {
  palletCount: number;
  fraction: number;
  qtyPerPallet: number;
  type: ItemType;
  itemName?: string;
  measurements?: string;
}

/* ===== Constants ===== */
const PALLET_CM = 110;
const PALLET_PX = 80; // CSS px for 110cm pallet
const CM2PX = PALLET_PX / PALLET_CM;
const PALLET_H_PX = 8; // pallet base height in px

/* ===== Parse measurements ===== */
function parseMeas(s: string): [number, number, number] | null {
  const m = s.match(/(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

/* ===== Stack layers (exported for use by other components) ===== */
export function calculateStackLayers(
  type: ItemType, itemName: string, qtyPerPallet: number, measurements?: string,
): number {
  if (type === 'ジャーポット' || /^(PDR|PDU|PVW)/.test(itemName)) {
    const m = itemName.match(/(30|40|50)/);
    return m && parseInt(m[1]) >= 50 ? 4 : 5;
  }
  if (type === 'ポリカバー' || type === '鍋') {
    return (itemName.includes('180') || /18[RWCS]/.test(itemName)) ? 4 : 5;
  }
  if (measurements && qtyPerPallet > 0) {
    const dims = parseMeas(measurements);
    if (dims) {
      const perLayer = Math.max(1, Math.floor(PALLET_CM / dims[0])) * Math.max(1, Math.floor(PALLET_CM / dims[1]));
      return Math.min(Math.max(1, Math.ceil(qtyPerPallet / perLayer)), 5);
    }
  }
  return 0;
}

/* ===== Pallet face style (dark plastic) ===== */
function palletFace(brightness: number): React.CSSProperties {
  const r = Math.round(45 * brightness + 35);
  const g = Math.round(50 * brightness + 40);
  const b = Math.round(60 * brightness + 50);
  return {
    background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.1) 100%), rgb(${r},${g},${b})`,
    border: `1px solid rgb(${Math.round(r * 0.6)},${Math.round(g * 0.6)},${Math.round(b * 0.6)})`,
    borderRadius: 2,
    boxSizing: 'border-box' as const,
    backfaceVisibility: 'hidden' as const,
  };
}

/* ===== CSS 3D Pallet Base (110×110cm) ===== */
function PalletBase3D({ pw, pd, ph, topOffset }: { pw: number; pd: number; ph: number; topOffset: number }) {
  const forkW = pw * 0.2;
  const forkH = ph * 0.4;
  const forkY = ph * 0.3;

  return (
    <div style={{ position: 'absolute', left: 0, top: topOffset, width: pw, height: ph, transformStyle: 'preserve-3d' }}>
      {/* Front */}
      <div style={{ position: 'absolute', width: pw, height: ph, transform: `translateZ(${pd / 2}px)`, ...palletFace(0.5) }}>
        {[0.12, 0.55].map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p * 100}%`, top: forkY, width: forkW, height: forkH, background: '#0a0e14', borderRadius: 1 }} />
        ))}
      </div>
      {/* Back */}
      <div style={{ position: 'absolute', width: pw, height: ph, transform: `rotateY(180deg) translateZ(${pd / 2}px)`, ...palletFace(0.3) }} />
      {/* Left */}
      <div style={{ position: 'absolute', width: pd, height: ph, left: (pw - pd) / 2, transform: `rotateY(-90deg) translateZ(${pw / 2}px)`, ...palletFace(0.4) }}>
        {[0.12, 0.55].map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p * 100}%`, top: forkY, width: pd * 0.2, height: forkH, background: '#0a0e14', borderRadius: 1 }} />
        ))}
      </div>
      {/* Right */}
      <div style={{ position: 'absolute', width: pd, height: ph, left: (pw - pd) / 2, transform: `rotateY(90deg) translateZ(${pw / 2}px)`, ...palletFace(0.45) }}>
        {[0.12, 0.55].map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p * 100}%`, top: forkY, width: pd * 0.2, height: forkH, background: '#0a0e14', borderRadius: 1 }} />
        ))}
      </div>
      {/* Top with X-groove pattern */}
      <div style={{
        position: 'absolute', width: pw, height: pd, top: (ph - pd) / 2,
        transform: `rotateX(90deg) translateZ(${ph / 2}px)`, ...palletFace(0.6),
      }}>
        {/* 2×2 X-pattern grooves */}
        {[0, 1].map(qi => [0, 1].map(qj => {
          const qw = pw / 2;
          const qd = pd / 2;
          const x = qi * qw + qw * 0.1;
          const y = qj * qd + qd * 0.1;
          const w = qw * 0.8;
          const h = qd * 0.8;
          return (
            <React.Fragment key={`${qi}-${qj}`}>
              <div style={{
                position: 'absolute', left: x, top: y, width: w, height: h,
                border: '0.5px solid rgba(60,70,85,0.4)',
                background: `
                  linear-gradient(45deg, transparent 48%, rgba(60,70,85,0.3) 48%, rgba(60,70,85,0.3) 52%, transparent 52%),
                  linear-gradient(-45deg, transparent 48%, rgba(60,70,85,0.3) 48%, rgba(60,70,85,0.3) 52%, transparent 52%)
                `,
                boxSizing: 'border-box',
              }} />
            </React.Fragment>
          );
        }))}
      </div>
      {/* Bottom */}
      <div style={{ position: 'absolute', width: pw, height: pd, top: (ph - pd) / 2, transform: `rotateX(-90deg) translateZ(${ph / 2}px)`, ...palletFace(0.2) }} />
    </div>
  );
}

/* ===== CSS 3D Cardboard Box ===== */
function Box3D({ x, w, d, h, topBase }: {
  x: number; y: number; z: number; w: number; d: number; h: number;
  topBase: number;
}) {
  // topBase = totalHeight - PALLET_H_PX - z - h (inverted so z=0 is just above pallet)
  const top = topBase;
  const left = x;

  return (
    <div style={{ position: 'absolute', left, top, transformStyle: 'preserve-3d' }}>
      {/* Front */}
      <div style={{
        position: 'absolute', width: w, height: h,
        transform: `translateZ(${pd2(d)}px)`,
        ...cardboardFace(0.55),
      }}>
        {/* Tape wrap down front center */}
        <div style={{ position: 'absolute', left: `${50 - 6}%`, top: 0, width: '12%', height: '28%', background: 'rgba(200,180,140,0.35)' }} />
      </div>
      {/* Back */}
      <div style={{ position: 'absolute', width: w, height: h, transform: `rotateY(180deg) translateZ(${pd2(d)}px)`, ...cardboardFace(0.3) }} />
      {/* Left */}
      <div style={{ position: 'absolute', width: d, height: h, left: (w - d) / 2, transform: `rotateY(-90deg) translateZ(${w / 2}px)`, ...cardboardFace(0.4) }} />
      {/* Right */}
      <div style={{ position: 'absolute', width: d, height: h, left: (w - d) / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)`, ...cardboardFace(0.45) }} />
      {/* Top with tape cross */}
      <div style={{
        position: 'absolute', width: w, height: d, top: (h - d) / 2,
        transform: `rotateX(90deg) translateZ(${h / 2}px)`,
        ...cardboardFace(0.6),
      }}>
        <div style={{ position: 'absolute', left: `${50 - 6}%`, top: 0, width: '12%', height: '100%', background: 'rgba(200,180,140,0.4)' }} />
        <div style={{ position: 'absolute', top: `${50 - 6}%`, left: 0, width: '100%', height: '12%', background: 'rgba(200,180,140,0.35)' }} />
      </div>
      {/* Bottom */}
      <div style={{ position: 'absolute', width: w, height: d, top: (h - d) / 2, transform: `rotateX(-90deg) translateZ(${h / 2}px)`, ...cardboardFace(0.25) }} />
    </div>
  );
}
function pd2(d: number) { return d / 2; }

/* ===== Stacking Logic ===== */

interface BoxSlot {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
}

/** Standard 3×2 stacking (polycover/nabe) */
function buildStandard6Slots(
  bw: number, bd: number, bh: number, layers: number, pw: number, pd: number,
): BoxSlot[] {
  const cols = 3, rows = 2;
  const gapX = (pw - cols * bw) / (cols + 1);
  const gapY = (pd - rows * bd) / (rows + 1);
  const slots: BoxSlot[] = [];
  for (let layer = 0; layer < layers; layer++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({
          x: gapX + c * (bw + gapX),
          y: gapY + r * (bd + gapY),
          z: PALLET_H_PX + layer * bh,
          w: bw, d: bd, h: bh,
        });
      }
    }
  }
  return slots;
}

/** JPI 7-per-layer alternating stacking */
function buildJPI7Slots(
  bw: number, bd: number, bh: number, layers: number, pw: number, pd: number,
): BoxSlot[] {
  const slots: BoxSlot[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const isOdd = layer % 2 === 0;
    // Odd layers: left=3 horizontal, right=4 vertical (3 vertical + gap management)
    // Even layers: mirror
    if (isOdd) {
      // Left: 3 boxes horizontal (bw along x, bd along y)
      const leftColX = 1;
      for (let r = 0; r < 3; r++) {
        slots.push({
          x: leftColX,
          y: 1 + r * (bd + 0.5),
          z: PALLET_H_PX + layer * bh,
          w: bw, d: bd, h: bh,
        });
      }
      // Right: 3-4 boxes vertical (bd along x, bw along y)
      const rightStartX = leftColX + bw + 1;
      const rightCols = Math.max(1, Math.floor((pw - rightStartX) / (bd + 0.5)));
      for (let c = 0; c < Math.min(rightCols, 4); c++) {
        slots.push({
          x: rightStartX + c * (bd + 0.5),
          y: (pd - bw) / 2,
          z: PALLET_H_PX + layer * bh,
          w: bd, d: bw, h: bh,
        });
      }
    } else {
      // Mirror: left=vertical, right=horizontal
      const rightColX = pw - bw - 1;
      for (let r = 0; r < 3; r++) {
        slots.push({
          x: rightColX,
          y: 1 + r * (bd + 0.5),
          z: PALLET_H_PX + layer * bh,
          w: bw, d: bd, h: bh,
        });
      }
      const leftEnd = rightColX - 1;
      const leftCols = Math.max(1, Math.floor(leftEnd / (bd + 0.5)));
      for (let c = 0; c < Math.min(leftCols, 4); c++) {
        slots.push({
          x: 1 + c * (bd + 0.5),
          y: (pd - bw) / 2,
          z: PALLET_H_PX + layer * bh,
          w: bd, d: bw, h: bh,
        });
      }
    }
  }
  return slots;
}

/** Generic stacking based on measurements */
function buildGenericSlots(
  bw: number, bd: number, bh: number, layers: number, pw: number, pdVal: number,
): BoxSlot[] {
  const cols = Math.max(1, Math.floor(pw / bw));
  const rows = Math.max(1, Math.floor(pdVal / bd));
  const gapX = (pw - cols * bw) / (cols + 1);
  const gapY = (pdVal - rows * bd) / (rows + 1);
  const slots: BoxSlot[] = [];
  for (let layer = 0; layer < layers; layer++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({
          x: gapX + c * (bw + gapX),
          y: gapY + r * (bd + gapY),
          z: PALLET_H_PX + layer * bh,
          w: bw, d: bd, h: bh,
        });
      }
    }
  }
  return slots;
}

/** Edge-priority reorder for fraction pallets (fill edges first, skip center) */
function edgePriorityReorder(slots: BoxSlot[], perLayer: number): BoxSlot[] {
  if (perLayer <= 4) return slots; // small grid, no reorder needed
  // Group by layer
  const result: BoxSlot[] = [];
  for (let i = 0; i < slots.length; i += perLayer) {
    const layer = slots.slice(i, i + perLayer);
    // Sort: corners first, then edges, then center
    const sorted = [...layer].sort((a, b) => {
      const aDist = edgeScore(a, layer);
      const bDist = edgeScore(b, layer);
      return aDist - bDist;
    });
    result.push(...sorted);
  }
  return result;
}

function edgeScore(slot: BoxSlot, layer: BoxSlot[]): number {
  // Lower score = higher priority (edges/corners first)
  const xs = layer.map(s => s.x);
  const ys = layer.map(s => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const isEdgeX = slot.x <= minX || slot.x >= maxX;
  const isEdgeY = slot.y <= minY || slot.y >= maxY;
  if (isEdgeX && isEdgeY) return 0; // corner
  if (isEdgeX || isEdgeY) return 1; // edge
  return 2; // center
}

/* ===== Default box dimensions (JRI-A100 fallback) ===== */
function getBoxDims(measurements?: string, itemName?: string): [number, number, number] {
  if (measurements) {
    const d = parseMeas(measurements);
    if (d) return d;
  }
  // Default: JRI-A100 ≈ 55×38×38
  if (itemName) {
    if (itemName.includes('180') || /18[RWCS]/.test(itemName)) return [55, 42, 42];
    if (itemName.includes('060')) return [42, 32, 28];
  }
  return [55, 38, 38];
}

/* ===== Detect stacking type ===== */
function isJPIType(itemName?: string): boolean {
  return !!itemName && /JPI[+\-]?[A-Z]/.test(itemName.replace(/\s/g, ''));
}

/* ===== Main Component ===== */
export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type, itemName, measurements,
}: PalletDiagramProps) {
  const isFull = palletCount > 0;
  const isFraction = !isFull && fraction > 0;
  if (!isFull && !isFraction) return null;

  const [bwCm, bdCm, bhCm] = getBoxDims(measurements, itemName);
  const bw = bwCm * CM2PX;
  const bd = bdCm * CM2PX;
  const bh = bhCm * CM2PX;

  const layers = calculateStackLayers(type, itemName || '', qtyPerPallet, measurements) || 3;
  const isNabe = type === '鍋' || type === 'ポリカバー';
  const isJPI = isJPIType(itemName);
  const isJarPot = type === 'ジャーポット' || /^(PDR|PDU|PVW)/.test(itemName || '');

  // Build slots
  let allSlots: BoxSlot[];
  let perLayer: number;
  if (isJarPot) {
    allSlots = buildStandard6Slots(bw, bd, bh, layers, PALLET_PX, PALLET_PX);
    perLayer = 4; // 2×2
    // Actually jar pots use 2×2
    allSlots = [];
    const jCols = 2, jRows = 2;
    const jBw = (PALLET_PX - 3) / jCols;
    const jBd = (PALLET_PX - 3) / jRows;
    const jBh = bh;
    perLayer = 4;
    for (let layer = 0; layer < layers; layer++) {
      for (let r = 0; r < jRows; r++) {
        for (let c = 0; c < jCols; c++) {
          allSlots.push({
            x: 1 + c * (jBw + 0.5),
            y: 1 + r * (jBd + 0.5),
            z: PALLET_H_PX + layer * jBh,
            w: jBw, d: jBd, h: jBh,
          });
        }
      }
    }
  } else if (isJPI) {
    allSlots = buildJPI7Slots(bw, bd, bh, layers, PALLET_PX, PALLET_PX);
    perLayer = 7;
  } else if (isNabe) {
    allSlots = buildStandard6Slots(bw, bd, bh, layers, PALLET_PX, PALLET_PX);
    perLayer = 6;
  } else {
    allSlots = buildGenericSlots(bw, bd, bh, layers, PALLET_PX, PALLET_PX);
    perLayer = allSlots.length > 0 ? Math.round(allSlots.length / layers) : 6;
  }

  // Determine filled count
  const filled = isFull ? allSlots.length : Math.min(fraction, allSlots.length);

  // For fraction: apply edge-priority reorder
  let renderSlots = allSlots;
  if (isFraction && filled < allSlots.length) {
    renderSlots = edgePriorityReorder(allSlots, perLayer);
    // Only render enough layers
    const layersNeeded = Math.ceil(filled / perLayer);
    renderSlots = renderSlots.slice(0, layersNeeded * perLayer);
  }

  // Calculate total height for viewbox
  const maxZ = renderSlots.reduce((max, s) => Math.max(max, s.z + s.h), PALLET_H_PX);
  const totalHeight = maxZ + 4;

  // Animation for fraction pallets
  const uid = `pl${bwCm}${bdCm}${filled}`;
  const animName = `spinPl${uid}`;
  const rotate = isFraction;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      perspective: 400, overflow: 'visible',
    }}>
      {rotate && (
        <style>{`
          @keyframes ${animName} {
            0% { transform: rotateX(-25deg) rotateY(0deg); }
            100% { transform: rotateX(-25deg) rotateY(360deg); }
          }
        `}</style>
      )}
      <div style={{
        width: PALLET_PX, height: totalHeight,
        position: 'relative',
        transformStyle: 'preserve-3d',
        ...(rotate
          ? { animation: `${animName} 15s linear infinite` }
          : { transform: 'rotateX(-25deg) rotateY(-35deg)' }
        ),
      }}>
        {/* Pallet base — always at bottom */}
        <PalletBase3D pw={PALLET_PX} pd={PALLET_PX} ph={PALLET_H_PX} topOffset={totalHeight - PALLET_H_PX} />

        {/* Stacked boxes — above pallet */}
        {renderSlots.map((slot, i) => {
          if (i >= filled) return null;
          // Convert z (bottom-up from pallet top) to top (top-down from container top)
          const boxTop = totalHeight - PALLET_H_PX - (slot.z - PALLET_H_PX) - slot.h;
          return (
            <Box3D key={i}
              x={slot.x} y={slot.y} z={slot.z}
              w={slot.w} d={slot.d} h={slot.h}
              topBase={boxTop}
            />
          );
        })}
      </div>
    </div>
  );
}
