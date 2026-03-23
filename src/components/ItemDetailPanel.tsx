'use client';

import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { extractColor, areSimilarItems } from '@/lib/typeDetector';
import PalletDiagram from './PalletDiagram';

interface ItemDetailPanelProps {
  item: ContainerItem;
  relatedItems: ContainerItem[];
  allItems: ContainerItem[];
}

export default function ItemDetailPanel({
  item,
  relatedItems,
  allItems,
}: ItemDetailPanelProps) {
  const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
  const itemColor = extractColor(item.itemName);

  // 似た名前のアイテム（色違いや1文字違い）を検出
  const similarItems = allItems.filter(
    (other) => other.id !== item.id && areSimilarItems(item.itemName, other.itemName)
  );

  return (
    <div
      className="flex flex-col h-full p-4 overflow-y-auto relative"
      style={{ background: colors.gradient }}
    >
      {/* 背景グロー */}
      <div
        className="type-glow"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, ${colors.glow} 0%, transparent 70%)`,
        }}
      />

      {/* 上部: 品名 + パレット図 横並び */}
      <div className="flex gap-4 mb-3 relative z-10">
        {/* 左: 種類バッジ + 品名 + 色 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="type-badge"
              style={{
                backgroundColor: `${colors.accent}20`,
                color: colors.accent,
                border: `1px solid ${colors.accent}40`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: colors.accent,
                  display: 'inline-block',
                }}
              />
              {item.type}
            </span>
            {/* 色表示 */}
            {itemColor && (
              <span
                className="type-badge"
                style={{
                  backgroundColor: itemColor === '黒'
                    ? 'rgba(50,50,50,0.8)'
                    : itemColor === '白'
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(150,100,50,0.3)',
                  color: itemColor === '黒' ? '#ccc' : itemColor === '白' ? '#fff' : '#d4a574',
                  border: `1px solid ${itemColor === '黒' ? '#555' : itemColor === '白' ? 'rgba(255,255,255,0.3)' : '#8b6914'}`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: itemColor === '黒' ? '#333' : itemColor === '白' ? '#fff' : '#c49a3c',
                    display: 'inline-block',
                    border: itemColor === '白' ? '1px solid rgba(0,0,0,0.2)' : 'none',
                  }}
                />
                {itemColor}
              </span>
            )}
          </div>
          <div
            className="text-xl font-bold leading-tight"
            style={{ color: colors.text }}
          >
            {item.itemName}
          </div>
          {item.partNumber && (
            <div className="text-xs mt-1" style={{ color: colors.text, opacity: 0.4 }}>
              {item.partNumber}
            </div>
          )}
        </div>

        {/* 右: パレット段積み図 */}
        {item.qtyPerPallet > 0 && (
          <div className="shrink-0 flex items-start">
            <PalletDiagram
              palletCount={item.palletCount}
              fraction={item.fraction}
              qtyPerPallet={item.qtyPerPallet}
              type={item.type}
            />
          </div>
        )}
      </div>

      {/* 数量情報カード (3カラム、入数なし) */}
      <div className="grid grid-cols-3 gap-2 mb-3 relative z-10 stat-grid-portrait">
        <div className="stat-card">
          <div className="stat-label" style={{ color: colors.text }}>パレット</div>
          <div className="stat-value text-2xl" style={{ color: colors.accent }}>
            {item.palletCount}
            <span className="text-xs font-normal ml-1" style={{ color: colors.text, opacity: 0.5 }}>枚</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label" style={{ color: colors.text }}>端数</div>
          <div className="stat-value text-lg" style={{ color: colors.text }}>
            {item.fraction}
            <span className="text-xs font-normal ml-1" style={{ opacity: 0.5 }}>ケース</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label" style={{ color: colors.text }}>総数</div>
          <div className="stat-value text-xl" style={{ color: colors.text }}>
            {item.totalQty.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 1パレットあたり */}
      {item.qtyPerPallet > 0 && (
        <div
          className="text-xs mb-2 px-1 relative z-10"
          style={{ color: colors.text, opacity: 0.5 }}
        >
          1パレット: {item.qtyPerPallet} ケース
        </div>
      )}

      {/* 似た名前の品目（色違いや1文字違い）警告 */}
      {similarItems.length > 0 && (
        <div
          className="relative z-10 rounded-lg px-3 py-2 mb-2"
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
              似た品目あり
            </span>
          </div>
          <div className="text-xs" style={{ color: '#fbbf6e' }}>
            {similarItems.map((s) => {
              const sColor = extractColor(s.itemName);
              return sColor ? `${s.itemName} (${sColor})` : s.itemName;
            }).join(' / ')}
          </div>
        </div>
      )}

      {/* 関連品名 */}
      {relatedItems.length > 0 && (
        <div
          className="mt-auto pt-2 border-t relative z-10"
          style={{ borderColor: `${colors.accent}15` }}
        >
          <span className="text-xs" style={{ color: colors.text, opacity: 0.35 }}>
            関連:
          </span>
          <span className="text-xs ml-1" style={{ color: colors.text, opacity: 0.55 }}>
            {relatedItems.map((r) => r.itemName).join(' / ')}
          </span>
        </div>
      )}
    </div>
  );
}
