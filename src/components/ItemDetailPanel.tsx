'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { extractColor, areSimilarItems, getSimilarityReason } from '@/lib/typeDetector';
import { getNabeModelColor, nabeColorToDarkBg } from '@/lib/nabeColors';
import PalletDiagram from './PalletDiagram';
import SizeDiagram, { parseMeas } from './SizeDiagram';

interface ItemDetailPanelProps {
  item: ContainerItem;
  relatedItems: ContainerItem[];
  allItems: ContainerItem[];
  completedIds: Set<string>;
  onSelectItem?: (idx: number) => void;
  onCompleteItem?: (id: string) => void;
  onUncompleteItem?: (id: string) => void;
  onDecrementPallet?: () => void;
}

/* ===== 類似品アイコン ===== */
function NameSimilarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#fff" stroke="#333" strokeWidth="1" />
      <text x="8" y="11.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#000">A</text>
    </svg>
  );
}

function ColorVariantIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <defs>
        <clipPath id="cv-top"><polygon points="0,0 16,0 16,16" /></clipPath>
        <clipPath id="cv-bot"><polygon points="0,0 0,16 16,16" /></clipPath>
      </defs>
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#fff" clipPath="url(#cv-top)" />
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#222" clipPath="url(#cv-bot)" />
      <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="#666" strokeWidth="1" />
      <line x1="1" y1="15" x2="15" y2="1" stroke="#666" strokeWidth="1" />
    </svg>
  );
}

/* ===== 類似品名の差異ハイライト ===== */
function HighlightDiff({ base, target }: { base: string; target: string }) {
  // 括弧部分を分離
  const baseParen = base.match(/\([^)]+\)/)?.[0] || '';
  const targetParen = target.match(/\([^)]+\)/)?.[0] || '';
  const baseCore = base.replace(/\([^)]+\)/, '').replace(/ポリカバー/g, '').trim();
  const targetCore = target.replace(/\([^)]+\)/, '').replace(/ポリカバー/g, '').trim();
  const targetDisplay = target.replace(/ポリカバー/g, '').trim();

  // コア部分の差異位置を特定
  const diffIndices = new Set<number>();
  const maxLen = Math.max(baseCore.length, targetCore.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= baseCore.length || i >= targetCore.length || baseCore[i] !== targetCore[i]) {
      diffIndices.add(i);
    }
  }

  // 括弧が違う場合は括弧全体を強調
  const parenDiff = baseParen !== targetParen;

  // targetDisplayをレンダリング（コア部分の差異は赤太字、括弧差異も赤太字）
  const parenInDisplay = targetDisplay.match(/\([^)]+\)/)?.[0] || '';
  const parenStart = targetDisplay.indexOf(parenInDisplay);

  const elements: React.ReactNode[] = [];
  let coreIdx = 0;
  for (let i = 0; i < targetDisplay.length; i++) {
    const inParen = parenInDisplay && i >= parenStart && i < parenStart + parenInDisplay.length;
    if (inParen) {
      if (parenDiff) {
        elements.push(<span key={i} style={{ color: '#ef4444', fontWeight: 900 }}>{targetDisplay[i]}</span>);
      } else {
        elements.push(<span key={i}>{targetDisplay[i]}</span>);
      }
    } else {
      if (diffIndices.has(coreIdx)) {
        elements.push(<span key={i} style={{ color: '#ef4444', fontWeight: 900 }}>{targetDisplay[i]}</span>);
      } else {
        elements.push(<span key={i}>{targetDisplay[i]}</span>);
      }
      coreIdx++;
    }
  }

  return <span>{elements}</span>;
}

