'use client';

import { useRef, useEffect, useState } from 'react';
import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { extractColor, areSimilarItems } from '@/lib/typeDetector';
import PalletDiagram from './PalletDiagram';

interface ItemDetailPanelProps {
  item: ContainerItem;
  relatedItems: ContainerItem[];
  allItems: ContainerItem[];
}

/* ===== マーキーテキスト（はみ出したらスムーズスクロール） ===== */
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
  return name
    .replace(/ポリカバー/g, '')
    .replace(/^[\s\-]+|[\s\-]+$/g, '')
    || name;
}

export default function ItemDetailPanel({
  item, relatedItems, allItems,
}: ItemDetailPanelProps) {
  const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
  const itemColor = extractColor(item.itemName);
  const similarItems = allItems.filter(
    (o) => o.id !== item.id && areSimilarItems(item.itemName, o.itemName)
  );
  const relatedText = relatedItems.map((r) => r.itemName).join('  /  ');

  return (
    <div className="detail-root" style={{ background: colors.gradient }}>
      {/* 背景グロー */}
      <div className="type-glow" style={{ background: `radial-gradient(ellipse at 30% 20%, ${colors.glow} 0%, transparent 70%)` }} />

      {/* === 上半分: 品目詳細 === */}
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

        {/* 品名 (中央、長い場合マーキー) */}
        <MarqueeText
          text={item.itemName}
          className="detail-item-name"
          style={{ color: colors.text }}
        />

        {/* パレット図 */}
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

        {/* 数量情報 1行: パレット | 端数 | 総数 */}
        <div className="detail-stats-row">
          <div className="detail-stat">
            <span className="detail-stat-val" style={{ color: colors.accent }}>
              {item.palletCount}
            </span>
            <span className="detail-stat-unit">パレット</span>
            {item.qtyPerPallet > 0 && (
              <span className="detail-stat-sub">@{item.qtyPerPallet}ケース</span>
            )}
          </div>
          <div className="detail-stat-sep" />
          <div className="detail-stat">
            <span className="detail-stat-val" style={{ color: colors.text }}>
              {item.fraction}
            </span>
            <span className="detail-stat-unit">端数</span>
          </div>
          <div className="detail-stat-sep" />
          <div className="detail-stat detail-stat-total">
            <span className="detail-stat-val-sm" style={{ color: colors.text }}>
              {item.totalQty.toLocaleString()}
            </span>
            <span className="detail-stat-unit">総数</span>
          </div>
        </div>

        {/* 似た品目の警告 */}
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

        {/* 関連品名 (1行、マーキー) */}
        {relatedItems.length > 0 && (
          <div className="detail-related">
            <span className="detail-related-label">関連:</span>
            <MarqueeText text={relatedText} className="detail-related-text" style={{ color: colors.text }} />
          </div>
        )}
      </div>

      {/* === 下半分: コンテナ全体リスト === */}
      <div className="detail-list-section">
        <div className="detail-list-header">
          <span className="detail-list-h-name">品名</span>
          <span className="detail-list-h-num">PL</span>
          <span className="detail-list-h-num">端</span>
          <span className="detail-list-h-num">総数</span>
        </div>
        <div className="detail-list-scroll">
          {allItems.map((it) => {
            const c = COLOR_MAP[it.type] || COLOR_MAP['その他'];
            const isActive = it.id === item.id;
            const displayName = shortenName(it.itemName);
            return (
              <div key={it.id}
                className={`detail-list-row ${isActive ? 'active' : ''}`}
                style={isActive ? { background: `${c.accent}10`, borderLeftColor: c.accent } : undefined}
              >
                <span className="detail-list-dot" style={{ backgroundColor: c.accent }} />
                <span className="detail-list-name" style={isActive ? { fontWeight: 600, color: c.text } : undefined}>
                  {displayName}
                </span>
                <span className="detail-list-num">{it.palletCount}</span>
                <span className="detail-list-num">{it.fraction}</span>
                <span className="detail-list-num detail-list-total">{it.totalQty.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
