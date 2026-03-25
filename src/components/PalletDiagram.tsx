'use client';

import React from 'react';
import { ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface PalletDiagramProps {
  palletCount: number;
  fraction: number;
  qtyPerPallet: number;
  type: ItemType;
  itemName?: string;
  measurements?: string;
}

/* ===== Isometric transform ===== */
const A30 = Math.PI / 6;
const CS = Math.cos(A30);
const SN = Math.sin(A30);
function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * CS, (x + y) * SN - z];
}
function pts(...c: [number, number][]): string {
  return c.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

/* ===== Parse measurements string "W*D*H" (cm) ===== */
function parseMeasurements(s: string): [number, number, number] | null {
  const m = s.match(/(\d+(?:\.\d+)?)\s*[*xX\u00d7]\s*(\d+(?:\.\d+)?)\s*[*xX\u00d7]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

/* ===== Jar-pot detection ===== */
function isJarPot(name: string): boolean {
  return /^(PDR|PDU|PVW)/.test(name) || name.includes('ジャーポット');
}

/* ===== Size detection helpers ===== */
function getJarPotSize(itemName: string): number {
  const m = itemName.match(/(30|40|50)/);
  if (m) return parseInt(m[1]);
  return 30; // default → 5 layers
}

function getPolycoverNabeSize(itemName: string): number {
  if (itemName.includes('180')) return 180;
  if (itemName.includes('100')) return 100;
  return 100; // default → 5 layers
}

/* ===== Stack layers calculation (exported for ItemDetailPanel) ===== */
export function calculateStackLayers(
  type: ItemType,
  itemName: string,
  qtyPerPallet: number,
  measurements?: string,
): number {
  // Jar pot: 30/40 → 5, 50 → 4
  if (type === 'ジャーポット' || isJarPot(itemName)) {
    const size = getJarPotSize(itemName);
    return size >= 50 ? 4 : 5;
  }

  // Polycover / Nabe: 100 → 5, 180 → 4
  if (type === 'ポリカバー' || type === '鍋') {
    const size = getPolycoverNabeSize(itemName);
    return size >= 180 ? 4 : 5;
  }

  // General: calculate from measurements and qtyPerPallet
  if (measurements && qtyPerPallet > 0) {
    const dims = parseMeasurements(measurements);
    if (dims) {
      const [wCm, dCm] = dims;
      const PALLET_CM = 110;
      const cols = Math.max(1, Math.floor(PALLET_CM / wCm));
      const rows = Math.max(1, Math.floor(PALLET_CM / dCm));
      const perLayer = cols * rows;
      return Math.max(1, Math.ceil(qtyPerPallet / perLayer));
    }
  }

  return 0; // unknown
}

/* ===== Solid Cardboard Box (3 faces + white tape cross) ===== */
function Box({ x, y, z, w, d, h, ghost, accent }: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  ghost: boolean; accent: string;
}) {
  if (ghost) {
    // Ghost: dashed outline of the top face footprint
    const q = [
      iso(x, y, z + h), iso(x + w, y, z + h),
      iso(x + w, y + d, z + h), iso(x, y + d, z + h),
    ] as [number, number][];
    return (
      <polygon
        points={pts(...q)}
        fill="none"
        stroke={accent}
        strokeWidth={0.15}
        strokeDasharray="0.8,0.8"
        opacity={0.2}
      />
    );
  }

  const sk = '#5a4020';
  const sw = 0.5;

  // Three visible faces (solid, opaque)
  const front = [
    iso(x, y, z + h), iso(x + w, y, z + h),
    iso(x + w, y, z), iso(x, y, z),
  ] as [number, number][];
  const top = [
    iso(x, y, z + h), iso(x + w, y, z + h),
    iso(x + w, y + d, z + h), iso(x, y + d, z + h),
  ] as [number, number][];
  const left = [
    iso(x, y, z + h), iso(x, y + d, z + h),
    iso(x, y + d, z), iso(x, y, z),
  ] as [number, number][];

  // Tape dimensions
  const tw = w * 0.12;
  const td = d * 0.12;
  const tx = x + (w - tw) / 2;
  const ty = y + (d - td) / 2;
  const tapeWrap = h * 0.22;

  // White tape cross on top face
  const tapeVTop = [
    iso(tx, y, z + h), iso(tx + tw, y, z + h),
    iso(tx + tw, y + d, z + h), iso(tx, y + d, z + h),
  ] as [number, number][];
  const tapeHTop = [
    iso(x, ty, z + h), iso(x + w, ty, z + h),
    iso(x + w, ty + td, z + h), iso(x, ty + td, z + h),
  ] as [number, number][];

  // Tape wrapping down front face (vertical strip center)
  const tapeFront = [
    iso(tx, y, z + h), iso(tx + tw, y, z + h),
    iso(tx + tw, y, z + h - tapeWrap), iso(tx, y, z + h - tapeWrap),
  ] as [number, number][];

  // Tape wrapping down left face (horizontal strip center)
  const tapeLeft = [
    iso(x, ty, z + h), iso(x, ty + td, z + h),
    iso(x, ty + td, z + h - tapeWrap), iso(x, ty, z + h - tapeWrap),
  ] as [number, number][];

  return (
    <g>
      {/* Front face - medium brown */}
      <polygon points={pts(...front)} fill="#dea550" stroke={sk} strokeWidth={sw} strokeLinejoin="round" />
      {/* Left face - darkest brown */}
      <polygon points={pts(...left)} fill="#c08a3a" stroke={sk} strokeWidth={sw} strokeLinejoin="round" />
      {/* Top face - lightest brown */}
      <polygon points={pts(...top)} fill="#e8c06a" stroke={sk} strokeWidth={sw} strokeLinejoin="round" />
      {/* Tape cross on top */}
      <polygon points={pts(...tapeVTop)} fill="rgba(255,255,255,0.5)" stroke="none" />
      <polygon points={pts(...tapeHTop)} fill="rgba(255,255,255,0.45)" stroke="none" />
      {/* Tape wrapping down sides */}
      <polygon points={pts(...tapeFront)} fill="rgba(255,255,255,0.3)" stroke="none" />
      <polygon points={pts(...tapeLeft)} fill="rgba(255,255,255,0.25)" stroke="none" />
    </g>
  );
}

/* ===== Pallet base with fork openings and X-pattern top ===== */
function PalletBase({ x, y, z, w, d, h }: {
  x: number; y: number; z: number; w: number; d: number; h: number;
}) {
  const sk = '#1e2228';
  const front = [
    iso(x, y, z + h), iso(x + w, y, z + h),
    iso(x + w, y, z), iso(x, y, z),
  ] as [number, number][];
  const top = [
    iso(x, y, z + h), iso(x + w, y, z + h),
    iso(x + w, y + d, z + h), iso(x, y + d, z + h),
  ] as [number, number][];
  const left = [
    iso(x, y, z + h), iso(x, y + d, z + h),
    iso(x, y + d, z), iso(x, y, z),
  ] as [number, number][];

  // Fork openings on front face
  const forkW = w * 0.22;
  const forkH = h * 0.45;
  const forkZ = z + h * 0.18;
  const forkFront = [0.12, 0.56].map((pct, i) => {
    const fx = x + w * pct;
    const q = [
      iso(fx, y, forkZ + forkH), iso(fx + forkW, y, forkZ + forkH),
      iso(fx + forkW, y, forkZ), iso(fx, y, forkZ),
    ] as [number, number][];
    return <polygon key={`ff${i}`} points={pts(...q)} fill="#0e1118" stroke={sk} strokeWidth={0.3} />;
  });

  // Fork openings on left face
  const forkLeft = [0.12, 0.56].map((pct, i) => {
    const fy = y + d * pct;
    const fd = d * 0.2;
    const q = [
      iso(x, fy, forkZ + forkH), iso(x, fy + fd, forkZ + forkH),
      iso(x, fy + fd, forkZ), iso(x, fy, forkZ),
    ] as [number, number][];
    return <polygon key={`fl${i}`} points={pts(...q)} fill="#0e1118" stroke={sk} strokeWidth={0.3} />;
  });

  // X-pattern grooves on top surface (2×2 grid with X in each quadrant)
  const xLines: React.ReactElement[] = [];
  const qw = w / 2, qd = d / 2;
  for (let qi = 0; qi < 2; qi++) {
    for (let qj = 0; qj < 2; qj++) {
      const qx = x + qi * qw + qw * 0.12;
      const qy = y + qj * qd + qd * 0.12;
      const qxw = qw * 0.76;
      const qyd = qd * 0.76;
      // X diagonals
      const d1a = iso(qx, qy, z + h);
      const d1b = iso(qx + qxw, qy + qyd, z + h);
      const d2a = iso(qx + qxw, qy, z + h);
      const d2b = iso(qx, qy + qyd, z + h);
      xLines.push(
        <line key={`x1-${qi}-${qj}`} x1={d1a[0]} y1={d1a[1]} x2={d1b[0]} y2={d1b[1]}
          stroke="rgba(80,90,105,0.4)" strokeWidth={0.3} />,
        <line key={`x2-${qi}-${qj}`} x1={d2a[0]} y1={d2a[1]} x2={d2b[0]} y2={d2b[1]}
          stroke="rgba(80,90,105,0.4)" strokeWidth={0.3} />,
      );
      // Border lines around each quadrant
      const brd = [
        iso(qx, qy, z + h), iso(qx + qxw, qy, z + h),
        iso(qx + qxw, qy + qyd, z + h), iso(qx, qy + qyd, z + h),
      ] as [number, number][];
      xLines.push(
        <polygon key={`qb-${qi}-${qj}`} points={pts(...brd)}
          fill="none" stroke="rgba(80,90,105,0.3)" strokeWidth={0.25} />,
      );
    }
  }

  return (
    <g>
      <polygon points={pts(...front)} fill="#4a5260" stroke={sk} strokeWidth={0.8} strokeLinejoin="round" />
      <polygon points={pts(...left)} fill="#3d4550" stroke={sk} strokeWidth={0.8} strokeLinejoin="round" />
      <polygon points={pts(...top)} fill="#5a6370" stroke={sk} strokeWidth={0.8} strokeLinejoin="round" />
      {xLines}
      {forkFront}{forkLeft}
    </g>
  );
}

/* ===== JarPot Stack (2×2 box grid per layer) ===== */
function JarPotStack({ ox, oy, filled, accent, layers }: {
  ox: number; oy: number; filled: number; accent: string; layers: number;
}) {
  const PS = 22, PH = 3;
  const gap = 0.4;
  const edgeGap = 0.3;
  const boxW = (PS - edgeGap * 2 - gap) / 2;
  const boxD = (PS - edgeGap * 2 - gap) / 2;
  const boxH = 4.5;

  const perLayer = 4; // 2×2
  const totalSlots = perLayer * layers;

  // Build slots: 2×2 grid per layer
  const slots: BoxSlot[] = [];
  let idx = 0;
  for (let layer = 0; layer < layers; layer++) {
    const z = PH + layer * boxH;
    for (let r = 1; r >= 0; r--) {
      for (let c = 0; c < 2; c++) {
        const x = edgeGap + c * (boxW + gap);
        const y = edgeGap + r * (boxD + gap);
        slots.push({ x, y, z, fillIdx: idx++ });
      }
    }
  }

  // For fraction: only show needed layers
  let slotsToRender = totalSlots;
  if (filled < totalSlots) {
    const layersNeeded = Math.min(layers, Math.ceil(filled / perLayer) + 1);
    slotsToRender = Math.min(totalSlots, Math.max(layersNeeded, 1) * perLayer);
  }
  const renderSlots = slots.slice(0, slotsToRender);

  // Sort for proper occlusion: z asc, y desc, x desc
  const sorted = [...renderSlots].sort((a, b) => {
    if (a.z !== b.z) return a.z - b.z;
    if (a.y !== b.y) return b.y - a.y;
    return b.x - a.x;
  });

  const elems: React.ReactElement[] = [];
  elems.push(<PalletBase key="pl" x={0} y={0} z={0} w={PS} d={PS} h={PH} />);

  for (const s of sorted) {
    elems.push(
      <Box key={`b${s.fillIdx}`}
        x={s.x} y={s.y} z={s.z}
        w={boxW} d={boxD} h={boxH}
        ghost={s.fillIdx >= filled} accent={accent} />
    );
  }

  return <g transform={`translate(${ox},${oy})`}>{elems}</g>;
}

/* ===== Calculate box layout from measurements ===== */
interface BoxLayout {
  cols: number;
  rows: number;
  layers: number;
  boxW: number;   // isometric units
  boxD: number;
  boxH: number;
  totalSlots: number;
}

function calculateLayout(measurements?: string, qtyPerPallet?: number, typeLayers?: number, nabeOverride?: boolean): BoxLayout {
  const PALLET_CM = 110; // standard pallet 110x110 cm
  const ISO_PALLET = 22; // isometric pallet size units
  const scale = ISO_PALLET / PALLET_CM;

  if (measurements) {
    const dims = parseMeasurements(measurements);
    if (dims) {
      const [wCm, dCm, hCm] = dims;
      // 鍋: 3列×2行固定（縦置き）
      if (nabeOverride) {
        const layers = typeLayers || 5;
        const boxW = wCm * scale;
        const boxD = dCm * scale;
        const boxH = hCm * scale;
        return { cols: 3, rows: 2, layers, boxW, boxD, boxH, totalSlots: 6 * layers };
      }

      // 通常配置と回転配置の両方を試してより多く入る方を採用
      const cols1 = Math.max(1, Math.floor(PALLET_CM / wCm));
      const rows1 = Math.max(1, Math.floor(PALLET_CM / dCm));
      const cols2 = Math.max(1, Math.floor(PALLET_CM / dCm));
      const rows2 = Math.max(1, Math.floor(PALLET_CM / wCm));
      const perLayer1 = cols1 * rows1;
      const perLayer2 = cols2 * rows2;
      const useRotated = perLayer2 > perLayer1;
      const cols = useRotated ? cols2 : cols1;
      const rows = useRotated ? rows2 : rows1;
      const perLayer = useRotated ? perLayer2 : perLayer1;
      const effectiveW = useRotated ? dCm : wCm;
      const effectiveD = useRotated ? wCm : dCm;

      // 段数: type-specificがあればそれを優先、なければ計算（最大5段）
      const calcLayers = qtyPerPallet && qtyPerPallet > 0
        ? Math.max(1, Math.ceil(qtyPerPallet / perLayer))
        : 3;
      const layers = typeLayers && typeLayers > 0
        ? typeLayers
        : Math.min(calcLayers, 5);

      const boxW = effectiveW * scale;
      const boxD = effectiveD * scale;
      const boxH = hCm * scale;

      return { cols, rows, layers, boxW, boxD, boxH, totalSlots: perLayer * layers };
    }
  }

  // Default: 3 cols x 2 rows x 3 layers
  return {
    cols: 3, rows: 2, layers: 3,
    boxW: 7, boxD: 10, boxH: 6,
    totalSlots: 18,
  };
}

/* ===== Generic box slot builder ===== */
interface BoxSlot { x: number; y: number; z: number; fillIdx: number; }

function buildGenericSlots(layout: BoxLayout, PH: number, PS: number): BoxSlot[] {
  const { cols, rows, layers, boxW, boxD, boxH } = layout;
  const slots: BoxSlot[] = [];

  // Tight packing: small gaps between boxes
  const gap = 0.2;
  const totalBoxW = cols * boxW + (cols - 1) * gap;
  const totalBoxD = rows * boxD + (rows - 1) * gap;
  // Center the grid on the pallet
  const offsetX = (PS - totalBoxW) / 2;
  const offsetY = (PS - totalBoxD) / 2;

  let idx = 0;
  for (let layer = 0; layer < layers; layer++) {
    const z = PH + layer * boxH;
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * (boxW + gap);
        const y = offsetY + r * (boxD + gap);
        slots.push({ x, y, z, fillIdx: idx++ });
      }
    }
  }

  return slots;
}