/* ===== マーキーテキスト ===== */
function MarqueeText({ text, className, style }: {
  text: string; className?: string; style?: React.CSSProperties;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const check = () => {
      if (outerRef.current && innerRef.current) {
        setOverflow(innerRef.current.scrollWidth > outerRef.current.clientWidth + 2);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text]);

  return (
    <div ref={outerRef} className={`marquee-outer ${className || ''}`} style={style}>
      <div className={overflow ? 'marquee-scroll' : ''}>
        <span ref={innerRef} className="marquee-text">{text}</span>
        {overflow && <span className="marquee-text marquee-dup" aria-hidden="true">{text}</span>}
      </div>
    </div>
  );
}

/* ===== 類似品マーキー ===== */
function SimilarItemsMarquee({ item, similarItems }: {
  item: ContainerItem; similarItems: ContainerItem[];
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const check = () => {
      if (outerRef.current && innerRef.current) {
        setOverflow(innerRef.current.scrollWidth > outerRef.current.clientWidth + 2);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [item.id, similarItems.length]);

  const content = similarItems.map((s, i) => {
    const reason = getSimilarityReason(item.itemName, s.itemName);
    return (
      <span key={s.id} style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 12, fontWeight: 700, color: '#fff',
      }}>
        {i > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>|</span>}
        {reason === 'color' ? <ColorVariantIcon size={14} /> : <NameSimilarIcon size={14} />}
        <HighlightDiff base={item.itemName} target={s.itemName} />
      </span>
    );
  });

  return (
    <div className="similar-warn-blink" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      borderRadius: 6, padding: '4px 10px',
      flexShrink: 0, position: 'relative', zIndex: 2,
      overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: '#fbbf24', whiteSpace: 'nowrap', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 3,
      }}>
        <span style={{ fontSize: 13 }}>&#x26A0;&#xFE0F;</span>類似品:
      </span>
      <div ref={outerRef} style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
        <div className={overflow ? 'marquee-scroll' : ''} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <div ref={innerRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {content}
          </div>
          {overflow && (
            <div aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 40 }}>
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== 数値フォーマット ===== */
function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Math.ceil(v * 100) / 100);
}

/* ===== 品名省略 ===== */
function shortenName(name: string): string {
  return name.replace(/ポリカバー/g, '').replace(/^[\s\-]+|[\s\-]+$/g, '') || name;
}

/* ===== スワイプ行（左→右にスワイプで完了） ===== */
function SwipeRow({ children, onSwipe, style, className }: {
  children: React.ReactNode; onSwipe: () => void;
  style?: React.CSSProperties; className?: string;
}) {
  const startX = useRef(0);
  const dx = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const onTS = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX; dx.current = 0;
  }, []);
  const onTM = useCallback((e: React.TouchEvent) => {
    dx.current = e.touches[0].clientX - startX.current;
    if (rowRef.current && dx.current > 0) {
      rowRef.current.style.transform = `translateX(${Math.min(dx.current, 120)}px)`;
      rowRef.current.style.transition = 'none';
    }
  }, []);
  const onTE = useCallback(() => {
    if (rowRef.current) {
      rowRef.current.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      if (dx.current > 80) {
        rowRef.current.style.transform = 'translateX(100%)';
        rowRef.current.style.opacity = '0';
        setTimeout(() => onSwipe(), 260);
      } else { rowRef.current.style.transform = 'translateX(0)'; }
    }
  }, [onSwipe]);

  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%',
        background: 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)',
        display: 'flex', alignItems: 'center', paddingLeft: 16,
        color: '#fff', fontSize: 12, fontWeight: 700, gap: 4,
      }}>✓ 完了</div>
      <div ref={rowRef} className={className} style={{ ...style, position: 'relative', zIndex: 1 }}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
      >{children}</div>
    </div>
  );
}

