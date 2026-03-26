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
      const palletCm = 110;
      const perLayer = Math.max(1, Math.floor(palletCm / dims[0])) * Math.max(1, Math.floor(palletCm / dims[1]));
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

/* ===== CSS 3D Pallet Base ===== */
function PalletBase3D({ pw, pd, ph, topOffset }: { pw: number; pd: number; ph: number; topOffset: number }) {
  const forkW = pw * 0.18;
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
          <div key={i} style={{ position: 'absolute', left: `${p * 100}%`, top: forkY, width: pd * 0.18, height: forkH, background: '#0a0e14', borderRadius: 1 }} />
        ))}
      </div>
      {/* Right */}
      <div style={{ position: 'absolute', width: pd, height: ph, left: (pw - pd) / 2, transform: `rotateY(90deg) translateZ(${pw / 2}px)`, ...palletFace(0.45) }}>
        {[0.12, 0.55].map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p * 100}%`, top: forkY, width: pd * 0.18, height: forkH, background: '#0a0e14', borderRadius: 1 }} />
        ))}
      </div>
      {/* Top with X-groove pattern */}
      <div style={{
        position: 'absolute', width: pw, height: pd, top: (ph - pd) / 2,
        transform: `rotateX(90deg) translateZ(${ph / 2}px)`, ...palletFace(0.6),
      }}>
        {[0, 1].map(qi => [0, 1].map(qj => {
          const qw = pw / 2; const qd = pd / 2;
          return (
            <React.Fragment key={`${qi}-${qj}`}>
              <div style={{
                position: 'absolute', left: qi * qw + qw * 0.1, top: qj * qd + qd * 0.1,
                width: qw * 0.8, height: qd * 0.8,
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

/* ===== CSS 3D Cardboard Box (properly positioned in 3D space) ===== */
function Box3D({ x, y, w, d, h, topBase, palletDepth }: {
  x: number; y: number; w: number; d: number; h: number;
  topBase: number; palletDepth: number;
}) {
  // y=0 is front edge of pallet, y increases towards back
  // In CSS 3D: translateZ moves towards viewer (positive = front)
  // We center the depth range: front = +palletDepth/2, back = -palletDepth/2
  const zOffset = palletDepth / 2 - y - d / 2;

  return (
    <div style={{
      position: 'absolute', left: x, top: topBase,
      width: w, height: h,
      transformStyle: 'preserve-3d',
      transform: `translateZ(${zOffset}px)`,
    }}>
      {/* Front */}
      <div style={{
        position: 'absolute', width: w, height: h,
        transform: `translateZ(${d / 2}px)`,
        ...cardboardFace(0.55),
      }}>
        <div style={{ position: 'absolute', left: '44%', top: 0, width: '12%', height: '28%', background: 'rgba(200,180,140,0.35)' }} />
      </div>
      {/* Back */}
      <div style={{ position: 'absolute', width: w, height: h, transform: `rotateY(180deg) translateZ(${d / 2}px)`, ...cardboardFace(0.3) }} />
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
        <div style={{ position: 'absolute', left: '44%', top: 0, width: '12%', height: '100%', background: 'rgba(200,180,140,0.4)' }} />
        <div style={{ position: 'absolute', top: '44%', left: 0, width: '100%', height: '12%', background: 'rgba(200,180,140,0.35)' }} />
      </div>
      {/* Bottom */}
      <div style={{ position: 'absolute', width: w, height: d, top: (h - d) / 2, transform: `rotateX(-90deg) translateZ(${h / 2}px)`, ...cardboardFace(0.25) }} />
    </div>
  );
}

/* ===== Stacking Logic ===== */
interface BoxSlot {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
}

/**
 * Nabe/Polycover 3×N stacking
 * Orient boxes so the smaller horizontal dimension is the column width (3 across)
 */
function buildNabeSlots(
  bwCm: number, bdCm: number, bhPx: number, layers: number,
  pw: number, pd: number, cm2px: number,
): BoxSlot[] {
  // Use smaller dim as width for 3 across, larger as depth
  const smallCm = Math.min(bwCm, bdCm);
  const largeCm = Math.max(bwCm, bdCm);
  const boxW = smallCm * cm2px;
  const boxD = largeCm * cm2px;
  const cols = 3;
  const rows = Math.max(1, Math.floor(pd / boxD));
  const gapX = Math.max(0, (pw - cols * boxW) / (cols + 1));
  const gapY = Math.max(0, (pd - rows * boxD) / (rows + 1));
  const slots: BoxSlot[] = [];
  for (let layer = 0; layer < layers; layer++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({
          x: gapX + c * (boxW + gapX),
          y: gapY + r * (boxD + gapY),
          z: PALLET_H_PX + layer * bhPx,
          w: boxW, d: boxD, h: bhPx,
        });
      }
    }
  }
  return slots;
}

/** JPI 7-per-layer alternating stacking
 * 参考画像の配置:
 * 奇数段: 手前3個(幅=small, 奥行=large) + 奥4個(幅=large, 奥行=small)を2列×2行
 * 偶数段: 180°回転（手前4個回転2×2 + 奥3個通常）
 * パレット: 幅=3×small, 奥行=large+2×small
 */
function buildJPI7Slots(
  bwCm: number, bdCm: number, bhPx: number, layers: number,
  pw: number, pd: number, cm2px: number,
): BoxSlot[] {
  const smallCm = Math.min(bwCm, bdCm);
  const largeCm = Math.max(bwCm, bdCm);
  const bSmall = smallCm * cm2px;
  const bLarge = largeCm * cm2px;
  const slots: BoxSlot[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const isOdd = layer % 2 === 0;
    if (isOdd) {
      // 手前: 3個 (幅=bSmall, 奥行=bLarge) を横に3列
      const frontGap = (pw - 3 * bSmall) / 4;
      for (let c = 0; c < 3; c++) {
        slots.push({
          x: frontGap + c * (bSmall + frontGap),
          y: 0,
          z: PALLET_H_PX + layer * bhPx,
          w: bSmall, d: bLarge, h: bhPx,
        });
      }
      // 奥: 4個 (幅=bLarge, 奥行=bSmall) を2列×2行
      const backY = bLarge;
      const backGapX = (pw - 2 * bLarge) / 3;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          slots.push({
            x: backGapX + c * (bLarge + backGapX),
            y: backY + r * bSmall,
            z: PALLET_H_PX + layer * bhPx,
            w: bLarge, d: bSmall, h: bhPx,
          });
        }
      }
    } else {
      // 偶数段: ミラー — 手前4個(回転2×2) + 奥3個(通常)
      const frontGapX = (pw - 2 * bLarge) / 3;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          slots.push({
            x: frontGapX + c * (bLarge + frontGapX),
            y: r * bSmall,
            z: PALLET_H_PX + layer * bhPx,
            w: bLarge, d: bSmall, h: bhPx,
          });
        }
      }
      const backY = 2 * bSmall;
      const backGap = (pw - 3 * bSmall) / 4;
      for (let c = 0; c < 3; c++) {
        slots.push({
          x: backGap + c * (bSmall + backGap),
          y: backY,
          z: PALLET_H_PX + layer * bhPx,
          w: bSmall, d: bLarge, h: bhPx,
        });
      }
    }
  }
  return slots;
}

/** Jar pot 2×2 stacking */
function buildJarPotSlots(
  bhPx: number, layers: number, pw: number, pd: number,
): BoxSlot[] {
  const cols = 2, rows = 2;
  const bw = (pw - 3) / cols;
  const bd = (pd - 3) / rows;
  const slots: BoxSlot[] = [];
  for (let layer = 0; layer < layers; layer++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({
          x: 1 + c * (bw + 1),
          y: 1 + r * (bd + 1),
          z: PALLET_H_PX + layer * bhPx,
          w: bw, d: bd, h: bhPx,
        });
      }
    }
  }
  return slots;
}

/** Generic stacking based on measurements */
function buildGenericSlots(
  bwCm: number, bdCm: number, bhPx: number, layers: number,
  pw: number, pd: number, cm2px: number,
): BoxSlot[] {
  const bw = bwCm * cm2px;
  const bd = bdCm * cm2px;
  const cols = Math.max(1, Math.floor(pw / bw));
  const rows = Math.max(1, Math.floor(pd / bd));
  const gapX = Math.max(0, (pw - cols * bw) / (cols + 1));
  const gapY = Math.max(0, (pd - rows * bd) / (rows + 1));
  const slots: BoxSlot[] = [];
  for (let layer = 0; layer < layers; layer++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({
          x: gapX + c * (bw + gapX),
          y: gapY + r * (bd + gapY),
          z: PALLET_H_PX + layer * bhPx,
          w: bw, d: bd, h: bhPx,
        });
      }
    }
  }
  return slots;
}

/** Edge-priority reorder for fraction pallets (fill edges first, skip center) */
function edgePriorityReorder(slots: BoxSlot[], perLayer: number): BoxSlot[] {
  if (perLayer <= 4) return slots;
  const result: BoxSlot[] = [];
  for (let i = 0; i < slots.length; i += perLayer) {
    const layer = slots.slice(i, i + perLayer);
    const sorted = [...layer].sort((a, b) => edgeScore(a, layer) - edgeScore(b, layer));
    result.push(...sorted);
  }
  return result;
}

function edgeScore(slot: BoxSlot, layer: BoxSlot[]): number {
  const xs = layer.map(s => s.x);
  const ys = layer.map(s => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const isEdgeX = slot.x <= minX || slot.x >= maxX;
  const isEdgeY = slot.y <= minY || slot.y >= maxY;
  if (isEdgeX && isEdgeY) return 0;
  if (isEdgeX || isEdgeY) return 1;
  return 2;
}

/* ===== Default box dimensions ===== */
function getBoxDimsCm(measurements?: string, itemName?: string): [number, number, number] {
  if (measurements) {
    const d = parseMeas(measurements);
    if (d) return d;
  }
  if (itemName) {
    if (itemName.includes('180') || /18[RWCS]/.test(itemName)) return [55, 42, 42];
    if (itemName.includes('060')) return [42, 32, 28];
  }
  return [55, 38, 38];
}

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

  const [bwCm, bdCm, bhCm] = getBoxDimsCm(measurements, itemName);
  const isNabe = type === '鍋' || type === 'ポリカバー';
  const isJPI = isJPIType(itemName);
  const isJarPot = type === 'ジャーポット' || /^(PDR|PDU|PVW)/.test(itemName || '');

  // Calculate pallet dimensions in cm
  let palletWcm: number;
  let palletDcm: number;
  if (isJPI) {
    // JPI: 7個/段 — 手前3個(通常) + 奥4個(90°回転、2列×2行)
    const smallDim = Math.min(bwCm, bdCm);
    const largeDim = Math.max(bwCm, bdCm);
    palletWcm = smallDim * 3;            // 3×38 = 114cm
    palletDcm = largeDim + smallDim * 2;  // 55 + 38×2 = 131cm
  } else if (isNabe) {
    // Nabe 6個/段: pallet width = 3 × smaller box dim, depth = 2 × larger box dim
    const smallDim = Math.min(bwCm, bdCm);
    const largeDim = Math.max(bwCm, bdCm);
    palletWcm = smallDim * 3;
    palletDcm = largeDim * 2;
  } else {
    palletWcm = 110;
    palletDcm = 110;
  }

  // Scale: fit in ~85px visual width
  const VISUAL_PX = 85;
  const cm2px = VISUAL_PX / palletWcm;
  const pw = palletWcm * cm2px; // = VISUAL_PX
  const pd = palletDcm * cm2px;
  const bh = bhCm * cm2px;

  const layers = calculateStackLayers(type, itemName || '', qtyPerPallet, measurements) || 3;

  // Build slots
  let allSlots: BoxSlot[];
  let perLayer: number;
  if (isJarPot) {
    allSlots = buildJarPotSlots(bh, layers, pw, pd);
    perLayer = 4;
  } else if (isJPI) {
    allSlots = buildJPI7Slots(bwCm, bdCm, bh, layers, pw, pd, cm2px);
    perLayer = 7;
  } else if (isNabe) {
    allSlots = buildNabeSlots(bwCm, bdCm, bh, layers, pw, pd, cm2px);
    perLayer = allSlots.length > 0 ? Math.round(allSlots.length / layers) : 6;
  } else {
    allSlots = buildGenericSlots(bwCm, bdCm, bh, layers, pw, pd, cm2px);
    perLayer = allSlots.length > 0 ? Math.round(allSlots.length / layers) : 6;
  }

  // Determine filled count
  const filled = isFull ? allSlots.length : Math.min(fraction, allSlots.length);

  // For fraction: apply edge-priority reorder
  let renderSlots = allSlots;
  if (isFraction && filled < allSlots.length) {
    renderSlots = edgePriorityReorder(allSlots, perLayer);
    const layersNeeded = Math.ceil(filled / perLayer);
    renderSlots = renderSlots.slice(0, layersNeeded * perLayer);
  }

  // Calculate total height for viewbox
  const maxZ = renderSlots.reduce((max, s) => Math.max(max, s.z + s.h), PALLET_H_PX);
  const totalHeight = maxZ + 4;

  const uid = `pl${Math.round(bwCm)}${Math.round(bdCm)}${filled}`;
  const animName = `spinPl${uid}`;
  const rotate = isFraction;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'visible',
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
        width: pw, height: totalHeight,
        position: 'relative',
        transformStyle: 'preserve-3d',
        ...(rotate
          ? { animation: `${animName} 15s linear infinite` }
          : { transform: 'rotateX(-25deg) rotateY(-35deg)' }
        ),
      }}>
        {/* Pallet base */}
        <PalletBase3D pw={pw} pd={pd} ph={PALLET_H_PX} topOffset={totalHeight - PALLET_H_PX} />

        {/* Stacked boxes — positioned in full 3D (x, y→depth, z→height) */}
        {renderSlots.map((slot, i) => {
          if (i >= filled) return null;
          const boxTop = totalHeight - PALLET_H_PX - (slot.z - PALLET_H_PX) - slot.h;
          return (
            <Box3D key={i}
              x={slot.x} y={slot.y}
              w={slot.w} d={slot.d} h={slot.h}
              topBase={boxTop}
              palletDepth={pd}
            />
          );
        })}
      </div>
    </div>
  );
}
