'use client';

import { ItemType } from '@/lib/types';

interface SizeDiagramProps {
  measurements?: string;
  cbm?: number;
  type: ItemType;
  /** コンテナ内の最大寸法（全アイテム共通）。この値を基準にスケーリング */
  maxContainerDim?: number;
  /** 品名（鍋の機種ラベル用） */
  itemName?: string;
}

/** Meas文字列 "55*38*38" → [W, D, H] cm */
export function parseMeas(meas: string): [number, number, number] | null {
  const m = meas.match(/(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 品名から機種名を抽出（JPxx-xxxx形式やJPVS100等） */
function extractModelName(itemName: string): string {
  // JPxx-xxxxパターン
  const jpMatch = itemName.match(/JP[A-Z]*[\s-]?\d{3,}/);
  if (jpMatch) return jpMatch[0].replace(/\s+/g, '');
  // PDR/PDU/PVWパターン
  const pdrMatch = itemName.match(/(PDR|PDU|PVW)[A-Z]*[\s-]?\d{3,}/);
  if (pdrMatch) return pdrMatch[0].replace(/\s+/g, '');
  // 先頭のアルファベット+数字を取得
  const genericMatch = itemName.match(/^[A-Z]{2,}[\s-]?\d{2,}/);
  if (genericMatch) return genericMatch[0].replace(/\s+/g, '');
  return '';
}

/** 鍋タイプ判定 */
function isPotType(type: ItemType): boolean {
  return type === '鍋' || type === 'ジャーポット';
}

export default function SizeDiagram({ measurements, cbm, type, maxContainerDim, itemName }: SizeDiagramProps) {
  const dims = measurements ? parseMeas(measurements) : null;
  if (!dims && !cbm) return null;

  const [w, d, h] = dims || [40, 30, 30];

  const refDim = maxContainerDim || Math.max(w, d, h, 1);
  const baseScale = 1.0 / refDim;
  const rawSw = w * baseScale * 100;
  const rawSd = d * baseScale * 100;
  const rawSh = h * baseScale * 100;

  const maxPx = 90;
  const scaleFactor = Math.min(1, maxPx / Math.max(rawSw, rawSd, rawSh, 1));
  const sw = rawSw * scaleFactor;
  const sd = rawSd * scaleFactor;
  const sh = rawSh * scaleFactor;

  const uid = `cb-${type}-${w}-${d}-${h}`;
  const animName = `spin-${uid}`;
  const isPot = isPotType(type);
  const modelName = itemName ? extractModelName(itemName) : '';

  // シールサイズ（鍋: 横3cm×縦2cm相当、その他: 横2cm×縦4cm相当）
  const sealW = isPot
    ? Math.max(sw * (3 / w), 14)
    : Math.max(sw * (2 / w), 10);
  const sealH = isPot
    ? Math.max(sh * (2 / h), 10)
    : Math.max(sh * (4 / h), 16);
  const sealTextSize = isPot
    ? Math.max(Math.min(sealW * 0.28, sealH * 0.55), 4)
    : Math.max(Math.min(sealW * 0.7, sealH * 0.22), 5);

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
          ...cardboardFace(0.55),
        }}>
          {isPot ? (
            /* 鍋用: 実物準拠レイアウト */
            <>
              {/* 機種ラベルシール（左上、横3cm×縦2cm相当） */}
              <div style={{
                position: 'absolute', top: 3, left: 3,
                width: sealW, height: sealH,
                background: 'rgba(255,255,255,0.92)',
                border: '0.5px solid rgba(0,0,0,0.25)',
                borderRadius: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', padding: 1,
                backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: sealTextSize, fontWeight: 900,
                  color: '#1a1a1a', lineHeight: 1,
                  textAlign: 'center', letterSpacing: '-0.3px',
                  fontFamily: 'var(--font-mono)',
                }}>{modelName || 'JPVS'}</span>
              </div>
              {/* ケアマーク群（中央〜右寄り） */}
              <div style={{
                position: 'absolute', top: '15%', right: '8%', bottom: '25%',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'space-around', gap: 1,
                backfaceVisibility: 'hidden', opacity: 0.45,
              }}>
                <CareMarkArrowUp size={Math.max(sw * 0.14, 6)} />
                <CareMarkUmbrella size={Math.max(sw * 0.12, 5)} />
                <CareMarkFragile size={Math.max(sw * 0.12, 5)} />
              </div>
              {/* MADE IN KOREA（下部） */}
              <div style={{
                position: 'absolute', bottom: '4%', left: 0, right: 0,
                textAlign: 'center', backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sw * 0.07, 3.5), fontWeight: 700,
                  color: 'rgba(80,60,40,0.5)', letterSpacing: '0.5px',
                  fontFamily: 'var(--font-mono)',
                }}>MADE IN KOREA</span>
              </div>
            </>
          ) : (
            /* 鍋以外: 従来のシール */
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
                fontSize: sealTextSize, fontWeight: 900,
                color: '#1a1a1a', lineHeight: 1,
                textAlign: 'center', letterSpacing: '-0.5px',
              }}>要</span>
              <span style={{
                fontSize: sealTextSize, fontWeight: 900,
                color: '#1a1a1a', lineHeight: 1,
                textAlign: 'center', letterSpacing: '-0.5px',
              }}>安全</span>
              <span style={{
                fontSize: sealTextSize * 0.7, fontWeight: 600,
                color: '#555', lineHeight: 1.1,
                textAlign: 'center',
              }}>部</span>
            </div>
          )}
        </div>
        {/* 背面 */}
        <div style={{
          position: 'absolute', width: sw, height: sh,
          transform: `rotateY(180deg) translateZ(${sd / 2}px)`,
          ...cardboardFace(0.30),
        }} />
        {/* 左面 */}
        <div style={{
          position: 'absolute', width: sd, height: sh,
          left: (sw - sd) / 2,
          transform: `rotateY(-90deg) translateZ(${sw / 2}px)`,
          ...cardboardFace(0.40),
        }}>
          {/* 左面にもケアマーク（鍋のみ） */}
          {isPot && (
            <div style={{
              position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              backfaceVisibility: 'hidden', opacity: 0.4,
            }}>
              <CareMarkArrowUp size={Math.max(sd * 0.16, 5)} />
              <CareMarkHandle size={Math.max(sd * 0.14, 4)} />
            </div>
          )}
        </div>
        {/* 右面 */}
        <div style={{
          position: 'absolute', width: sd, height: sh,
          left: (sw - sd) / 2,
          transform: `rotateY(90deg) translateZ(${sw / 2}px)`,
          ...cardboardFace(0.45),
        }}>
          {isPot && (
            <div style={{
              position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              backfaceVisibility: 'hidden', opacity: 0.4,
            }}>
              <CareMarkArrowUp size={Math.max(sd * 0.16, 5)} />
              <CareMarkUmbrella size={Math.max(sd * 0.14, 4)} />
            </div>
          )}
        </div>
        {/* 上面 */}
        <div style={{
          position: 'absolute', width: sw, height: sd,
          top: (sh - sd) / 2,
          transform: `rotateX(90deg) translateZ(${sh / 2}px)`,
          ...cardboardFace(0.60),
        }} />
        {/* 下面 */}
        <div style={{
          position: 'absolute', width: sw, height: sd,
          top: (sh - sd) / 2,
          transform: `rotateX(-90deg) translateZ(${sh / 2}px)`,
          ...cardboardFace(0.25),
        }} />
        {/* テープライン（上面中央） */}
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
        {/* テープライン（前面中央縦） */}
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

