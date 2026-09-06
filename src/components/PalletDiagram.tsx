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
  overrideRotateY?: number;
  wireframe?: boolean;
  /** 出現時のフェードインを省く（全画面表示のように最初から見せたいとき） */
  noIntro?: boolean;
  /**
   * 積み方のアニメーション。
   * まずパレットだけが出て、そのあと箱が積む順番どおりに上から落ちてくる。
   * 全画面のパレット図で使う。
   */
  stackAnim?: boolean;
  /** 積み方アニメーションの速さ（1 = 標準、0.5 = ゆっくり、2 = 倍速） */
  stackSpeed?: number;
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
    // 30・40サイズは5段目まで、50サイズは4段目まで。
    // サイズは機種名（PDU-A40A など）の数字で見る。電圧表記を拾わないよう機種名の直後を優先する。
    const m = itemName.match(/(?:PD[RUZ]|PVW)[^0-9]{0,4}(\d{2})/) || itemName.match(/(30|40|50)/);
    return m && parseInt(m[1], 10) >= 50 ? 4 : 5;
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

/* ===== Wireframe neon face with translucent fill (light mode) ===== */
function wireframeFace(opacity: number): React.CSSProperties {
  return {
    background: `rgba(255,230,100,${opacity * 0.15})`,
    border: `1.2px solid rgba(255,255,255,${Math.min(1, opacity + 0.1)})`,
    boxShadow: `inset 0 0 4px rgba(255,240,150,${opacity * 0.12}), 0 0 3px rgba(255,255,255,${opacity * 0.15})`,
    borderRadius: 1,
    boxSizing: 'border-box' as const,
    backfaceVisibility: 'visible' as const,
  };
}

/* ===== CSS 3D Cardboard Box (properly positioned in 3D space) ===== */
/**
 * ラミネート（シュリンク）の film。
 * 2箱をまとめて包んだフィルムのてかりを、斜めの筋と白い縁で表す。
 * @param angle 光の筋の向き（面ごとに変えて、同じ模様が並ばないようにする）
 */
function laminateFilm(angle: number): React.ReactElement {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 2,
      background: `linear-gradient(${angle}deg,
        rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.03) 13%,
        rgba(255,255,255,0.24) 24%, rgba(255,255,255,0.00) 37%,
        rgba(205,228,255,0.20) 52%, rgba(255,255,255,0.02) 68%,
        rgba(255,255,255,0.28) 84%, rgba(235,245,255,0.10) 100%)`,
      boxShadow: 'inset 0 0 3px rgba(255,255,255,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.35)',
    }} />
  );
}

/**
 * ラミネートの中に入っている2箱を描く。
 * @param dir  その面のなかで2箱に割れる向き（'h'=左右 / 'v'=上下）
 * @param tape 箱ごとのテープを描く（上面用）
 */
function innerCartons(dir: 'h' | 'v', tape = false): React.ReactElement {
  const boxStyle: React.CSSProperties = {
    position: 'absolute',
    border: '0.5px solid rgba(88,64,38,0.55)',
    borderRadius: 1.5,
    background: 'linear-gradient(150deg, rgba(255,255,255,0.07), rgba(0,0,0,0.06))',
    boxShadow: 'inset 0 0 2px rgba(60,40,20,0.28)',
    overflow: 'hidden',
  };
  const first: React.CSSProperties = dir === 'h'
    ? { left: '1.5%', top: '2%', width: '46%', height: '96%' }
    : { left: '2%', top: '1.5%', width: '96%', height: '46%' };
  const second: React.CSSProperties = dir === 'h'
    ? { left: '52.5%', top: '2%', width: '46%', height: '96%' }
    : { left: '2%', top: '52.5%', width: '96%', height: '46%' };
  // 2箱の合わせ目（フィルムの下でくぼんで見える）
  const seam: React.CSSProperties = dir === 'h'
    ? { left: '46%', top: 0, width: '8%', height: '100%' }
    : { left: 0, top: '46%', width: '100%', height: '8%' };
  const tapeStyle: React.CSSProperties = dir === 'h'
    ? { left: '42%', top: 0, width: '16%', height: '100%' }
    : { left: 0, top: '42%', width: '100%', height: '16%' };

  const carton = (style: React.CSSProperties, key: string) => (
    <div key={key} style={{ ...boxStyle, ...style }}>
      {tape && <div style={{ position: 'absolute', ...tapeStyle, background: 'rgba(200,180,140,0.38)' }} />}
    </div>
  );

  return (
    <>
      <div style={{
        position: 'absolute', ...seam,
        background: dir === 'h'
          ? 'linear-gradient(90deg, rgba(50,34,18,0.05), rgba(50,34,18,0.35) 50%, rgba(50,34,18,0.05))'
          : 'linear-gradient(180deg, rgba(50,34,18,0.05), rgba(50,34,18,0.35) 50%, rgba(50,34,18,0.05))',
      }} />
      {carton(first, 'a')}
      {carton(second, 'b')}
    </>
  );
}

