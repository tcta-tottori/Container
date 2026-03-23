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
      className="flex flex-col h-full p-3 overflow-y-auto"
      style={{ backgroundColor: colors.bg }}
    >
      {/* 種類バッジ + 品名 */}
      <div className="mb-2">
        <span
          className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-1"
          style={{ backgroundColor: colors.accent, color: '#fff' }}
        >
          {item.type}
        </span>
        <div
          className="text-lg font-bold leading-tight px-2 py-1 rounded"
          style={{ color: colors.text }}
        >
          {item.itemName}
        </div>
      </div>

      {/* 数量情報 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2" style={{ color: colors.text }}>
        <div>
          <span className="text-xs opacity-70">パレット</span>
          <div className="text-2xl font-bold">{item.palletCount} 枚</div>
        </div>
        <div>
          <span className="text-xs opacity-70">端数</span>
          <div className="text-lg">{item.fraction} ケース</div>
        </div>
        <div>
          <span className="text-xs opacity-70">総数</span>
          <div className="text-xl font-bold">{item.totalQty.toLocaleString()}</div>
        </div>
        <div>
          <span className="text-xs opacity-70">入数</span>
          <div className="text-sm">{item.packingQty} 個/ケース</div>
        </div>
      </div>

      {/* 1パレットあたり */}
      {item.qtyPerPallet > 0 && (
        <div className="text-xs mb-2" style={{ color: colors.text, opacity: 0.7 }}>
          1パレット: {item.qtyPerPallet} ケース
        </div>
      )}

      {/* パレット段積み図 */}
      {item.qtyPerPallet > 0 && (
        <PalletDiagram
          palletCount={item.palletCount}
          fraction={item.fraction}
          qtyPerPallet={item.qtyPerPallet}
          type={item.type}
        />
      )}

      {/* 関連品名 */}
      {relatedItems.length > 0 && (
        <div className="mt-auto pt-2 border-t" style={{ borderColor: colors.accent + '40' }}>
          <span className="text-xs opacity-60" style={{ color: colors.text }}>
            関連:
          </span>
          <span className="text-xs ml-1" style={{ color: colors.text }}>
            {relatedItems.map((r) => r.itemName).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}
