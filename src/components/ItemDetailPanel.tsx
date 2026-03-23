'use client';

import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import PalletDiagram from './PalletDiagram';

interface ItemDetailPanelProps {
  item: ContainerItem;
  relatedItems: ContainerItem[];
}

export default function ItemDetailPanel({
  item,
  relatedItems,
}: ItemDetailPanelProps) {
  const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];

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

      {/* 種類バッジ + 品名 */}
      <div className="mb-3 relative z-10">
        <span
          className="type-badge mb-2"
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
        <div
          className="text-xl font-bold leading-tight mt-2"
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

      {/* 数量情報カード */}
      <div className="grid grid-cols-4 gap-2 mb-3 relative z-10 stat-grid-portrait">
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
        <div className="stat-card">
          <div className="stat-label" style={{ color: colors.text }}>入数</div>
          <div className="stat-value text-sm" style={{ color: colors.text, opacity: 0.8 }}>
            {item.packingQty}
            <span className="text-xs font-normal ml-1" style={{ opacity: 0.5 }}>個/ケース</span>
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

      {/* パレット段積み図（3D） */}
      {item.qtyPerPallet > 0 && (
        <div className="relative z-10 flex-1 min-h-0">
          <PalletDiagram
            palletCount={item.palletCount}
            fraction={item.fraction}
            qtyPerPallet={item.qtyPerPallet}
            type={item.type}
          />
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
