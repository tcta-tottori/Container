'use client';

import { ItemType } from '@/lib/types';

interface SizeDiagramProps {
  measurements?: string;
  cbm?: number;
  type: ItemType;
  /** コンテナ内の最大寸法（全アイテム共通）。この値を基準にスケーリング */
  maxContainerDim?: number;
}

/** Meas文字列 "55*38*38" → [W, D, H] cm */
export function parseMeas(meas: string): [number, number, number] | null {
  const m = meas.match(/(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * リアルな段ボール質感の3Dボックス。CSS 3D transformでゆっくり回転。
 * シールラベル付き（縦4cm×横2cm相当、前面左上配置）
 */
export default function SizeDiagram({ measurements, cbm, type, maxContainerDim }: SizeDiagramProps) {
  const dims = measurements ? parseMeas(measurements) : null;
  if (!dims && !cbm) return null;

  const [w, d, h] = dims || [40, 30, 30];

  // maxContainerDimを基準にスケーリング — コンテナ内に収まるよう制限
  const refDim = maxContainerDim || Math.max(w, d, h, 1);
  const baseScale = 1.0 / refDim;
  const rawSw = w * baseScale * 100;
  const rawSd = d * baseScale * 100;
  const rawSh = h * baseScale * 100;

  // 最大サイズを制限して枠内に収める
  const maxPx = 90;
  const scaleFactor = Math.min(1, maxPx / Math.max(rawSw, rawSd, rawSh, 1));
  const sw = rawSw * scaleFactor;
  const sd = rawSd * scaleFactor;
  const sh = rawSh * scaleFactor;

  // ユニークID（SVGパターン用）
  const uid = `cb-${type}-${w}-${d}-${h}`;

  // アニメーション名
  const animName = `spin-${uid}`;

  // シールサイズ（実物 縦4cm×横2cm → 箱比率で計算、最小ピクセル保証）
  const sealW = Math.max(sw * (2 / w), 10);  // 横2cm
  const sealH = Math.max(sh * (4 / h), 16);  // 縦4cm
  // テキストサイズ（実物 約2cm角 → 箱比率で計算）
  const textSize = Math.max(Math.min(sealW * 0.7, sealH * 0.22), 5);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      perspective: 400,
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes ${animName} {
          0% { transform: rotateX(-20deg) rotateY(0deg); }
          100% { transform: rotateX(-20deg) rotateY(360deg); }
        }
      `}</style>
      <div style={{
        width: sw, height: sh,
        position: 'relative',
        transformStyle: 'preserve-3d',
        animation: `${animName} 12s linear infinite`,
      }}>
        {/* 前面 */}
        <div style={{
          position: 'absolute', width: sw, height: sh,
          transform: `translateZ(${sd / 2}px)`,
          ...cardboardFace('front', uid, 0.55),
        }}>
          {/* シールラベル（前面左上） */}
          <div style={{
            position: 'absolute', top: 3, left: 3,
            width: sealW, height: sealH,
            background: 'rgba(255,255,255,0.85)',
            border: '0.5px solid rgba(0,0,0,0.2)',
            borderRadius: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', padding: 1,
            backfaceVisibility: 'hidden',
          }}>
            <span style={{
              fontSize: textSize, fontWeight: 900,
              color: '#1a1a1a', lineHeight: 1,
              textAlign: 'center', letterSpacing: '-0.5px',
            }}>要</span>
            <span style={{
              fontSize: textSize, fontWeight: 900,
              color: '#1a1a1a', lineHeight: 1,
              textAlign: 'center', letterSpacing: '-0.5px',
            }}>安全</span>
            <span style={{
              fontSize: textSize * 0.7, fontWeight: 600,
              color: '#555', lineHeight: 1.1,
              textAlign: 'center',
            }}>部</span>
          </div>
        </div>
        {/* 背面 */}
        <div style={{
          position: 'absolute', width: sw, height: sh,
          transform: `rotateY(180deg) translateZ(${sd / 2}px)`,
          ...cardboardFace('back', uid, 0.30),
        }} />
        {/* 左面 */}
        <div style={{
          position: 'absolute', width: sd, height: sh,
          left: (sw - sd) / 2,
          transform: `rotateY(-90deg) translateZ(${sw / 2}px)`,
          ...cardboardFace('left', uid, 0.40),
        }} />
        {/* 右面 */}
        <div style={{
          position: 'absolute', width: sd, height: sh,
          left: (sw - sd) / 2,
          transform: `rotateY(90deg) translateZ(${sw / 2}px)`,
          ...cardboardFace('right', uid, 0.45),
        }} />
        {/* 上面 */}
        <div style={{
          position: 'absolute', width: sw, height: sd,
          top: (sh - sd) / 2,
          transform: `rotateX(90deg) translateZ(${sh / 2}px)`,
          ...cardboardFace('top', uid, 0.60),
        }} />
        {/* 下面 */}
        <div style={{
          position: 'absolute', width: sw, height: sd,
          top: (sh - sd) / 2,
          transform: `rotateX(-90deg) translateZ(${sh / 2}px)`,
          ...cardboardFace('bottom', uid, 0.25),
        }} />
        {/* テープライン（上面の中央） */}
        <div style={{
          position: 'absolute', width: sw, height: sd,
          top: (sh - sd) / 2,
          transform: `rotateX(90deg) translateZ(${sh / 2 + 0.5}px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '12%', height: '100%',
            background: 'rgba(180,160,120,0.25)',
            borderLeft: '1px solid rgba(160,140,100,0.15)',
            borderRight: '1px solid rgba(160,140,100,0.15)',
          }} />
        </div>
        {/* テープライン（前面の中央縦） */}
        <div style={{
          position: 'absolute', width: sw, height: sh,
          transform: `translateZ(${sd / 2 + 0.5}px)`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '12%', height: '35%',
            background: 'rgba(180,160,120,0.20)',
            borderLeft: '1px solid rgba(160,140,100,0.12)',
            borderRight: '1px solid rgba(160,140,100,0.12)',
            borderRadius: '0 0 1px 1px',
          }} />
        </div>
      </div>
    </div>
  );
}

/** 段ボール質感のスタイルを生成 */
function cardboardFace(_face: string, _uid: string, brightness: number): React.CSSProperties {
  // 段ボールの色（茶色系、明るさを面ごとに調整）
  const r = Math.round(160 * brightness + 40);
  const g = Math.round(120 * brightness + 30);
  const b = Math.round(70 * brightness + 20);
  const baseColor = `rgb(${r},${g},${b})`;

  return {
    background: `
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.04) 2px,
        rgba(0,0,0,0.04) 4px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 3px,
        rgba(0,0,0,0.02) 3px,
        rgba(0,0,0,0.02) 6px
      ),
      linear-gradient(
        135deg,
        rgba(255,255,255,0.08) 0%,
        transparent 40%,
        rgba(0,0,0,0.06) 100%
      ),
      ${baseColor}
    `,
    opacity: 0.75,
    border: `1px solid rgba(${Math.round(100 * brightness + 30)},${Math.round(80 * brightness + 20)},${Math.round(40 * brightness + 10)},0.5)`,
    boxSizing: 'border-box',
    backfaceVisibility: 'hidden',
  };
}
