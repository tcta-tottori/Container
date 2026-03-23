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
}

/* ===== マーキーテキスト ===== */
function MarqueeText({
  text, className, style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
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

/* ===== 品名から種類語を省略 ===== */
function shortenName(name: string): string {
  return name.replace(/ポリカバー/g, '').replace(/^[\s\-]+|[\s\-]+$/g, '') || name;
}

/* ===== スワイプ行 ===== */
function SwipeRow({
  children, onSwipeLeft, style, className,
}: {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  const startX = useRef(0);
  const deltaX = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    deltaX.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    deltaX.current = e.touches[0].clientX - startX.current;
    if (rowRef.current && deltaX.current < 0) {
      rowRef.current.style.transform = `translateX(${Math.max(deltaX.current, -100)}px)`;
      rowRef.current.style.transition = 'none';
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (rowRef.current) {
      rowRef.current.style.transition = 'transform 0.25s ease';
      if (deltaX.current < -80) {
        rowRef.current.style.transform = 'translateX(-100%)';
        rowRef.current.style.opacity = '0';
        setTimeout(() => onSwipeLeft(), 250);
      } else {
        rowRef.current.style.transform = 'translateX(0)';
      }
    }
  }, [onSwipeLeft]);

  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      {/* 背景にCOMPLETEラベル */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#16a34a', color: '#fff', fontSize: '11px', fontWeight: 700,
      }}>
        完了
      </div>
      <div ref={rowRef} className={className} style={style}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

export default function ItemDetailPanel({
  item, relatedItems, allItems, completedIds, onSelectItem, onCompleteItem,
}: ItemDetailPanelProps) {
  const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
  const itemColor = extractColor(item.itemName);
  const similarItems = allItems.filter(
    (o) => o.id !== item.id && areSimilarItems(item.itemName, o.itemName)
  );
  const relatedText = relatedItems.map((r) => r.itemName).join('  /  ');

  // リストをアクティブ→完了の順にソート
  const activeItems = allItems.filter((it) => !completedIds.has(it.id));
  const completedItems = allItems.filter((it) => completedIds.has(it.id));
  const sortedItems = [...activeItems, ...completedItems];

  return (
    <div className="detail-root" style={{ background: colors.gradient }}>
      <div className="type-glow" style={{ background: `radial-gradient(ellipse at 30% 20%, ${colors.glow} 0%, transparent 70%)` }} />

      {/* === 上半分 === */}
      <div className="detail-upper">
        {/* バッジ行 */}
        <div className="detail-badges">
          <span className="type-badge" style={{
            backgroundColor: `${colors.accent}20`, color: colors.accent,
            border: `1px solid ${colors.accent}40`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.accent, display: 'inline-block' }} />
            {item.type}
          </span>
          {itemColor && (
            <span className="type-badge" style={{
              backgroundColor: itemColor === '黒' ? 'rgba(50,50,50,0.7)' : itemColor === '白' ? 'rgba(200,200,200,0.3)' : 'rgba(150,100,50,0.2)',
              color: itemColor === '黒' ? '#888' : itemColor === '白' ? '#666' : '#8b6914',
              border: `1px solid ${itemColor === '黒' ? '#666' : itemColor === '白' ? '#bbb' : '#8b6914'}`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                backgroundColor: itemColor === '黒' ? '#333' : itemColor === '白' ? '#eee' : '#c49a3c',
                border: itemColor === '白' ? '1px solid #ccc' : 'none',
              }} />
              {itemColor}
            </span>
          )}
          {item.partNumber && (
            <span className="detail-part-no">{item.partNumber}</span>
          )}
        </div>

        {/* 品名 */}
        <MarqueeText text={item.itemName} className="detail-item-name" style={{ color: colors.text }} />

        {/* パレット図（品名直下、コンパクト） */}
        {item.qtyPerPallet > 0 && (
          <div className="detail-pallet-area">
            <PalletDiagram
              palletCount={item.palletCount}
              fraction={item.fraction}
              qtyPerPallet={item.qtyPerPallet}
              type={item.type}
            />
          </div>
        )}

        {/* 数量（枠なし大フォント） */}
        <div className="detail-stats-free">
          <div className="detail-sf-item">
            <span className="detail-sf-num" style={{ color: colors.accent }}>{item.palletCount}</span>
            <span className="detail-sf-label">パレット</span>
            {item.qtyPerPallet > 0 && (
              <span className="detail-sf-sub">@{item.qtyPerPallet}</span>
            )}
          </div>
          <div className="detail-sf-item">
            <span className="detail-sf-num" style={{ color: colors.text }}>{item.fraction}</span>
            <span className="detail-sf-label">端数</span>
          </div>
          <div className="detail-sf-item detail-sf-total">
            <span className="detail-sf-num-sm" style={{ color: colors.text, opacity: 0.5 }}>
              {item.totalQty.toLocaleString()}
            </span>
            <span className="detail-sf-label">総数</span>
          </div>
        </div>

        {/* 似た品目 */}
        {similarItems.length > 0 && (
          <div className="detail-similar-warn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="detail-similar-label">似た品目:</span>
            <span className="detail-similar-names">
              {similarItems.map((s) => {
                const c = extractColor(s.itemName);
                return c ? `${s.itemName}(${c})` : s.itemName;
              }).join(' / ')}
            </span>
          </div>
        )}

        {/* 関連品名 */}
        {relatedItems.length > 0 && (
          <div className="detail-related">
            <span className="detail-related-label">関連:</span>
            <MarqueeText text={relatedText} className="detail-related-text" style={{ color: colors.text }} />
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
            const isCompleted = completedIds.has(it.id);
            const displayName = shortenName(it.itemName);
            const originalIdx = allItems.findIndex((a) => a.id === it.id);
            const rowBg = isCompleted
              ? 'rgba(0,0,0,0.03)'
              : isActive ? `${c.accent}18` : `${c.accent}08`;

            const rowContent = (
              <>
                <span className="detail-list-dot" style={{
                  backgroundColor: isCompleted ? '#ccc' : c.accent,
                }} />
                <MarqueeText
                  text={displayName}
                  className={`detail-list-name ${isCompleted ? 'completed' : ''}`}
                  style={isCompleted
                    ? { color: '#bbb', fontWeight: 400, textDecoration: 'line-through' }
                    : isActive
                      ? { fontWeight: 700, color: c.text }
                      : { color: 'var(--text-primary)' }
                  }
                />
                <span className="detail-list-num" style={{
                  color: isCompleted ? '#ccc' : c.text,
                }}>{it.palletCount}</span>
                <span className="detail-list-num" style={{
                  color: isCompleted ? '#ccc' : c.text,
                }}>{it.fraction}</span>
                <span className="detail-list-num detail-list-total" style={
                  isCompleted ? { color: '#ccc' } : undefined
                }>{it.totalQty.toLocaleString()}</span>
              </>
            );

            if (isCompleted) {
              return (
                <div key={it.id}
                  className="detail-list-row"
                  style={{ background: rowBg, borderLeftColor: '#ddd', opacity: 0.6 }}
                  onClick={() => onSelectItem?.(originalIdx)}
                >
                  {rowContent}
                </div>
              );
            }

            return (
              <SwipeRow key={it.id}
                onSwipeLeft={() => onCompleteItem?.(it.id)}
                className={`detail-list-row ${isActive ? 'active' : ''}`}
                style={{ background: rowBg, borderLeftColor: isActive ? c.accent : `${c.accent}40` }}
              >
                <div style={{ display: 'contents' }} onClick={() => onSelectItem?.(originalIdx)}>
                  {rowContent}
                </div>
              </SwipeRow>
            );
          })}
        </div>
      </div>
    </div>
  );
}