/* ===== スワイプ行（右→左にスワイプで元に戻す） ===== */
function UndoSwipeRow({ children, onSwipe, style, className, onClick }: {
  children: React.ReactNode; onSwipe: () => void; onClick?: () => void;
  style?: React.CSSProperties; className?: string;
}) {
  const startX = useRef(0);
  const dx = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const onTS = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX; dx.current = 0;
  }, []);
  const onTM = useCallback((e: React.TouchEvent) => {
    dx.current = e.touches[0].clientX - startX.current;
    if (rowRef.current && dx.current < 0) {
      rowRef.current.style.transform = `translateX(${Math.max(dx.current, -120)}px)`;
      rowRef.current.style.transition = 'none';
    }
  }, []);
  const onTE = useCallback(() => {
    if (rowRef.current) {
      rowRef.current.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      if (dx.current < -80) {
        rowRef.current.style.transform = 'translateX(-100%)';
        rowRef.current.style.opacity = '0';
        setTimeout(() => onSwipe(), 260);
      } else { rowRef.current.style.transform = 'translateX(0)'; }
    }
  }, [onSwipe]);

  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '100%',
        background: 'linear-gradient(270deg, #dc2626 0%, #ef4444 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16,
        color: '#fff', fontSize: 12, fontWeight: 700, gap: 4,
      }}>↩ 元に戻す</div>
      <div ref={rowRef} className={className} style={{ ...style, position: 'relative', zIndex: 1 }}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onClick={onClick}
      >{children}</div>
    </div>
  );
}