/* ===== ケアマーク SVG コンポーネント（段ボール印刷風） ===== */

function CareMarkArrowUp({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke="rgba(80,60,40,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="22" x2="8" y2="6"/>
        <polyline points="3,11 8,4 13,11"/>
        <line x1="16" y1="22" x2="16" y2="6"/>
        <polyline points="11,11 16,4 21,11"/>
      </g>
    </svg>
  );
}

function CareMarkUmbrella({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke="rgba(80,60,40,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12,4 C6,4 2,10 2,10 L22,10 C22,10 18,4 12,4Z"/>
        <line x1="12" y1="10" x2="12" y2="20"/>
        <path d="M12,20 C12,22 14,22 14,20"/>
      </g>
    </svg>
  );
}

function CareMarkFragile({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke="rgba(80,60,40,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* ワイングラス（割れ物注意） */}
        <path d="M8,2 L16,2 L14,9 L16,9 L16,11 L8,11 L8,9 L10,9 L8,2Z"/>
        <line x1="12" y1="11" x2="12" y2="18"/>
        <line x1="8" y1="18" x2="16" y2="18"/>
        {/* 割れ線 */}
        <path d="M12,3 L13,5 L11,7 L12,9" strokeWidth="1.5"/>
      </g>
    </svg>
  );
}

function CareMarkHandle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke="rgba(80,60,40,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* 手で持つマーク */}
        <path d="M6,14 C6,8 18,8 18,14"/>
        <line x1="6" y1="14" x2="6" y2="20"/>
        <line x1="18" y1="14" x2="18" y2="20"/>
        <line x1="4" y1="20" x2="20" y2="20"/>
      </g>
    </svg>
  );
}

/** 段ボール質感のスタイルを生成 */
function cardboardFace(brightness: number): React.CSSProperties {
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
