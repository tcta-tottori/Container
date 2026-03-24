'use client';

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
  return /^JP[A-Z]/.test(name) || name.includes('ジャーポット');
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

/* ===== Pallet base with fork openings ===== */
function PalletBase({ x, y, z, w, d, h }: {
  x: number; y: number; z: number; w: number; d: number; h: number;
}) {
  const sk = '#2a2e36';
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
  const forkW = w * 0.2;
  const forkH = h * 0.45;
  const forkZ = z + h * 0.18;
  const forkFront = [0.15, 0.58].map((pct, i) => {
    const fx = x + w * pct;
    const q = [
      iso(fx, y, forkZ + forkH), iso(fx + forkW, y, forkZ + forkH),
      iso(fx + forkW, y, forkZ), iso(fx, y, forkZ),
    ] as [number, number][];
    return <polygon key={`ff${i}`} points={pts(...q)} fill="#1a1e24" stroke={sk} strokeWidth={0.4} />;
  });

  // Fork openings on left face
  const forkLeft = [0.15, 0.58].map((pct, i) => {
    const fy = y + d * pct;
    const fd = d * 0.18;
    const q = [
      iso(x, fy, forkZ + forkH), iso(x, fy + fd, forkZ + forkH),
      iso(x, fy + fd, forkZ), iso(x, fy, forkZ),
    ] as [number, number][];
    return <polygon key={`fl${i}`} points={pts(...q)} fill="#1a1e24" stroke={sk} strokeWidth={0.4} />;
  });

  return (
    <g>
      <polygon points={pts(...front)} fill="#555d68" stroke={sk} strokeWidth={0.8} strokeLinejoin="round" />
      <polygon points={pts(...left)} fill="#444c56" stroke={sk} strokeWidth={0.8} strokeLinejoin="round" />
      <polygon points={pts(...top)} fill="#6b7280" stroke={sk} strokeWidth={0.8} strokeLinejoin="round" />
      {forkFront}{forkLeft}
    </g>
  );
}

/* ===== Laminate Bundle (for JarPot items) ===== */
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

  const ig = 0.15;
  const cases: JSX.Element[] = [];
  if (horizontal) {
    cases.push(<Box key="c0" x={x} y={y} z={z} w={cw - ig} d={cd} h={h} ghost={false} accent={accent} />);
    cases.push(<Box key="c1" x={x + cw} y={y} z={z} w={cw - ig} d={cd} h={h} ghost={false} accent={accent} />);
  } else {
    cases.push(<Box key="c0" x={x} y={y} z={z} w={cd} d={cw - ig} h={h} ghost={false} accent={accent} />);
    cases.push(<Box key="c1" x={x} y={y + cw} z={z} w={cd} d={cw - ig} h={h} ghost={false} accent={accent} />);
  }

  const m = 0.08;
  const wx = x - m, wy = y - m, ww = bw + m * 2, wd = bd + m * 2, wh = h + m;
  const wrapLeft = [iso(wx, wy, z + wh), iso(wx, wy + wd, z + wh), iso(wx, wy + wd, z), iso(wx, wy, z)] as [number, number][];
  const wrapFront = [iso(wx, wy, z + wh), iso(wx + ww, wy, z + wh), iso(wx + ww, wy, z), iso(wx, wy, z)] as [number, number][];
  const wrapTop = [iso(wx, wy, z + wh), iso(wx + ww, wy, z + wh), iso(wx + ww, wy + wd, z + wh), iso(wx, wy + wd, z + wh)] as [number, number][];

  const bandH = 0.4;
  const bands: JSX.Element[] = [];
  for (const pct of [0.25, 0.72]) {
    const bz = z + h * pct;
    const bf = [iso(wx, wy, bz + bandH), iso(wx + ww, wy, bz + bandH), iso(wx + ww, wy, bz), iso(wx, wy, bz)] as [number, number][];
    bands.push(<polygon key={`bf${pct}`} points={pts(...bf)} fill="rgba(200,230,255,0.22)" stroke="none" />);
    const bl = [iso(wx, wy, bz + bandH), iso(wx, wy + wd, bz + bandH), iso(wx, wy + wd, bz), iso(wx, wy, bz)] as [number, number][];
    bands.push(<polygon key={`bl${pct}`} points={pts(...bl)} fill="rgba(180,210,240,0.18)" stroke="none" />);
  }

  const refY = z + h * 0.5;
  const ref = [
    iso(wx + ww * 0.1, wy, refY + 0.2), iso(wx + ww * 0.7, wy, refY + 0.2),
    iso(wx + ww * 0.7, wy, refY), iso(wx + ww * 0.1, wy, refY),
  ] as [number, number][];

  return (
    <g>
      {cases}
      <polygon points={pts(...wrapLeft)} fill="rgba(180,215,250,0.12)" stroke="rgba(150,190,230,0.35)" strokeWidth={0.3} strokeLinejoin="round" />
      <polygon points={pts(...wrapFront)} fill="rgba(190,220,250,0.1)" stroke="rgba(150,190,230,0.35)" strokeWidth={0.3} strokeLinejoin="round" />
      <polygon points={pts(...wrapTop)} fill="rgba(220,240,255,0.08)" stroke="rgba(150,190,230,0.35)" strokeWidth={0.3} strokeLinejoin="round" />
      {bands}
      <polygon points={pts(...ref)} fill="rgba(255,255,255,0.15)" stroke="none" />
    </g>
  );
}