/* ===== Generic Stack (measurements-aware) ===== */
function GenericStack({ ox, oy, filled, accent, measurements, qtyPerPallet, typeLayers, nabeOverride }: {
  ox: number; oy: number; filled: number; accent: string;
  measurements?: string; qtyPerPallet?: number; typeLayers?: number; nabeOverride?: boolean;
}) {
  const PS = 22, PH = 3;
  const layout = calculateLayout(measurements, qtyPerPallet, typeLayers, nabeOverride);
  const { boxW, boxD, boxH } = layout;

  const allSlots = buildGenericSlots(layout, PH, PS);

  // For fraction pallets, show enough layers for filled + one ghost layer
  const perLayer = layout.cols * layout.rows;
  let slotsToRender = allSlots.length;
  if (filled < allSlots.length) {
    const layersNeeded = Math.min(layout.layers, Math.ceil(filled / perLayer) + 1);
    slotsToRender = Math.min(allSlots.length, Math.max(layersNeeded, 1) * perLayer);
  }
  const renderSlots = allSlots.slice(0, slotsToRender);

  // Sort for proper occlusion: z asc, then y desc, then x desc (back-to-front)
  const sorted = [...renderSlots].sort((a, b) => {
    if (a.z !== b.z) return a.z - b.z;
    if (a.y !== b.y) return b.y - a.y;
    return b.x - a.x;
  });

  const elems: React.ReactElement[] = [];
  elems.push(<PalletBase key="pl" x={0} y={0} z={0} w={PS} d={PS} h={PH} />);

  for (const s of sorted) {
    elems.push(
      <Box key={`b${s.fillIdx}`}
        x={s.x} y={s.y} z={s.z}
        w={boxW} d={boxD} h={boxH}
        ghost={s.fillIdx >= filled} accent={accent} />
    );
  }

  return <g transform={`translate(${ox},${oy})`}>{elems}</g>;
}

