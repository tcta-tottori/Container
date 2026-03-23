'use client';

import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface ItemListPanelProps {
  items: ContainerItem[];
  currentIdx: number;
  onSelect: (idx: number) => void;
}

export default function ItemListPanel({
  items,
  currentIdx,
  onSelect,
}: ItemListPanelProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-900">
      {items.map((item, idx) => {
        const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
        const isSelected = idx === currentIdx;

        return (
          <button
            key={item.id}
            onClick={() => onSelect(idx)}
            className={`flex items-center text-left px-2 py-1.5 border-b border-gray-700 transition-colors ${
              isSelected ? 'bg-gray-600' : 'hover:bg-gray-800'
            }`}
          >
            {/* 左端の色バー */}
            <div
              className="w-1 self-stretch rounded-sm mr-2 shrink-0"
              style={{
                backgroundColor: isSelected ? colors.accent : 'transparent',
              }}
            />
            {/* 品名 */}
            <span
              className="text-xs truncate"
              style={{ color: colors.bg }}
            >
              {item.itemName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