function Box3D({ x, y, w, d, h, topBase, palletDepth, wireframe, split, dropAnim }: {
  x: number; y: number; w: number; d: number; h: number;
  topBase: number; palletDepth: number; wireframe?: boolean;
  /** ラミネートで2箱をまとめた玉。継ぎ目とフィルムのてかりを描いて「2箱で1玉」と分かるようにする */
  split?: 'w' | 'd';
  /** 積み方アニメーションで上から落ちてくる指定（animation プロパティの値） */
  dropAnim?: string;
}) {
  const zOffset = palletDepth / 2 - y - d / 2;
  // 2箱が並んで見える面にだけ、中身の箱を描く。
  // 幅方向にまとめた玉なら正面・背面に、奥行方向なら側面に2箱が並ぶ
  const cartonsOnFront = split === 'w' ? innerCartons('h') : null;
  const cartonsOnSide = split === 'd' ? innerCartons('h') : null;

  if (wireframe) {
    return (
      <div style={{
        position: 'absolute', left: x, top: topBase,
        width: w, height: h,
        transformStyle: 'preserve-3d',
        transform: `translateZ(${zOffset}px)`,
        animation: dropAnim,
      }}>
        <div style={{ position: 'absolute', width: w, height: h, transform: `translateZ(${d / 2}px)`, ...wireframeFace(0.7) }} />
        <div style={{ position: 'absolute', width: w, height: h, transform: `rotateY(180deg) translateZ(${d / 2}px)`, ...wireframeFace(0.4) }} />
        <div style={{ position: 'absolute', width: d, height: h, left: (w - d) / 2, transform: `rotateY(-90deg) translateZ(${w / 2}px)`, ...wireframeFace(0.5) }} />
        <div style={{ position: 'absolute', width: d, height: h, left: (w - d) / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)`, ...wireframeFace(0.55) }} />
        <div style={{ position: 'absolute', width: w, height: d, top: (h - d) / 2, transform: `rotateX(90deg) translateZ(${h / 2}px)`, ...wireframeFace(0.6) }} />
        <div style={{ position: 'absolute', width: w, height: d, top: (h - d) / 2, transform: `rotateX(-90deg) translateZ(${h / 2}px)`, ...wireframeFace(0.3) }} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', left: x, top: topBase,
      width: w, height: h,
      transformStyle: 'preserve-3d',
      transform: `translateZ(${zOffset}px)`,
      animation: dropAnim,
    }}>
      {/* Front */}
      <div style={{
        position: 'absolute', width: w, height: h,
        transform: `translateZ(${d / 2}px)`,
        ...cardboardFace(0.55),
      }}>
        {!split && (
          <div style={{ position: 'absolute', left: '44%', top: 0, width: '12%', height: '28%', background: 'rgba(200,180,140,0.35)' }} />
        )}
        {cartonsOnFront}
        {split && laminateFilm(115)}
      </div>
      {/* Back */}
      <div style={{ position: 'absolute', width: w, height: h, transform: `rotateY(180deg) translateZ(${d / 2}px)`, ...cardboardFace(0.3) }}>
        {cartonsOnFront}
        {split && laminateFilm(65)}
      </div>
      {/* Left */}
      <div style={{ position: 'absolute', width: d, height: h, left: (w - d) / 2, transform: `rotateY(-90deg) translateZ(${w / 2}px)`, ...cardboardFace(0.4) }}>
        {cartonsOnSide}
        {split && laminateFilm(70)}
      </div>
      {/* Right */}
      <div style={{ position: 'absolute', width: d, height: h, left: (w - d) / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)`, ...cardboardFace(0.45) }}>
        {cartonsOnSide}
        {split && laminateFilm(110)}
      </div>
      {/* Top with tape cross */}
      <div style={{
        position: 'absolute', width: w, height: d, top: (h - d) / 2,
        transform: `rotateX(90deg) translateZ(${h / 2}px)`,
        ...cardboardFace(0.6),
      }}>
        {!split && (
          <>
            <div style={{ position: 'absolute', left: '44%', top: 0, width: '12%', height: '100%', background: 'rgba(200,180,140,0.4)' }} />
            <div style={{ position: 'absolute', top: '44%', left: 0, width: '100%', height: '12%', background: 'rgba(200,180,140,0.35)' }} />
          </>
        )}
        {/* 上から見ると、幅方向の玉は左右に、奥行方向の玉は上下に2箱が並ぶ */}
        {split === 'w' && innerCartons('h', true)}
        {split === 'd' && innerCartons('v', true)}
        {split && (
          <>
            {laminateFilm(135)}
            {/* 上で包み込んだフィルムの寄せじわ（楕円のてかり） */}
            <div style={{
              position: 'absolute', left: '16%', top: '20%', width: '68%', height: '54%',
              borderRadius: '50%', pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 34% 30%, rgba(255,255,255,0.42), rgba(255,255,255,0.10) 55%, rgba(255,255,255,0) 72%)',
              border: '0.5px solid rgba(255,255,255,0.30)',
            }} />
          </>
        )}
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
  /** 2箱をシュリンクで1玉にしている場合の継ぎ目の向き（'w'=幅方向で2分割 / 'd'=奥行方向） */
  split?: 'w' | 'd';
  /** 1段のなかで積む順番（アニメーション用。決まった順があるときだけ設定する） */
  seq?: number;
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
  const totalBoxW = cols * boxW;
  const totalBoxD = rows * boxD;
  // 箱をパレット中央に配置（はみ出す場合もセンター）
  const offsetX = (pw - totalBoxW) / 2;
  const offsetY = (pd - totalBoxD) / 2;
  const gapX = totalBoxW <= pw ? Math.max(0, (pw - totalBoxW) / (cols + 1)) : 0;
  const gapY = totalBoxD <= pd ? Math.max(0, (pd - totalBoxD) / (rows + 1)) : 0;
  const startX = totalBoxW <= pw ? gapX : offsetX;
  const startY = totalBoxD <= pd ? gapY : offsetY;
  const slots: BoxSlot[] = [];
  for (let layer = 0; layer < layers; layer++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({
          x: startX + c * (boxW + (totalBoxW <= pw ? gapX : 0)),
          y: startY + r * (boxD + (totalBoxD <= pd ? gapY : 0)),
          z: PALLET_H_PX + layer * bhPx,
          w: boxW, d: boxD, h: bhPx,
        });
      }
    }
  }
  return slots;
}