export default function ItemDetailPanel({
  item, relatedItems, allItems, completedIds, onSelectItem, onCompleteItem, onUncompleteItem, onDecrementPallet,
}: ItemDetailPanelProps) {
  const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
  // 鍋は機種別カラーを使用（上半分の背景・アクセント色を差し替え）
  const nabeColor = getNabeModelColor(item.itemName, item.type);
  const accentColor = nabeColor || colors.accent;
  const [palletFlash, setPalletFlash] = useState(false);
  const doubleTapRef = useRef<number | null>(null);

  const handlePalletDoubleTap = useCallback(() => {
    const now = Date.now();
    if (doubleTapRef.current && now - doubleTapRef.current < 300) {
      // Double-tap detected
      doubleTapRef.current = null;
      if (onDecrementPallet) {
        onDecrementPallet();
        setPalletFlash(true);
        setTimeout(() => setPalletFlash(false), 200);
      }
    } else {
      doubleTapRef.current = now;
    }
  }, [onDecrementPallet]);
  const itemColor = extractColor(item.itemName);
  const similarItems = allItems.filter(
    (o) => o.id !== item.id && areSimilarItems(item.itemName, o.itemName)
  );
  const relatedText = relatedItems.map((r) => r.itemName).join('  /  ');

  const activeItems = allItems.filter((it) => !completedIds.has(it.id));
  const doneItems = allItems.filter((it) => completedIds.has(it.id));
  const sortedItems = [...activeItems, ...doneItems];

  const displayItemName = item.itemName.replace(/ポリカバー/g, '').replace(/^[\s\-]+|[\s\-]+$/g, '') || item.itemName;

  // コンテナ内全アイテムの最大寸法を計算（箱イメージのスケーリング基準）
  const maxContainerDim = (() => {
    let maxD = 0;
    for (const it of allItems) {
      if (it.measurements) {
        const d = parseMeas(it.measurements);
        if (d) maxD = Math.max(maxD, d[0], d[1], d[2]);
      }
    }
    return maxD || 50;
  })();

  // 現在のアイテムの寸法
  const currentDims = item.measurements ? parseMeas(item.measurements) : null;

  const typeCounts = new Map<string, number>();
  for (const it of allItems) {
    typeCounts.set(it.type, (typeCounts.get(it.type) || 0) + 1);
  }

  // リスト行の背景色（メニューカラーと統一・ダーク系）
  const TYPE_ROW_BG: Record<string, string> = {
    'ポリカバー': '#162218', 'ジャーポット': '#1e1520', '箱': '#151e2c', '部品': '#1c1628', '鍋': '#1e1518', 'ヤーマン部品': '#1c1a14', 'その他': '#1a1a1e',
  };

  // CSS変数でaccent色を渡す（鍋は機種カラー）
  const heroVars = {
    '--hero-c1': accentColor + '30',
    '--hero-c2': accentColor + '18',
    '--hero-c3': accentColor + '10',
    '--hero-c4': accentColor + '22',
  } as React.CSSProperties;

  return (
    <div className="detail-root" style={{ background: '#1a1d2e' }}>
      {/* === 上半分（アニメーショングラデーション） === */}
      <div className="detail-upper hero-animated" style={{
        position: 'relative', overflow: 'hidden', ...heroVars,
      }}>
        {/* アニメーション背景レイヤー */}
        <div className="hero-glow-layer" style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 80%, var(--hero-c1) 0%, transparent 60%),
            radial-gradient(ellipse 70% 80% at 80% 20%, var(--hero-c2) 0%, transparent 55%),
            radial-gradient(ellipse 50% 50% at 50% 50%, var(--hero-c3) 0%, transparent 50%),
            radial-gradient(ellipse 60% 70% at 70% 70%, var(--hero-c4) 0%, transparent 60%)
          `,
        }} />

        {/* 1行目: 種目バッジ + 色柄 + 品目数 */}
        <div className="detail-badges">
          <span className="type-badge" style={{
            backgroundColor: `${accentColor}40`, color: '#fff',
            border: `1.5px solid ${accentColor}70`, fontWeight: 700, fontSize: 12,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: accentColor, display: 'inline-block' }} />
            {item.type}
          </span>
          {itemColor && (
            <span className="type-badge" style={{
              backgroundColor: itemColor === '黒' ? 'rgba(30,30,30,0.8)' : itemColor === '白' ? 'rgba(240,240,240,0.9)' : 'rgba(200,160,50,0.4)',
              color: itemColor === '黒' ? '#fff' : itemColor === '白' ? '#222' : '#ffe066',
              border: `1.5px solid ${itemColor === '黒' ? '#666' : itemColor === '白' ? '#ddd' : '#daa520'}`,
              fontWeight: 700, fontSize: 12,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                backgroundColor: itemColor === '黒' ? '#222' : itemColor === '白' ? '#fff' : '#daa520',
                border: `1.5px solid ${itemColor === '黒' ? '#888' : itemColor === '白' ? '#bbb' : '#b8860b'}`,
              }} />
              {itemColor}
            </span>
          )}
          <span style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', fontWeight: 600,
          }}>
            {Array.from(typeCounts.entries()).map(([type, count]) => {
              const tc = COLOR_MAP[type as keyof typeof COLOR_MAP] || COLOR_MAP['その他'];
              return (
                <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: tc.accent, display: 'inline-block' }} />
                  <span style={{ color: '#fff' }}>{count}</span>
                </span>
              );
            })}
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>/ {allItems.length}品</span>
          </span>
        </div>

        {/* 品名 */}
        <div style={{ position: 'relative', zIndex: 3 }}>
          <MarqueeText text={displayItemName} className="detail-item-name"
            style={{
              color: nabeColor || '#f0f0f0',
              textShadow: `0 0 24px ${accentColor}60, 0 0 48px ${accentColor}25, 0 2px 6px rgba(0,0,0,0.8)`,
            }} />
          {/* 品名の下に気高コード（KTE青）+ 新建高コード（KEN赤）縦並び */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
            {item.partNumber && (
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)',
                letterSpacing: 0.5,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', letterSpacing: 1, marginRight: 4 }}>KTE</span>
                {item.partNumber}
              </span>
            )}
            {item.newPartNumber && (
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)',
                letterSpacing: 0.5,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: 1, marginRight: 4 }}>KEN</span>
                {item.newPartNumber}
              </span>
            )}
          </div>
        </div>

        {/* 箱イメージ + パレット図（KENコード下〜PL数上の固定エリア） */}
        <div className="detail-pallet-area" style={{
          position: 'relative', zIndex: 0, flex: '1 1 0', minHeight: 0,
          display: 'flex', flexDirection: 'row',
        }}>
          {/* 左側: 箱3Dイメージ + 寸法テキスト */}
          <div style={{
            position: 'relative', width: '35%', height: '100%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'visible',
          }}>
            {(item.measurements || item.cbm || item.type === '鍋') && (
              <SizeDiagram measurements={item.measurements} cbm={item.cbm}
                type={item.type} maxContainerDim={maxContainerDim} itemName={item.itemName} />
            )}
            {/* 寸法テキスト — 左下オーバーレイ */}
            {currentDims && (
              <div style={{
                position: 'absolute', bottom: 0, left: 4, zIndex: 2,
                fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13,
                color: accentColor,
                textShadow: `0 0 8px rgba(0,0,0,0.9), 0 1px 6px rgba(0,0,0,0.7), 0 0 20px ${accentColor}40`,
                letterSpacing: '-0.5px',
              }}>
                {currentDims[0]}×{currentDims[1]}×{currentDims[2]}
              </div>
            )}
          </div>

          {/* 右側: パレット図（積み方 + 端数を横並び — 同じSVGコンポーネント） */}
          <div style={{
            flex: 1, height: '100%', display: 'flex', flexDirection: 'row',
            alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            {item.palletCount > 0 && item.qtyPerPallet > 0 && (
              <div style={{ flex: 1, height: '100%', minWidth: 0 }}>
                <PalletDiagram palletCount={item.palletCount} fraction={0}
                  qtyPerPallet={item.qtyPerPallet} type={item.type} itemName={item.itemName}
                  measurements={item.measurements} />
              </div>
            )}
            {item.fraction > 0 && (
              <div style={{ flex: 1, height: '100%', minWidth: 0 }}>
                <PalletDiagram palletCount={0} fraction={item.fraction}
                  qtyPerPallet={item.qtyPerPallet} type={item.type} itemName={item.itemName}
                  measurements={item.measurements} />
              </div>
            )}
          </div>
        </div>

        {/* 数量（PL / CT / pcs） */}
        <div className="detail-stats-free" style={{ position: 'relative', zIndex: 2, justifyContent: 'center' }}>
          <div className="detail-sf-item" style={{ minWidth: 0 }}>
            <span className="detail-sf-num" onClick={handlePalletDoubleTap} style={{
              color: accentColor,
              textShadow: `0 0 16px ${accentColor}50, 0 2px 4px rgba(0,0,0,0.6)`,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              background: palletFlash ? 'rgba(255,255,255,0.25)' : 'transparent',
              borderRadius: 8,
              userSelect: 'none',
              display: 'inline-block', minWidth: '2.2ch', textAlign: 'right',
            }}>{fmtNum(item.palletCount)}</span>
            <span className="detail-sf-label" style={{ color: 'rgba(255,255,255,0.5)' }}>PL</span>
          </div>
          <div className="detail-sf-item" style={{ minWidth: 0 }}>
            <span className="detail-sf-num" style={{
              color: '#e8e8e8',
              textShadow: `0 0 16px ${accentColor}30, 0 2px 4px rgba(0,0,0,0.6)`,
              display: 'inline-block', minWidth: '2.2ch', textAlign: 'right',
            }}>{item.fraction % 1 !== 0 ? Math.ceil(item.fraction) : fmtNum(item.fraction)}</span>
            <span className="detail-sf-label" style={{ color: 'rgba(255,255,255,0.5)' }}>CT</span>
          </div>
          <div className="detail-sf-item detail-sf-total" style={{ minWidth: 0 }}>
            <span className="detail-sf-num-sm" style={{
              color: 'rgba(255,255,255,0.6)',
              display: 'inline-block', minWidth: '4ch', textAlign: 'right',
            }}>
              {Math.ceil(item.totalQty).toLocaleString()}
            </span>
            <span className="detail-sf-label" style={{ color: 'rgba(255,255,255,0.4)' }}>pcs</span>
          </div>
        </div>

        {/* 類似品 or 関連（1行固定エリア — 類似品優先、なければ関連を表示） */}
        <div style={{ flexShrink: 0, minHeight: 28 }}>
          {similarItems.length > 0 ? (
            <SimilarItemsMarquee item={item} similarItems={similarItems} />
          ) : relatedItems.length > 0 ? (
            <div className="detail-related" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
              <span className="detail-related-label" style={{ color: '#fff', fontWeight: 600 }}>関連:</span>
              <MarqueeText text={relatedText} className="detail-related-text" style={{ color: '#fff' }} />
            </div>
          ) : null}
        </div>
      </div>

      {/* === 下半分リスト === */}
      <div className="detail-list-section" style={{ background: '#1a1d2e' }}>
        <div className="detail-list-header" style={{ background: '#1e2130' }}>
          <span className="detail-list-h-name" style={{ color: 'rgba(255,255,255,0.6)' }}>品名</span>
          <span className="detail-list-h-num" style={{ color: 'rgba(255,255,255,0.6)' }}>PL</span>
          <span className="detail-list-h-num" style={{ color: 'rgba(255,255,255,0.6)' }}>CS</span>
          <span className="detail-list-h-num detail-list-h-total" style={{ color: 'rgba(255,255,255,0.6)' }}>PCS</span>
        </div>
        <div className="detail-list-scroll">
          {sortedItems.map((it) => {
            const c = COLOR_MAP[it.type] || COLOR_MAP['その他'];
            const isActive = it.id === item.id;
            const isDone = completedIds.has(it.id);
            const displayName = shortenName(it.itemName);
            const origIdx = allItems.findIndex((a) => a.id === it.id);
            // 鍋は機種別カラーを使用
            const itNabeColor = getNabeModelColor(it.itemName, it.type);
            const itAccent = itNabeColor || c.accent;
            const typeBg = itNabeColor ? nabeColorToDarkBg(itNabeColor) : (TYPE_ROW_BG[it.type] || TYPE_ROW_BG['その他']);
            const rowBg = isDone ? '#1e1e22' : isActive ? '#2a1f10' : typeBg;

            const content = (
              <>
                <span className="detail-list-dot" style={{ backgroundColor: isDone ? '#555' : itAccent }} />
                <MarqueeText text={displayName}
                  className="detail-list-name"
                  style={isDone
                    ? { color: '#666', textDecoration: 'line-through' }
                    : isActive ? { fontWeight: 700, color: '#ff9800' } : { color: itNabeColor || 'rgba(255,255,255,0.85)' }
                  } />
                <span className="detail-list-num" style={{ color: isDone ? '#555' : isActive ? '#ff9800' : itAccent, fontWeight: 600 }}>{fmtNum(it.palletCount)}</span>
                <span className="detail-list-num" style={{ color: isDone ? '#555' : isActive ? '#ff9800' : 'rgba(255,255,255,0.7)' }}>{fmtNum(it.fraction)}</span>
                <span className="detail-list-num detail-list-total" style={{ color: isDone ? '#555' : 'rgba(255,255,255,0.55)' }}>
                  {Math.ceil(it.totalQty).toLocaleString()}
                </span>
              </>
            );

            if (isDone) {
              return (
                <UndoSwipeRow key={it.id}
                  onSwipe={() => onUncompleteItem?.(it.id)}
                  onClick={() => onUncompleteItem?.(it.id)}
                  className="detail-list-row"
                  style={{ background: rowBg, borderLeftColor: '#444', borderLeftWidth: 3 }}
                >{content}</UndoSwipeRow>
              );
            }

            return (
              <SwipeRow key={it.id}
                onSwipe={() => onCompleteItem?.(it.id)}
                className={`detail-list-row ${isActive ? 'active' : ''}`}
                style={{
                  background: rowBg,
                  borderLeftColor: isActive ? '#ff6d00' : itAccent,
                  borderLeftWidth: isActive ? 4 : 3,
                }}
              >
                <div style={{ display: 'contents' }} onClick={() => onSelectItem?.(origIdx)}>
                  {content}
                </div>
              </SwipeRow>
            );
          })}
        </div>
      </div>
    </div>
  );
}
