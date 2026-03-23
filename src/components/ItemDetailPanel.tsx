'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { extractColor, areSimilarItems } from '@/lib/typeDetector';
import PalletDiagram from './PalletDiagram';

interface ItemDetailPanelProps {
  item: ContainerItem;
  relatedItems: ContainerItem[];
  allItems: ContainerItem[];
  completedIds: Set<string>;
  onSelectItem?: (idx: number) => void;
  onCompleteItem?: (id: string) => void;
  onUncompleteItem?: (id: string) => void;
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

/* ===== 数値フォーマット（小数点2桁切り上げ） ===== */
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
    startX.current = e.touches[0].clientX;
    dx.current = 0;
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
      } else {
        rowRef.current.style.transform = 'translateX(0)';
      }
    }
  }, [onSwipe]);

  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      {/* 背景にCOMPLETEラベル */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#16a34a', color: '#fff', fontSize: '10px', fontWeight: 700,
        borderRadius: '0 4px 4px 0',
      }}>完了</div>
      <div ref={rowRef} className={className} style={{ ...style, position: 'relative', zIndex: 1 }}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
      >{children}</div>
    </div>
  );
}

export default function ItemDetailPanel({
  item, relatedItems, allItems, completedIds, onSelectItem, onCompleteItem, onUncompleteItem,
}: ItemDetailPanelProps) {
  const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
  const itemColor = extractColor(item.itemName);
  const similarItems = allItems.filter(
    (o) => o.id !== item.id && areSimilarItems(item.itemName, o.itemName)
  );
  const relatedText = relatedItems.map((r) => r.itemName).join('  /  ');

  const activeItems = allItems.filter((it) => !completedIds.has(it.id));
  const doneItems = allItems.filter((it) => completedIds.has(it.id));
  const sortedItems = [...activeItems, ...doneItems];

  // 品名からポリカバーを省く
  const displayItemName = item.itemName.replace(/ポリカバー/g, '').replace(/^[\s\-]+|[\s\-]+$/g, '') || item.itemName;

  // 種類別カウント
  const typeCounts = new Map<string, number>();
  for (const it of allItems) {
    typeCounts.set(it.type, (typeCounts.get(it.type) || 0) + 1);
  }

  // 種目に合わせたダーク背景（accent色を強調）
  const heroBg = `linear-gradient(160deg, ${colors.accent}15 0%, #12142a 25%, ${colors.accent}12 50%, #0d1b3a 75%, ${colors.accent}18 100%)`;

  return (
    <div className="detail-root">
      {/* === 上半分（accent色強調ダーク背景・角丸・固定高さ） === */}
      <div className="detail-upper" style={{
        background: heroBg,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* accent色のグロー効果（強め） */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%', width: '60%', height: '140%',
          background: `radial-gradient(ellipse, ${colors.accent}35 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-5%', width: '40%', height: '60%',
          background: `radial-gradient(ellipse, ${colors.accent}20 0%, transparent 55%)`,
          pointerEvents: 'none',
        }} />

        {/* バッジ行: 種目 + 色柄 + 品目数 */}
        <div className="detail-badges" style={{ marginBottom: 2 }}>
          <span className="type-badge" style={{
            backgroundColor: `${colors.accent}40`, color: '#fff',
            border: `1.5px solid ${colors.accent}70`, fontWeight: 700, fontSize: 12,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: colors.accent, display: 'inline-block' }} />
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
          {/* 品目カウント */}
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

        {/* 品番 */}
        {item.partNumber && (
          <div style={{ textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', fontWeight: 500, marginBottom: 2, letterSpacing: 0.8 }}>
            {item.partNumber}
          </div>
        )}

        {/* 品名（大きく・縁取り付き） */}
        <MarqueeText text={displayItemName} className="detail-item-name"
          style={{
            color: '#fff',
            textShadow: `0 0 20px ${colors.accent}aa, 0 0 40px ${colors.accent}40, 0 2px 8px rgba(0,0,0,0.7)`,
            WebkitTextStroke: '0.8px rgba(255,255,255,0.2)',
          }} />

        {/* パレット図（ない場合もスペース確保） */}
        <div className="detail-pallet-area">
          {item.qtyPerPallet > 0 ? (
            <PalletDiagram palletCount={item.palletCount} fraction={item.fraction}
              qtyPerPallet={item.qtyPerPallet} type={item.type} itemName={item.itemName} />
          ) : (
            <div style={{ minHeight: 60 }} />
          )}
        </div>

        {/* 数量（縁取り付き大フォント） */}
        <div className="detail-stats-free">
          <div className="detail-sf-item">
            <span className="detail-sf-num" style={{
              color: colors.accent,
              textShadow: `0 0 12px ${colors.accent}60, 0 2px 4px rgba(0,0,0,0.5)`,
            }}>{fmtNum(item.palletCount)}</span>
            <div className="detail-sf-labels">
              <span className="detail-sf-label" style={{ color: 'rgba(255,255,255,0.7)' }}>パレット</span>
              {item.qtyPerPallet > 0 && <span className="detail-sf-sub" style={{ color: 'rgba(255,255,255,0.4)' }}>@{item.qtyPerPallet}</span>}
            </div>
          </div>
          <div className="detail-sf-item">
            <span className="detail-sf-num" style={{
              color: '#fff',
              textShadow: '0 0 12px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.5)',
            }}>{fmtNum(item.fraction)}</span>
            <span className="detail-sf-label" style={{ color: 'rgba(255,255,255,0.7)' }}>端数</span>
          </div>
          <div className="detail-sf-item detail-sf-total">
            <span className="detail-sf-num-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {Math.ceil(item.totalQty).toLocaleString()}
            </span>
            <span className="detail-sf-label" style={{ color: 'rgba(255,255,255,0.4)' }}>総数</span>
          </div>
        </div>

        {/* 似た品目 */}
        {similarItems.length > 0 && (
          <div className="detail-similar-warn" style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="detail-similar-label" style={{ color: '#fbbf24' }}>似た品目:</span>
            <span className="detail-similar-names" style={{ color: '#fde68a' }}>
              {similarItems.map((s) => {
                const c2 = extractColor(s.itemName);
                return c2 ? `${s.itemName}(${c2})` : s.itemName;
              }).join(' / ')}
            </span>
          </div>
        )}

        {/* 関連 */}
        {relatedItems.length > 0 && (
          <div className="detail-related" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            <span className="detail-related-label" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>関連:</span>
            <MarqueeText text={relatedText} className="detail-related-text" style={{ color: 'rgba(255,255,255,0.8)' }} />
          </div>
        )}
      </div>

      {/* === 下半分リスト === */}
      <div className="detail-list-section">
        <div className="detail-list-header">
          <span className="detail-list-h-name">品名</span>
          <span className="detail-list-h-num">PL</span>
          <span className="detail-list-h-num">端</span>
          <span className="detail-list-h-num detail-list-h-total">総数</span>
        </div>
        <div className="detail-list-scroll">
          {sortedItems.map((it) => {
            const c = COLOR_MAP[it.type] || COLOR_MAP['その他'];
            const isActive = it.id === item.id;
            const isDone = completedIds.has(it.id);
            const displayName = shortenName(it.itemName);
            const origIdx = allItems.findIndex((a) => a.id === it.id);
            // 種類別の不透明背景色（濃い目）
            const TYPE_BG: Record<string, string> = {
              'ポリカバー': '#d4edda', '箱': '#cfe2f3', '部品': '#e8daef', 'その他': '#e8e8e8',
            };
            const typeBg = TYPE_BG[it.type] || TYPE_BG['その他'];
            const activeBg = '#fff3e0';
            const rowBg = isDone ? '#e8e8e8' : isActive ? activeBg : typeBg;

            const content = (
              <>
                <span className="detail-list-dot" style={{ backgroundColor: isDone ? '#aaa' : c.accent }} />
                <MarqueeText text={displayName}
                  className="detail-list-name"
                  style={isDone
                    ? { color: '#999', textDecoration: 'line-through' }
                    : isActive ? { fontWeight: 700, color: '#e65100' } : { color: 'var(--text-primary)' }
                  } />
                <span className="detail-list-num" style={{ color: isDone ? '#aaa' : isActive ? '#e65100' : c.text }}>{fmtNum(it.palletCount)}</span>
                <span className="detail-list-num" style={{ color: isDone ? '#aaa' : isActive ? '#e65100' : c.text }}>{fmtNum(it.fraction)}</span>
                <span className="detail-list-num detail-list-total" style={isDone ? { color: '#aaa' } : undefined}>
                  {Math.ceil(it.totalQty).toLocaleString()}
                </span>
              </>
            );

            if (isDone) {
              return (
                <div key={it.id} className="detail-list-row"
                  style={{ background: '#e8e8e8', borderLeftColor: '#bbb', opacity: 0.55 }}
                  onClick={() => onUncompleteItem?.(it.id)}
                >{content}</div>
              );
            }

            return (
              <SwipeRow key={it.id}
                onSwipe={() => onCompleteItem?.(it.id)}
                className={`detail-list-row ${isActive ? 'active' : ''}`}
                style={{
                  background: rowBg,
                  borderLeftColor: isActive ? '#ff6d00' : c.accent,
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