/**
 * 頭に JP が付く品目（JPI・JPV・JPK など）の「1段7個」の積み方。
 *
 * 1段目: 横3個 ＋ 縦4個
 *   - 右側に「横」（長い辺が左右）を奥から手前へ3個ならべる
 *   - 左側に「縦」（長い辺が奥行き）を2×2で4個置く（手前は縦2個になる）
 * 2段目: 縦3個 ＋ 横4個（1段目を90度まわした形。段どうしが噛み合う）
 *   - 奥に「縦」を左右に3個ならべる
 *   - 手前に「横」を2×2で4個置く
 * 以降はこの2種類をくり返す。
 *
 * 置く順（seq）は「右奥の横から」。1段目は 横3個 → 縦4個、
 * 2段目は 縦3個 → 横4個 の順。
 * ※ y は 0 が手前。奥ほど y が大きい
 */
function buildJP7Slots(
  bwCm: number, bdCm: number, bhPx: number, layers: number,
  pw: number, pd: number, cm2px: number,
): BoxSlot[] {
  const S = Math.min(bwCm, bdCm) * cm2px;  // 短い辺
  const L = Math.max(bwCm, bdCm) * cm2px;  // 長い辺
  const slots: BoxSlot[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const z = PALLET_H_PX + layer * bhPx;
    const put = (x: number, y: number, w: number, d: number, seq: number): BoxSlot =>
      ({ x, y, z, w, d, h: bhPx, seq });

    if (layer % 2 === 0) {
      /* 横3個（右）＋ 縦4個（左） */
      // 右の「横」3個。幅 L・奥行 S を奥から手前へ
      const colX = pw - L;
      const colY0 = (pd - 3 * S) / 2;
      for (let i = 0; i < 3; i++) {
        // i=0 が奥（右奥）。そこから手前へ
        slots.push(put(colX, colY0 + (2 - i) * S, L, S, i));
      }
      // 左の「縦」2×2。幅 S・奥行 L
      const blkY0 = (pd - 2 * L) / 2;
      for (let r = 0; r < 2; r++) {          // r=0 が奥
        for (let c = 0; c < 2; c++) {        // c=0 が左
          slots.push(put(c * S, blkY0 + (1 - r) * L, S, L, 3 + r * 2 + c));
        }
      }
    } else {
      /* 縦3個（奥）＋ 横4個（手前） */
      // 奥の「縦」3個。幅 S・奥行 L を右から左へ
      const rowY = pd - L;
      const rowX0 = (pw - 3 * S) / 2;
      for (let i = 0; i < 3; i++) {
        // i=0 が右
        slots.push(put(rowX0 + (2 - i) * S, rowY, S, L, i));
      }
      // 手前の「横」2×2。幅 L・奥行 S
      const blkX0 = (pw - 2 * L) / 2;
      for (let r = 0; r < 2; r++) {          // r=0 が奥
        for (let c = 0; c < 2; c++) {        // c=0 が左
          slots.push(put(blkX0 + c * L, (1 - r) * S, L, S, 3 + r * 2 + c));
        }
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

/**
 * PDU ジャーポットの積み方
 *
 * PDU が付くポットは2箱がラミネート（シュリンク）で1つにまとまっている（＝1玉 = 2ケース）。
 * 半面に「横長置き2玉 ＋ 縦長置き3玉」で5玉、もう半面は互い違いに5玉で、1段 10玉（20ケース）。
 * 2段目からは段ごとに互い違いにして、荷崩れしないように積む。
 *
 * 並べ方は風車（ピンホイール）状。4つのブロックが外周でぴったり接するので
 * 外側には隙間ができず、中央だけが空く（実際の積み方と同じ）。
 *
 *   ┌──────┬────┬────┬────┐
 *   │ 横長  │ 縦 │ 縦 │ 縦 │  A: 横長2玉（奥行きに2つ重ねる）
 *   │ 横長  │    │    │    │  B: 縦長3玉
 *   ├───┬──┴─┬──┴──┬─┴────┤
 *   │縦 │ 縦 │ 縦  │ 横長  │  ← 中央の隙間は A と C のあいだ
 *   │   │    │     │ 横長  │  C: 横長2玉  D: 縦長3玉
 *   └───┴────┴─────┴──────┘
 *
 * 玉の 長辺 L・短辺 S は L + 3S（幅）× L + 2S（奥行き）が荷姿になる。
 * 中央に残る隙間は (3S − L) × (2S − L)。
 */
const PDU_CASES_PER_BUNDLE = 2;
const PDU_BUNDLES_PER_LAYER = 10;
/** 玉（2箱をラミネートしたかたまり）の 長辺 ÷ 短辺 */
const PDU_BUNDLE_RATIO = 1.35;

function buildPduJarPotSlots(
  bhPx: number, layers: number, pw: number, pd: number,
): BoxSlot[] {
  const r = PDU_BUNDLE_RATIO;
  // 荷姿（L + 3S）×（L + 2S）がパレットに収まるように玉の大きさを決める
  const sSize = Math.min(pw / (r + 3), pd / (r + 2));  // 玉の短辺
  const lSize = sSize * r;                             // 玉の長辺（2箱ぶん）
  const loadW = lSize + 3 * sSize;
  const loadD = lSize + 2 * sSize;
  // 荷姿はパレットの中央に置く
  const ox = (pw - loadW) / 2;
  const oy = (pd - loadD) / 2;

  /**
   * 1段ぶんの並び（風車状）。
   * @param landscapeBackLeft 横長2玉を奥の左に置く（false なら左右反転）
   */
  const layerSlots = (landscapeBackLeft: boolean): Omit<BoxSlot, 'z' | 'h'>[] => {
    // 左右反転しても外周がぴったり合うよう、x は荷姿の中で折り返して求める
    const mirrorX = (x: number, w: number) => (landscapeBackLeft ? x : loadW - x - w);
    // y は 0 が手前なので、組み立てた並び（0 を奥として書いている）を反転して置く
    const put = (x: number, y: number, w: number, d: number, split: 'w' | 'd') =>
      ({ x: ox + mirrorX(x, w), y: oy + (loadD - y - d), w, d, split });

    // 置く順番（seq）は実際の積み方に合わせる:
    //   ①奥の左に横向き1つ ②その右へ縦向き3つ ③①の手前に横向き1つ
    //   ④右端の縦向きにつけて横向きを手前へ2つ ⑤最後に縦向きを右から順に3つ
    const out: Omit<BoxSlot, 'z' | 'h'>[] = [];
    // A: 奥の左 — 横長2玉（奥行き方向に重ねる）
    for (let i = 0; i < 2; i++) out.push({ ...put(0, i * sSize, lSize, sSize, 'w'), seq: i === 0 ? 0 : 4 });
    // B: 奥の右 — 縦長3玉（左から右へ）
    for (let i = 0; i < 3; i++) out.push({ ...put(lSize + i * sSize, 0, sSize, lSize, 'd'), seq: 1 + i });
    // C: 手前の右 — 横長2玉（奥から手前へ）
    for (let i = 0; i < 2; i++) out.push({ ...put(3 * sSize, lSize + i * sSize, lSize, sSize, 'w'), seq: 5 + i });
    // D: 手前の左 — 縦長3玉（右から左へ）
    for (let i = 0; i < 3; i++) out.push({ ...put(i * sSize, 2 * sSize, sSize, lSize, 'd'), seq: 9 - i });
    return out;
  };

  const slots: BoxSlot[] = [];
  for (let layer = 0; layer < layers; layer++) {
    // 段ごとに互い違い（左右を入れ替える）
    const z = PALLET_H_PX + layer * bhPx;
    for (const b of layerSlots(layer % 2 === 0)) {
      slots.push({ ...b, z, h: bhPx });
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

/**
 * 箱を積む順番（アニメーション用）。renderSlots の添字を、積む順に並べて返す。
 *
 * mode 'backColumn'（ポリカバー・鍋など）:
 *   奥の列から積む。1列ぶんを上（4〜5段目）まで積み終えてから手前の列に移る。
 *   列のなかは 中央 → 左 → 右 の順。
 * mode 'layer'（PDU の段ボール・1段7個の JP 系など）:
 *   1段ずつ仕上げていく。1段のなかの順番は seq（積み方で決まっている順）に従い、
 *   seq が無ければ 奥→手前・中央→左→右 の順にする。
 */
function buildStackOrder(slots: BoxSlot[], mode: 'backColumn' | 'layer'): number[] {
  if (slots.length === 0) return [];
  const round = (v: number) => Math.round(v * 100) / 100;
  const layers = Array.from(new Set(slots.map((s) => round(s.z)))).sort((a, b) => a - b);
  // y は 0 が手前（translateZ が + ＝手前）。奥から積むので y の大きいほうを先にする
  const rows = Array.from(new Set(slots.map((s) => round(s.y)))).sort((a, b) => b - a);
  const minX = Math.min(...slots.map((s) => s.x));
  const maxX = Math.max(...slots.map((s) => s.x + s.w));
  const centerX = (minX + maxX) / 2;

  const ranked = slots.map((s, i) => ({
    i,
    seq: s.seq,
    layer: layers.indexOf(round(s.z)),
    row: rows.indexOf(round(s.y)),
    // 中央からの距離（小さいほど中央）
    fromCenter: round(Math.abs(s.x + s.w / 2 - centerX)),
    left: s.x,
  }));

  ranked.sort((a, b) => {
    if (mode === 'backColumn') {
      if (a.row !== b.row) return a.row - b.row;       // 奥の列から（rows は奥→手前の順）
      if (a.layer !== b.layer) return a.layer - b.layer; // その列を上まで
    } else {
      if (a.layer !== b.layer) return a.layer - b.layer; // 1段ずつ
      if (a.seq !== undefined && b.seq !== undefined && a.seq !== b.seq) return a.seq - b.seq;
      if (a.row !== b.row) return a.row - b.row;
    }
    if (a.fromCenter !== b.fromCenter) return a.fromCenter - b.fromCenter; // 中央から
    return a.left - b.left;                                                // 同距離なら左から
  });

  const order = new Array<number>(slots.length);
  ranked.forEach((r, pos) => { order[r.i] = pos; });
  return order;
}

/**
 * 四隅スコア（距離ベース）: 小さい値=四隅寄り、大きい値=中央寄り
 */
function cornerScore(slot: BoxSlot, layer: BoxSlot[]): number {
  const xs = layer.map(s => s.x);
  const ys = layer.map(s => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const dx = Math.min(slot.x - minX, maxX - slot.x) / rangeX;
  const dy = Math.min(slot.y - minY, maxY - slot.y) / rangeY;
  return dx + dy;
}

/**
 * 端数パレットのスロット生成
 *
 * ルール:
 * - 最上面は必ず四隅にハコがある状態にする
 * - 上面がぴったりにならない場合は四隅以外を中央から抜く
 * - 端数<4の場合は下段を繰り上げて四隅を確保
 * - 全ての箱は下段に支えがある（浮き箱なし）
 *
 * 端数<4の再分配戦略:
 *   満杯段を必要数減らして箱を確保し、上から順に四隅4個の段を積む。
 *   最下の再分配段は四隅＋αで上段全ての四隅位置を支える。
 *   例: perLayer=6, 端数1 → 満杯2段減、[5個(四隅+1辺), 4個(四隅), 4個(四隅)]
 */
function buildFractionSlots(allSlots: BoxSlot[], perLayer: number, fraction: number): BoxSlot[] {
  if (fraction <= 0 || perLayer <= 0) return [];

  const fullLayers = Math.floor(fraction / perLayer);
  const remainder = fraction % perLayer;

  // 端数なし（全段満杯）
  if (remainder === 0) {
    return allSlots.slice(0, fraction);
  }

  // cornerScoreでソートした段のスロットを取得するヘルパー
  const getLayerSorted = (layerIdx: number) => {
    const start = layerIdx * perLayer;
    const slots = allSlots.slice(start, start + perLayer);
    return [...slots].sort((a, b) => cornerScore(a, slots) - cornerScore(b, slots));
  };

  const result: BoxSlot[] = [];

  // ---- 端数<4 かつ 四隅確保のための再分配 ----
  if (remainder < 4 && fullLayers > 0 && perLayer > 4) {
    // 必要な繰り上げ段数: 最下の再分配段が>=4個になるまで
    const extraLayers = Math.ceil((4 - remainder) / (perLayer - 4));
    const actualExtra = Math.min(extraLayers, fullLayers); // 満杯段が足りない場合

    if (actualExtra > 0 && actualExtra * (perLayer - 4) + remainder >= 4) {
      const belowFull = fullLayers - actualExtra;
      const distributed = fraction - belowFull * perLayer;
      const topCornerLayers = actualExtra; // 四隅4個の段数
      const bottomCount = distributed - topCornerLayers * 4; // 最下再分配段の個数

      // 満杯の段
      for (let i = 0; i < belowFull * perLayer && i < allSlots.length; i++) {
        result.push(allSlots[i]);
      }

      // 最下の再分配段: bottomCount個（四隅含む）→ 上段の四隅を全て支える
      const bottomSorted = getLayerSorted(belowFull);
      for (let i = 0; i < Math.min(bottomCount, bottomSorted.length); i++) {
        result.push(bottomSorted[i]);
      }

      // 四隅4個の段（上に向かって積む）
      for (let t = 0; t < topCornerLayers; t++) {
        const sorted = getLayerSorted(belowFull + 1 + t);
        for (let i = 0; i < Math.min(4, sorted.length); i++) {
          result.push(sorted[i]);
        }
      }

      return result;
    }
  }

  // ---- 端数>=4（または再分配不要）: 単純な四隅優先配置 ----
  // 満杯の段
  for (let i = 0; i < fullLayers * perLayer && i < allSlots.length; i++) {
    result.push(allSlots[i]);
  }

  // 最上段: 四隅→辺→中央の順に配置（中央から抜く）
  const sorted = getLayerSorted(fullLayers);
  for (let i = 0; i < Math.min(remainder, sorted.length); i++) {
    result.push(sorted[i]);
  }

  return result;
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

/**
 * 1段7個で積む品目か。
 * 頭に JP が付くもの（JPI・JPV・JPK など）はすべてこの積み方をする。
 */
function isJP7Type(itemName?: string): boolean {
  return !!itemName && /^JP[A-Z]/.test(itemName.replace(/\s/g, '').toUpperCase());
}

/** PDU が付くジャーポット（2箱シュリンクで1玉の積み方）。PDZ など他の機種は従来どおり */
export function isPduJarPot(itemName?: string): boolean {
  return !!itemName && /PDU/i.test(itemName);
}

/* ===== Main Component ===== */
export default function PalletDiagram({
  palletCount, fraction, qtyPerPallet, type, itemName, measurements, overrideRotateY, wireframe, noIntro,
  stackAnim, stackSpeed = 1,
}: PalletDiagramProps) {
  const isFull = palletCount > 0;
  const isFraction = !isFull && fraction > 0;
  if (!isFull && !isFraction) return null;

  const [bwCm, bdCm, bhCm] = getBoxDimsCm(measurements, itemName);
  const isNabe = type === '鍋';
  const isJP7 = isJP7Type(itemName);
  const isJarPot = type === 'ジャーポット' || /^(PDR|PDU|PVW)/.test(itemName || '');
  const isPdu = isJarPot && isPduJarPot(itemName);
  // PDU は2箱で1玉のため、図に描く1個 = 2ケース
  const casesPerBox = isPdu ? PDU_CASES_PER_BUNDLE : 1;

  // Calculate pallet dimensions in cm
  let palletWcm: number;
  let palletDcm: number;
  if (isNabe) {
    // 鍋パレット: 物理パレット110×110cmを中心に表示
    // 100サイズ(3×38=114): ほぼパレットに収まる
    // 180サイズ(3×42=126): パレットからはみ出る
    palletWcm = 110;
    palletDcm = 110;
  } else if (isJP7) {
    // 1段ごとに90度まわして積むので、どちらの向きでも収まる正方形にする
    const smallDim = Math.min(bwCm, bdCm);
    const largeDim = Math.max(bwCm, bdCm);
    const side = largeDim + smallDim * 2;
    palletWcm = side;
    palletDcm = side;
  } else {
    palletWcm = 110;
    palletDcm = 110;
  }

  // Scale: responsive visual width
  const VISUAL_PX = 70;
  const cm2px = VISUAL_PX / palletWcm;
  const pw = palletWcm * cm2px; // = VISUAL_PX
  const pd = palletDcm * cm2px;
  const bh = bhCm * cm2px;

  let layers = calculateStackLayers(type, itemName || '', qtyPerPallet, measurements) || 3;

  // Build slots
  let allSlots: BoxSlot[];
  let perLayer: number;
  if (isPdu) {
    allSlots = buildPduJarPotSlots(bh, layers, pw, pd);
    perLayer = PDU_BUNDLES_PER_LAYER;
  } else if (isJarPot) {
    allSlots = buildJarPotSlots(bh, layers, pw, pd);
    perLayer = 4;
  } else if (isNabe) {
    // 鍋はどの種目（JP 系含む）でも統一で1段6個

    allSlots = buildNabeSlots(bwCm, bdCm, bh, layers, pw, pd, cm2px);
    perLayer = allSlots.length > 0 ? Math.round(allSlots.length / layers) : 6;
  } else if (isJP7) {
    allSlots = buildJP7Slots(bwCm, bdCm, bh, layers, pw, pd, cm2px);
    perLayer = 7;
  } else {
    // qtyPerPalletを使って現実的な段数・個数/段を決定
    // まずデフォルト寸法でのperLayerを計算
    const defaultPerLayer = Math.max(1, Math.floor(pw / (bwCm * cm2px))) * Math.max(1, Math.floor(pd / (bdCm * cm2px)));

    if (qtyPerPallet > 0 && qtyPerPallet > defaultPerLayer * 5) {
      // デフォルト寸法では5段でも収まらない → qtyPerPalletから逆算
      // 5段想定で1段あたりの個数を決定
      const targetPerLayer = Math.ceil(qtyPerPallet / 5);
      // targetPerLayerに合うグリッドを探す（cols×rows >= targetPerLayer）
      const sqrtTarget = Math.ceil(Math.sqrt(targetPerLayer));
      const cols = sqrtTarget;
      const rows = Math.ceil(targetPerLayer / cols);
      const actualPerLayer = cols * rows;
      const boxW = pw / cols;
      const boxD = pd / rows;
      const actualLayers = Math.min(5, Math.ceil(qtyPerPallet / actualPerLayer));
      allSlots = [];
      for (let layer = 0; layer < actualLayers; layer++) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            allSlots.push({
              x: c * boxW,
              y: r * boxD,
              z: PALLET_H_PX + layer * bh,
              w: boxW, d: boxD, h: bh,
            });
          }
        }
      }
      perLayer = actualPerLayer;
      layers = actualLayers;
    } else {
      allSlots = buildGenericSlots(bwCm, bdCm, bh, layers, pw, pd, cm2px);
      perLayer = allSlots.length > 0 ? Math.round(allSlots.length / layers) : 6;
    }
  }

  // PDU は2ケースで1玉なので、端数のケース数を玉数に直してから図に起こす
  const drawnFraction = casesPerBox > 1 ? Math.ceil(fraction / casesPerBox) : fraction;

  // 端数表示: allSlotsが足りない場合、必要な段数まで拡張
  const displayQty = isFull ? perLayer * layers : drawnFraction;
  if (displayQty > allSlots.length && perLayer > 0) {
    const neededLayers = Math.ceil(displayQty / perLayer);
    const templateH = allSlots.length > 0 ? allSlots[0].h : bh;
    for (let l = layers; l < neededLayers; l++) {
      for (let i = 0; i < perLayer; i++) {
        const src = allSlots[i];
        allSlots.push({ ...src, z: PALLET_H_PX + l * templateH });
      }
    }
    layers = neededLayers;
  }

  // Determine rendered slots
  let renderSlots: BoxSlot[];
  let filled: number;
  if (isFull) {
    renderSlots = allSlots;
    filled = allSlots.length;
  } else {
    // 端数: 下段は満杯、最上段のみ四隅積み
    renderSlots = buildFractionSlots(allSlots, perLayer, drawnFraction);
    filled = renderSlots.length;
  }

  // Calculate total height for viewbox
  const maxZ = renderSlots.reduce((max, s) => Math.max(max, s.z + s.h), PALLET_H_PX);
  const totalHeight = maxZ + 4;

  const uid = `pl${Math.round(bwCm)}${Math.round(bdCm)}${filled}`;
  const animName = `spinPl${uid}`;
  const rotate = isFraction;

  /* ===== 積み方アニメーション =====
   * パレットが出たあと、箱が積む順番どおりに上から落ちてくる。
   * 3D の重なり順を崩さないよう、箱ごとの入れ物は増やさず、
   * 箱の translateZ をそのまま持つキーフレームを奥行きごとに作って当てる。 */
  const stackOrder = stackAnim ? buildStackOrder(renderSlots, (isPdu || isJP7) ? 'layer' : 'backColumn') : null;
  // 速さ（1 = 標準）。大きいほど速い
  const speed = Math.min(4, Math.max(0.25, stackSpeed || 1));
  /** パレットが出てから最初の箱が落ちてくるまで（秒） */
  const PALLET_DELAY = 0.6 / speed;
  /** 箱1つが落ちてくる時間（秒） */
  const DROP_SEC = 0.7 / speed;
  /** パレットが出てくる時間（秒） */
  const PALLET_SEC = 0.5 / speed;
  // 箱が多いときは間隔を詰めて、全体で 7 秒くらいに収める
  const dropGap = stackOrder ? Math.min(0.2, 6.5 / Math.max(1, renderSlots.length)) / speed : 0;
  // 奥行き位置（translateZ）ごとにキーフレームを作る
  const dropKeyframes: string[] = [];
  const dropNameByZ = new Map<number, string>();
  if (stackOrder) {
    for (const slot of renderSlots) {
      const zOff = Math.round((pd / 2 - slot.y - slot.d / 2) * 100) / 100;
      if (dropNameByZ.has(zOff)) continue;
      const name = `drop${uid}z${String(zOff).replace(/[^0-9]/g, '_')}`;
      dropNameByZ.set(zOff, name);
      // 透明度は使わない。opacity を動かすと preserve-3d が効かなくなり、
      // 箱が板のように平たく描かれてしまうため、visibility で出し入れする
      dropKeyframes.push(`@keyframes ${name} {
        0%   { visibility: hidden; transform: translateZ(${zOff}px) translateY(-42px); }
        1%   { visibility: visible; transform: translateZ(${zOff}px) translateY(-41px); }
        80%  { transform: translateZ(${zOff}px) translateY(2px); }
        100% { visibility: visible; transform: translateZ(${zOff}px) translateY(0); }
      }`);
    }
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'visible',
    }}>
      <style>{`
        @keyframes palletFadeUp {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
      {rotate && (
        <style>{`
          @keyframes ${animName} {
            0% { transform: rotateX(-25deg) rotateY(0deg); }
            100% { transform: rotateX(-25deg) rotateY(360deg); }
          }
        `}</style>
      )}
      {/* 出現アニメーション用ラッパー（opacityのみ。3D変換なし） */}
      {stackOrder && (
        <style>{`
          @keyframes palletAppear${uid} {
            0%   { visibility: hidden; transform: translateY(7px); }
            1%   { visibility: visible; transform: translateY(7px); }
            100% { visibility: visible; transform: translateY(0); }
          }
          ${dropKeyframes.join('\n')}
        `}</style>
      )}
      <div style={noIntro || stackOrder ? undefined : { animation: 'palletFadeUp 1.5s ease 0.5s both' }}>
        <div data-pallet-body style={{
          width: pw, height: totalHeight,
          position: 'relative',
          transformStyle: 'preserve-3d',
          ...(overrideRotateY !== undefined
            ? { transform: `rotateX(-25deg) rotateY(${overrideRotateY}deg)` }
            : rotate
              ? { animation: `${animName} 15s linear infinite` }
              : { transform: 'rotateX(-25deg) rotateY(-35deg)' }
          ),
        }}>
        {/* Pallet base — 積み方アニメーションでは、まずパレットだけが出る */}
        {stackOrder ? (
          <div style={{
            position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
            animation: `palletAppear${uid} ${PALLET_SEC.toFixed(2)}s ease both`,
          }}>
            <PalletBase3D pw={pw} pd={pd} ph={PALLET_H_PX} topOffset={totalHeight - PALLET_H_PX} />
          </div>
        ) : (
          <PalletBase3D pw={pw} pd={pd} ph={PALLET_H_PX} topOffset={totalHeight - PALLET_H_PX} />
        )}

        {/* Stacked boxes — 3D空間内に配置 */}
        {renderSlots.map((slot, i) => {
          if (i >= filled) return null;
          const boxTop = totalHeight - PALLET_H_PX - (slot.z - PALLET_H_PX) - slot.h;
          const zOff = Math.round((pd / 2 - slot.y - slot.d / 2) * 100) / 100;
          const dropAnim = stackOrder
            ? `${dropNameByZ.get(zOff)} ${DROP_SEC.toFixed(2)}s cubic-bezier(0.3,0.8,0.4,1.15) ${(PALLET_DELAY + stackOrder[i] * dropGap).toFixed(2)}s both`
            : undefined;
          return (
            <Box3D key={i}
              x={slot.x} y={slot.y}
              w={slot.w} d={slot.d} h={slot.h}
              topBase={boxTop}
              palletDepth={pd}
              wireframe={wireframe}
              split={slot.split}
              dropAnim={dropAnim}
            />
          );
        })}
      </div>
      </div>
    </div>
  );
}