/* ===== Main component ===== */
export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type, itemName, measurements,
}: PalletDiagramProps) {
  const colors = COLOR_MAP[type] || COLOR_MAP['その他'];
  const hasFrac = fraction > 0;
  const jarPot = type === 'ジャーポット' || isJarPot(itemName || '');

  // Calculate stack layers using type-specific rules
  const stackLayers = calculateStackLayers(type, itemName || '', qtyPerPallet, measurements);

  const isNabe = type === '鍋';
  const layout = jarPot ? null : calculateLayout(measurements, qtyPerPallet, stackLayers || undefined, isNabe);
  const jpLayers = jarPot ? (stackLayers || 5) : 0;
  const maxSlots = jarPot ? 4 * jpLayers : (layout ? layout.totalSlots : 18);

  const mapFrac = (n: number) => {
    return Math.min(Math.ceil(n), maxSlots);
  };

  const PW = 22, PD = 22, PH = 3;
  const layerH = jarPot ? 4.5 : (layout ? layout.boxH : 6);
  const layers = jarPot ? jpLayers : (layout ? layout.layers : 3);
  const totalZ = PH + layers * layerH;
  const xL = -PD * CS;
  const xR = PW * CS;
  const yB = (PW + PD) * SN;
  const yT = -totalZ - 2;
  const oneW = xR - xL;
  const oneH = yB - yT;

  const totalSvgW = oneW + 4;

  return (
    <div className="pallet-diagram-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg width="100%" height="100%"
        viewBox={`${xL - 2} ${yT - 2} ${totalSvgW} ${oneH + 4}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '100%' }}
      >
        {/* Full pallet diagram (palletCount > 0) or fraction pallet */}
        {palletCount > 0 ? (
          jarPot ? (
            <JarPotStack ox={0} oy={0} filled={maxSlots} accent={colors.accent} layers={jpLayers} />
          ) : (
            <GenericStack ox={0} oy={0} filled={maxSlots}
              accent={colors.accent} measurements={measurements}
              qtyPerPallet={qtyPerPallet} typeLayers={stackLayers || undefined} nabeOverride={isNabe} />
          )
        ) : hasFrac ? (
          jarPot ? (
            <JarPotStack ox={0} oy={0}
              filled={mapFrac(fraction)} accent={colors.accent} layers={jpLayers} />
          ) : (
            <GenericStack ox={0} oy={0}
              filled={mapFrac(fraction)} accent={colors.accent}
              measurements={measurements} qtyPerPallet={qtyPerPallet}
              typeLayers={stackLayers || undefined} nabeOverride={isNabe} />
          )
        ) : null}
      </svg>
    </div>
  );
}
