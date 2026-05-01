'use client';

import { ItemType } from '@/lib/types';
import { getNabeModelColor } from '@/lib/nabeColors';

interface SizeDiagramProps {
  measurements?: string;
  cbm?: number;
  type: ItemType;
  maxContainerDim?: number;
  itemName?: string;
}

/** Meas文字列 "55*38*38" → [W, D, H] cm */
export function parseMeas(meas: string): [number, number, number] | null {
  const m = meas.match(/(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 品名から機種名を抽出 */
function extractModelName(itemName: string): string {
  const jpMatch = itemName.match(/JP[A-Z+]*[\s-]?\d{2,}/);
  if (jpMatch) return jpMatch[0].replace(/[\s+]/g, '');
  const pdrMatch = itemName.match(/(PDR|PDU|PVW)[A-Z]*[\s-]?\d{3,}/);
  if (pdrMatch) return pdrMatch[0].replace(/\s+/g, '');
  const genericMatch = itemName.match(/^[A-Z]{2,}[\s-]?\d{2,}/);
  if (genericMatch) return genericMatch[0].replace(/\s+/g, '');
  return '';
}

function isPotType(type: ItemType): boolean {
  return type === '鍋' || type === 'ジャーポット';
}

/** ジャーポット判定 (PDR/PDU/PVW — PDZは除外) */
function isJarPotBox(type: ItemType, itemName?: string): boolean {
  if (type !== 'ジャーポット') return false;
  if (!itemName) return true;
  return !itemName.includes('PDZ');
}

/** ジャーポットのモデル名抽出 (PDR-G221 → PDR G2) */
function extractJarPotModel(itemName: string): { model: string; size: string } {
  const m = itemName.match(/(PD[RU]|PVW)[\s-]*([A-Z]?\d{1,3})/);
  if (m) {
    const num = m[2];
    // PDR-G221 → size "2" (2L), PDR-G301 → "3" (3L), PDR-G401 → "4" (4L/5L)
    const sizeNum = num.match(/(\d)/);
    const size = sizeNum ? `${sizeNum[1]}L` : '';
    return { model: `${m[1]}`, size };
  }
  const gen = itemName.match(/(PD[RUZ]|PVW)/);
  return { model: gen ? gen[1] : 'PDR', size: '' };
}

function defaultNabeDims(itemName: string): [number, number, number] | null {
  if (!itemName) return null;
  if (itemName.includes('180') || /18[RWCS]/.test(itemName)) return [55, 42, 42];
  if (itemName.includes('060') || itemName.includes('06')) return [42, 32, 28];
  return [50, 38, 38];
}

export default function SizeDiagram({ measurements, cbm, type, maxContainerDim, itemName }: SizeDiagramProps) {
  const parsedDims = measurements ? parseMeas(measurements) : null;
  const isPot = isPotType(type);
  const dims = parsedDims || (isPot && itemName ? defaultNabeDims(itemName) : null);
  if (!dims && !cbm) return null;

  const [w, d, h] = dims || [40, 30, 30];

  // スケーリング: 鍋は自身の寸法基準
  const refDim = isPot ? Math.max(w, d, h, 1) : (maxContainerDim || Math.max(w, d, h, 1));
  const baseScale = 1.0 / refDim;
  const rawSw = w * baseScale * 100;
  const rawSd = d * baseScale * 100;
  const rawSh = h * baseScale * 100;

  const maxPx = 90;
  const scaleFactor = Math.min(1, maxPx / Math.max(rawSw, rawSd, rawSh, 1));
  const sw = rawSw * scaleFactor;
  const sd = rawSd * scaleFactor;
  const sh = rawSh * scaleFactor;

  const uid = `cb${Math.round(w * 10)}${Math.round(d * 10)}${Math.round(h * 10)}`;
  const animName = `spin${uid}`;
  const modelName = itemName ? extractModelName(itemName) : '';
  const nabeColor = itemName ? getNabeModelColor(itemName, type) : null;
  const isJarPot = isJarPotBox(type, itemName);
  const jarPotInfo = isJarPot && itemName ? extractJarPotModel(itemName) : null;

  // シールサイズ固定: 4cm×4.5cm → スケール適用
  const sealH = Math.max(sh * (4 / h), 12);
  const sealW = Math.max(sd * (4.5 / d), 14);

  // 前面の「重要安全部品」文字サイズ — 箱サイズに収まるよう自動調整
  const bigTextSize = Math.max(Math.min(sw * 0.18, sh * 0.16, sd * 0.2), 5);
  // 部品の会社名テキスト — 箱幅に合わせて縮小
  const companyTextSize = Math.max(Math.min(sw * 0.11, sh * 0.08), 4);
  const companySubTextSize = Math.max(Math.min(sw * 0.04, sh * 0.03), 2);
  // MADE IN KOREAテキスト — 面幅に合わせる
  const koreaTextSize = (faceW: number) => Math.max(Math.min(faceW * 0.08, 5), 2.5);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'visible',
    }}>
      <style>{`
        @keyframes ${animName} {
          0% { transform: rotateX(-20deg) rotateY(0deg); }
          100% { transform: rotateX(-20deg) rotateY(360deg); }
        }
      `}</style>
      <div style={{
        width: sw, height: sh, position: 'relative',
        transformStyle: 'preserve-3d',
        animation: `${animName} 12s linear infinite`,
      }}>
        {/* 前面 */}
        <div style={{
          position: 'absolute', width: sw, height: sh,
          transform: `translateZ(${sd / 2}px)`,
          ...cardboardFace(0.55),
        }}>
          {isJarPot && jarPotInfo ? (
            /* ジャーポット: モデル名 + 色バリエーショングリッド */
            <>
              {/* モデル名（右上） */}
              <div style={{
                position: 'absolute', top: '6%', right: '8%',
                backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sw * 0.22, 7), fontWeight: 900,
                  color: 'rgba(40,30,15,0.75)', fontFamily: 'var(--font-mono)',
                  letterSpacing: '-0.5px', lineHeight: 1,
                }}>{jarPotInfo.model} {jarPotInfo.size}</span>
              </div>
              {/* 色バリエーショングリッド（左側） */}
              <div style={{
                position: 'absolute', top: '10%', left: '8%', bottom: '10%',
                display: 'flex', flexDirection: 'column', gap: 0,
                backfaceVisibility: 'hidden',
              }}>
                {['A', 'C', 'R', 'S', 'U', 'W'].map((c) => (
                  <div key={c} style={{
                    width: Math.max(sw * 0.14, 5),
                    height: Math.max(sh * 0.1, 3),
                    border: '0.5px solid rgba(40,30,15,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: Math.max(sw * 0.06, 2.5), fontWeight: 800,
                    color: 'rgba(40,30,15,0.65)', fontFamily: 'var(--font-mono)',
                    lineHeight: 1,
                  }}>{c}</div>
                ))}
              </div>
            </>
          ) : isPot && !isJarPot ? (
            /* 鍋: 写真準拠 — ラベル(左上) + GLOBAL CORD(右) + MADE IN KOREA(右上) + L字コーナー */
            <>
              {/* L字コーナーマーク（四隅） */}
              {[[3, 3, 'top', 'left'], [3, 3, 'top', 'right'], [3, 3, 'bottom', 'left'], [3, 3, 'bottom', 'right']].map(([, , v, h], i) => (
                <div key={i} style={{
                  position: 'absolute', [v as string]: '4%', [h as string]: '4%',
                  width: Math.max(sw * 0.06, 3), height: Math.max(sh * 0.06, 3),
                  borderColor: 'rgba(40,30,15,0.35)', borderStyle: 'solid', borderWidth: 0,
                  ...(v === 'top' && h === 'left' ? { borderTopWidth: '0.8px', borderLeftWidth: '0.8px' } :
                     v === 'top' && h === 'right' ? { borderTopWidth: '0.8px', borderRightWidth: '0.8px' } :
                     v === 'bottom' && h === 'left' ? { borderBottomWidth: '0.8px', borderLeftWidth: '0.8px' } :
                     { borderBottomWidth: '0.8px', borderRightWidth: '0.8px' }),
                  backfaceVisibility: 'hidden',
                }} />
              ))}
              {/* MADE IN KOREA（右上） */}
              <div style={{
                position: 'absolute', top: '10%', right: '8%',
                backfaceVisibility: 'hidden', maxWidth: '55%', overflow: 'hidden',
              }}>
                <span style={{
                  fontSize: koreaTextSize(sw), fontWeight: 800,
                  color: 'rgba(40,30,15,0.55)', letterSpacing: '0.3px',
                  fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                }}>MADE IN KOREA</span>
              </div>
              {/* 機種名ラベルシール（左上） */}
              <div style={{
                position: 'absolute', top: '28%', left: '8%',
                width: Math.max(sw * 0.3, 12), height: Math.max(sh * 0.22, 8),
                background: '#f8f8f4',
                border: '0.5px solid rgba(0,0,0,0.25)',
                borderRadius: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', padding: 1,
                backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(Math.min(sw * 0.1, sh * 0.1), 4), fontWeight: 900,
                  color: nabeColor || '#1a1a1a', lineHeight: 1,
                  textAlign: 'center', fontFamily: 'var(--font-mono)',
                  letterSpacing: '-0.3px',
                }}>{modelName || 'JPVH'}</span>
              </div>
              {/* GLOBAL CORDラベル（ラベル右横） */}
              <div style={{
                position: 'absolute', top: '28%', left: '42%',
                width: Math.max(sw * 0.28, 10), height: Math.max(sh * 0.18, 6),
                background: '#f8f8f4',
                border: '0.5px solid rgba(0,0,0,0.2)',
                borderRadius: 1,
                display: 'flex', flexDirection: 'column',
                padding: '1px 2px', gap: 0,
                backfaceVisibility: 'hidden', overflow: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sw * 0.04, 2), fontWeight: 700,
                  color: 'rgba(30,30,30,0.7)', lineHeight: 1.1,
                }}>GLOBAL CORD</span>
                {[1, 2].map((i) => (
                  <div key={i} style={{
                    height: 0.6, background: `rgba(0,0,0,0.1)`,
                    margin: '1px 0', width: `${60 + i * 15}%`,
                  }} />
                ))}
              </div>
              {/* MADE IN KOREA（下部） */}
              <div style={{
                position: 'absolute', bottom: '6%', left: 0, right: 0,
                textAlign: 'center', backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: koreaTextSize(sw), fontWeight: 800,
                  color: 'rgba(40,30,15,0.55)', letterSpacing: '0.3px',
                  fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                }}>MADE IN KOREA</span>
              </div>
            </>
          ) : type === '箱' ? (
            /* 箱: 左上にラベルシール + 右上に黒丸数字 */
            <>
              {/* ラベルシール（左上、大きめ） */}
              <div style={{
                position: 'absolute', top: '6%', left: '5%',
                width: '55%', height: '45%',
                background: '#f5f5f0',
                border: '0.5px solid rgba(0,0,0,0.25)',
                borderRadius: 1,
                display: 'flex', flexDirection: 'column',
                padding: '2px 3px', gap: 0,
                backfaceVisibility: 'hidden', overflow: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sw * 0.05, 2), color: '#888', lineHeight: 1.2,
                }}>Green Pack Industrial Co., Ltd</span>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{
                    height: 1, background: `rgba(0,0,0,${0.08 + i * 0.02})`,
                    margin: '1px 0', width: `${60 + i * 8}%`,
                  }} />
                ))}
              </div>
              {/* 黒丸数字（右上） */}
              <div style={{
                position: 'absolute', top: '8%', right: '10%',
                width: Math.max(sw * 0.2, 8), height: Math.max(sw * 0.2, 8),
                borderRadius: '50%', background: 'rgba(20,20,20,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sw * 0.12, 4), fontWeight: 900,
                  color: '#fff', fontFamily: 'var(--font-mono)',
                }}>10</span>
              </div>
            </>
          ) : type === '部品' ? (
            /* 部品: 新建高電業（深圳）有限公司 + オレンジラベル */
            <>
              {/* 会社名テキスト（中央〜下） */}
              <div style={{
                position: 'absolute', bottom: '12%', left: '6%', right: '6%',
                backfaceVisibility: 'hidden',
              }}>
                <div style={{
                  fontSize: companyTextSize, fontWeight: 900,
                  color: 'rgba(40,25,10,0.7)', lineHeight: 1.3,
                  letterSpacing: '0.3px', overflow: 'hidden', whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}>新建高電業(深圳)有限公司</div>
                <div style={{
                  fontSize: companySubTextSize, fontWeight: 600,
                  color: 'rgba(40,25,10,0.45)', lineHeight: 1.2,
                  letterSpacing: '0.2px', marginTop: 1,
                  fontFamily: 'var(--font-mono)', overflow: 'hidden',
                  whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>KENCORP ELECTRIC(SHENZHEN)CO.,LIMITED</div>
              </div>
              {/* オレンジ色ラベルシール（右上） */}
              <div style={{
                position: 'absolute', top: '6%', right: '5%',
                width: '35%', height: '40%',
                background: 'linear-gradient(180deg, #f97316 0%, #f97316 15%, #fff 15%, #fff 100%)',
                border: '0.5px solid rgba(0,0,0,0.3)',
                borderRadius: 1,
                backfaceVisibility: 'hidden', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                padding: '0 2px',
              }}>
                {/* オレンジヘッダー部分 */}
                <div style={{ height: '15%', minHeight: 2 }} />
                {/* 情報ライン */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{
                    height: 0.8, background: `rgba(0,0,0,${0.06 + i * 0.015})`,
                    margin: '1.5px 1px', width: `${50 + i * 8}%`,
                  }} />
                ))}
              </div>
            </>
          ) : (
            /* ポリカバー/その他: 写真準拠 — 重要安全部品 + UPPER LID ASSY + JRI,JPV専用 + ラベルシール */
            <>
              {/* 重要安全部品（中央やや上・大きく） */}
              <div style={{
                position: 'absolute', top: '15%', left: '8%', right: '8%',
                backfaceVisibility: 'hidden', textAlign: 'center',
              }}>
                <span style={{
                  fontSize: bigTextSize, fontWeight: 900,
                  color: 'rgba(60,40,20,0.7)', lineHeight: 1.3,
                  letterSpacing: '1.5px',
                }}>重要<br/>安全部品</span>
              </div>
              {/* UPPER LID ASSY（重要安全部品の下） */}
              <div style={{
                position: 'absolute', top: '58%', left: '8%',
                backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sw * 0.05, 2), fontWeight: 700,
                  color: 'rgba(60,40,20,0.4)', fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.3px',
                }}>UPPER LID ASSY</span>
              </div>
              {/* JRI,JPV専用（左下） */}
              <div style={{
                position: 'absolute', bottom: '6%', left: '6%',
                backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sw * 0.06, 2.5), fontWeight: 800,
                  color: 'rgba(60,40,20,0.5)', letterSpacing: '0.5px',
                }}>JRI,JPV専用</span>
              </div>
              {/* 白ラベルシール（右下） */}
              <div style={{
                position: 'absolute', bottom: '14%', right: '6%',
                width: Math.max(sw * 0.35, 12), height: Math.max(sh * 0.2, 7),
                background: '#f5f5f0',
                border: '0.5px solid rgba(0,0,0,0.2)',
                borderRadius: 1,
                display: 'flex', flexDirection: 'column',
                padding: '1px 2px', gap: 0,
                backfaceVisibility: 'hidden', overflow: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sw * 0.035, 1.8), fontWeight: 600,
                  color: 'rgba(0,0,0,0.5)', fontFamily: 'var(--font-mono)',
                  lineHeight: 1.2,
                }}>JRI0000402</span>
                {[1, 2].map((i) => (
                  <div key={i} style={{
                    height: 0.5, background: 'rgba(0,0,0,0.08)',
                    margin: '0.5px 0', width: `${50 + i * 20}%`,
                  }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 背面 */}
        <div style={{
          position: 'absolute', width: sw, height: sh,
          transform: `rotateY(180deg) translateZ(${sd / 2}px)`,
          ...cardboardFace(0.30),
        }} />

        {/* 左面(狭い面) — ラベルシールはここに貼る */}
        <div style={{
          position: 'absolute', width: sd, height: sh,
          left: (sw - sd) / 2,
          transform: `rotateY(-90deg) translateZ(${sw / 2}px)`,
          ...cardboardFace(0.40),
        }}>
          {/* 鍋: 左面にMADE IN KOREA（ラベルは前面に移動済み） */}
          {isPot && !isJarPot && (
            <div style={{
              position: 'absolute', bottom: '8%', left: 0, right: 0,
              textAlign: 'center', backfaceVisibility: 'hidden',
            }}>
              <span style={{
                fontSize: Math.max(sd * 0.08, 3), fontWeight: 800,
                color: 'rgba(40,30,15,0.5)', fontFamily: 'var(--font-mono)',
              }}>MADE IN KOREA</span>
            </div>
          )}
          {/* ラベルシール（面積小の左面 — 鍋以外） */}
          {!(isPot && !isJarPot) && (() => {
            // ポリカバー/その他: 3cm×3.5cm固定、左上配置
            const isPolyOther = type === 'ポリカバー' || type === 'その他';
            const sealWPx = isPolyOther ? Math.max(sd * (3.5 / d), 10) : sealW;
            const sealHPx = isPolyOther ? Math.max(sh * (3 / h), 9) : sealH;
            const sealFontSize = Math.max(Math.min(sealWPx * 0.18, sealHPx * 0.22), 3);
            return (
              <div style={{
                position: 'absolute',
                top: isPolyOther ? '8%' : Math.max(sh * 0.12, 2),
                left: isPolyOther ? '8%' : '50%',
                transform: isPolyOther ? undefined : 'translateX(-50%)',
                width: sealWPx, height: sealHPx,
                background: '#f5f5f0',
                border: '0.5px solid rgba(0,0,0,0.3)',
                borderRadius: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start', justifyContent: 'center',
                overflow: 'hidden', padding: '1px 2px',
                backfaceVisibility: 'hidden', gap: 0,
              }}>
                <span style={{ fontSize: sealFontSize * 0.75, color: '#666', lineHeight: 1 }}>产品规格</span>
                <span style={{
                  fontSize: Math.max(sealFontSize * 1.1, 3.5), fontWeight: 800,
                  color: '#1a1a1a', lineHeight: 1.1,
                  fontFamily: 'var(--font-mono)',
                }}>{modelName || 'JPI'}</span>
              </div>
            );
          })()}
        </div>

        {/* 右面(狭い面) */}
        <div style={{
          position: 'absolute', width: sd, height: sh,
          left: (sw - sd) / 2,
          transform: `rotateY(90deg) translateZ(${sw / 2}px)`,
          ...cardboardFace(0.45),
        }}>
          {/* 鍋: 右側面にもMADE IN KOREA + ケアマーク */}
          {isPot && !isJarPot && (
            <>
              <div style={{
                position: 'absolute', bottom: '8%', left: 0, right: 0,
                textAlign: 'center', backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: koreaTextSize(sd), fontWeight: 800,
                  color: 'rgba(40,30,15,0.5)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                  letterSpacing: '0.3px',
                }}>MADE IN KOREA</span>
              </div>
              <div style={{
                position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 2, backfaceVisibility: 'hidden', opacity: 0.35,
              }}>
                <CareMarkArrowUp size={Math.max(sd * 0.12, 4)} />
                <CareMarkUmbrella size={Math.max(sd * 0.12, 4)} />
              </div>
            </>
          )}
          {/* 部品: 右側面にも会社名テキスト */}
          {type === '部品' && (
            <div style={{
              position: 'absolute', bottom: '12%', left: '8%', right: '8%',
              backfaceVisibility: 'hidden',
            }}>
              <div style={{
                fontSize: Math.max(Math.min(sd * 0.11, sh * 0.07), 3), fontWeight: 900,
                color: 'rgba(40,25,10,0.6)', lineHeight: 1.3,
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>新建高電業(深圳)有限公司</div>
            </div>
          )}
          {/* ジャーポット: 右面にもモデル名+色グリッド（小さめ） */}
          {isJarPot && jarPotInfo && (
            <>
              <div style={{
                position: 'absolute', top: '8%', right: '10%',
                backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sd * 0.18, 5), fontWeight: 900,
                  color: 'rgba(40,30,15,0.65)', fontFamily: 'var(--font-mono)',
                  lineHeight: 1,
                }}>{jarPotInfo.model} {jarPotInfo.size}</span>
              </div>
              <div style={{
                position: 'absolute', top: '12%', left: '10%', bottom: '15%',
                display: 'flex', flexDirection: 'column', gap: 0,
                backfaceVisibility: 'hidden',
              }}>
                {['A', 'C', 'R', 'S', 'U', 'W'].map((c) => (
                  <div key={c} style={{
                    width: Math.max(sd * 0.13, 4),
                    height: Math.max(sh * 0.08, 2.5),
                    border: '0.4px solid rgba(40,30,15,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: Math.max(sd * 0.05, 2), fontWeight: 800,
                    color: 'rgba(40,30,15,0.55)', fontFamily: 'var(--font-mono)',
                    lineHeight: 1,
                  }}>{c}</div>
                ))}
              </div>
            </>
          )}
          {/* ポリカバー: 右側面にSIZE表示 + 会社名 */}
          {(type === 'ポリカバー' || type === 'その他') && !isPot && !isJarPot && (
            <>
              <div style={{
                position: 'absolute', top: '8%', right: '6%',
                backfaceVisibility: 'hidden',
              }}>
                <span style={{
                  fontSize: Math.max(sd * 0.07, 2.5), fontWeight: 700,
                  color: 'rgba(40,30,15,0.5)', fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}>SIZE:{Math.round(w * 10)}x{Math.round(d * 10)}x{Math.round(h * 10)}mm</span>
              </div>
              <div style={{
                position: 'absolute', bottom: '10%', left: '6%', right: '6%',
                backfaceVisibility: 'hidden',
              }}>
                <div style={{
                  fontSize: Math.max(sd * 0.06, 2), fontWeight: 800,
                  color: 'rgba(40,30,15,0.5)', lineHeight: 1.3,
                }}>新建高電業(深圳)有限公司</div>
                <div style={{
                  fontSize: Math.max(sd * 0.035, 1.5), fontWeight: 600,
                  color: 'rgba(40,30,15,0.35)', fontFamily: 'var(--font-mono)',
                  lineHeight: 1.2, marginTop: 0.5,
                }}>KENCORP ELECTRIC(SHENZHEN)CO.,LIMITED</div>
              </div>
            </>
          )}
        </div>

        {/* 上面 */}
        <div style={{
          position: 'absolute', width: sw, height: sd,
          top: (sh - sd) / 2,
          transform: `rotateX(90deg) translateZ(${sh / 2}px)`,
          ...cardboardFace(0.60),
        }}>
          {/* 鍋: 上面にケアマーク群 + MADE IN KOREA */}
          {isPot && !isJarPot && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: Math.max(sw * 0.04, 2),
              backfaceVisibility: 'hidden', opacity: 0.4,
            }}>
              <CareMarkUmbrella size={Math.max(sw * 0.1, 4)} />
              <CareMarkArrowUp size={Math.max(sw * 0.1, 4)} />
              <span style={{
                fontSize: Math.max(sw * 0.05, 2.5), fontWeight: 800,
                color: 'rgba(40,30,15,0.7)', fontFamily: 'var(--font-mono)',
                transform: 'rotate(180deg)',
              }}>MADE IN KOREA</span>
            </div>
          )}
        </div>
        {/* 下面 */}
        <div style={{
          position: 'absolute', width: sw, height: sd,
          top: (sh - sd) / 2,
          transform: `rotateX(-90deg) translateZ(${sh / 2}px)`,
          ...cardboardFace(0.25),
        }} />
        {/* テープライン（上面） */}
        <div style={{
          position: 'absolute', width: sw, height: sd,
          top: (sh - sd) / 2,
          transform: `rotateX(90deg) translateZ(${sh / 2 + 0.5}px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '12%', height: '100%',
            background: 'rgba(200,180,140,0.35)',
          }} />
        </div>
        {/* テープライン（前面縦） */}
        <div style={{
          position: 'absolute', width: sw, height: sh,
          transform: `translateZ(${sd / 2 + 0.5}px)`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '12%', height: '35%',
            background: 'rgba(200,180,140,0.30)',
            borderRadius: '0 0 1px 1px',
          }} />
        </div>
      </div>
    </div>
  );
}

/* ===== ケアマーク SVG ===== */
function CareMarkArrowUp({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke="rgba(80,60,40,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="22" x2="8" y2="6"/><polyline points="3,11 8,4 13,11"/>
        <line x1="16" y1="22" x2="16" y2="6"/><polyline points="11,11 16,4 21,11"/>
      </g>
    </svg>
  );
}
function CareMarkUmbrella({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke="rgba(80,60,40,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12,4 C6,4 2,10 2,10 L22,10 C22,10 18,4 12,4Z"/>
        <line x1="12" y1="10" x2="12" y2="20"/><path d="M12,20 C12,22 14,22 14,20"/>
      </g>
    </svg>
  );
}

/** 段ボール質感（不透明） */
export function cardboardFace(brightness: number): React.CSSProperties {
  const r = Math.round(180 * brightness + 50);
  const g = Math.round(140 * brightness + 40);
  const b = Math.round(80 * brightness + 25);
  return {
    background: `
      repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.05) 2px,rgba(0,0,0,0.05) 4px),
      repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(0,0,0,0.03) 3px,rgba(0,0,0,0.03) 6px),
      linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 40%,rgba(0,0,0,0.08) 100%),
      rgb(${r},${g},${b})
    `,
    border: `1px solid rgba(${Math.round(100 * brightness + 30)},${Math.round(80 * brightness + 20)},${Math.round(40 * brightness + 10)},0.6)`,
    boxSizing: 'border-box',
    backfaceVisibility: 'hidden',
  };
}