/* ===== JarPot Stack ===== */
interface BundleSlot {
  x: number; y: number; z: number;
  horizontal: boolean;
  fillIdx: number;
}

function buildJarPotSlots(PH: number): BundleSlot[] {
  const PW = 22, PD = 22;
  const gOuter = 0.3;
  const cw = (PW - 3 * gOuter) / 4;
  const cd = (PD - 6 * gOuter) / 5;
  const bh = 5.5;

  const slots: BundleSlot[] = [];
  let idx = 0;

  const z0 = PH;
  for (let r = 4; r >= 0; r--) {
    for (let c = 0; c < 2; c++) {
      const x = gOuter + c * (2 * cw + gOuter);
      const y = gOuter + r * (cd + gOuter);
      slots.push({ x, y, z: z0, horizontal: true, fillIdx: idx++ });
    }
  }

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
  const gOuter = 0.3;
  const cw = (PW - 3 * gOuter) / 4;
  const cd = (PD - 6 * gOuter) / 5;
  const bh = 5.5;

  const allSlots = buildJarPotSlots(PH);
  const maxLayer0 = 10;
  const slotsToShow = filled > maxLayer0 ? allSlots.length : maxLayer0;
  const renderSlots = allSlots.slice(0, slotsToShow);

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

function calculateLayout(measurements?: string, qtyPerPallet?: number): BoxLayout {
  const PALLET_CM = 110; // standard pallet 110x110 cm
  const ISO_PALLET = 22; // isometric pallet size units
  const scale = ISO_PALLET / PALLET_CM;

  if (measurements) {
    const dims = parseMeasurements(measurements);
    if (dims) {
      const [wCm, dCm, hCm] = dims;
      const cols = Math.max(1, Math.floor(PALLET_CM / wCm));
      const rows = Math.max(1, Math.floor(PALLET_CM / dCm));
      const perLayer = cols * rows;
      const layers = qtyPerPallet && qtyPerPallet > 0
        ? Math.max(1, Math.ceil(qtyPerPallet / perLayer))
        : 3;

      // Clamp layers so the diagram doesn't get absurdly tall
      const clampedLayers = Math.min(layers, 8);

      const boxW = wCm * scale;
      const boxD = dCm * scale;
      const boxH = hCm * scale;

      return { cols, rows, layers: clampedLayers, boxW, boxD, boxH, totalSlots: perLayer * clampedLayers };
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
function GenericStack({ ox, oy, filled, accent, measurements, qtyPerPallet }: {
  ox: number; oy: number; filled: number; accent: string;
  measurements?: string; qtyPerPallet?: number;
}) {
  const PS = 22, PH = 3;
  const layout = calculateLayout(measurements, qtyPerPallet);
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

  const elems: JSX.Element[] = [];
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
  const jarPot = isJarPot(itemName || '');

  const layout = jarPot ? null : calculateLayout(measurements, qtyPerPallet);
  const maxSlots = jarPot ? 20 : (layout ? layout.totalSlots : 18);

  const mapFrac = (n: number) => {
    if (jarPot) return Math.min(Math.ceil(n / 2), 20);
    return Math.min(Math.ceil(n), maxSlots);
  };

  const PW = 22, PD = 22, PH = 3;
  const layerH = jarPot ? 5.5 : (layout ? layout.boxH : 6);
  const layers = jarPot ? 2 : (layout ? layout.layers : 3);
  const totalZ = PH + layers * layerH;
  const xL = -PD * CS;
  const xR = PW * CS;
  const yB = (PW + PD) * SN;
  const yT = -totalZ - 2;
  const oneW = xR - xL;
  const oneH = yB - yT;

  const showFrac = hasFrac;
  const fracW = showFrac ? oneW * 0.7 : 0;
  const labelW = palletCount > 0 ? 10 : 0;
  const sp = 3;
  const mainW = palletCount > 0 ? oneW : 0;
  const totalSvgW = mainW + labelW + (showFrac ? sp + fracW : 0) + 4;

  return (
    <div className="pallet-diagram-container" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
      <svg width="100%" height="100%"
        viewBox={`${xL - 2} ${yT - 2} ${totalSvgW} ${oneH + 4}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: '100%' }}
      >
        {/* Full pallet diagram */}
        {palletCount > 0 && (
          jarPot ? (
            <JarPotStack ox={0} oy={0} filled={maxSlots} accent={colors.accent} />
          ) : (
            <GenericStack ox={0} oy={0} filled={maxSlots}
              accent={colors.accent} measurements={measurements}
              qtyPerPallet={qtyPerPallet} />
          )
        )}

        {/* xN pallet count label */}
        {palletCount > 0 && (
          <text
            x={xR + 1}
            y={yB - 1}
            textAnchor="start"
            style={{
              fontSize: 7, fontWeight: 900, fontFamily: 'var(--font-mono)',
              fill: colors.accent,
            }}
          >
            ×{palletCount}
          </text>
        )}

        {/* Fraction pallet (right side, smaller) */}
        {showFrac && (
          <g transform={`translate(${mainW + labelW + sp}, ${(oneH - oneH * 0.7) / 2 - 2}) scale(0.7)`}>
            {jarPot ? (
              <JarPotStack ox={0} oy={0}
                filled={mapFrac(fraction)} accent={colors.accent} />
            ) : (
              <GenericStack ox={0} oy={0}
                filled={mapFrac(fraction)} accent={colors.accent}
                measurements={measurements} qtyPerPallet={qtyPerPallet} />
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
