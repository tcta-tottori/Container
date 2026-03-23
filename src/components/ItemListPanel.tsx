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
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
      {/* リストヘッダー */}
      <div
        className="flex items-center px-3 py-2 border-b"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          品目一覧
        </span>
        <span
          className="ml-auto text-xs font-mono"
          style={{ color: 'var(--text-muted)' }}
        >
          {items.length}
        </span>
      </div>

      {/* アイテムリスト */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item, idx) => {
          const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
          const isSelected = idx === currentIdx;

          return (
            <button
              key={item.id}
              onClick={() => onSelect(idx)}
              className={`item-row w-full text-left ${isSelected ? 'active' : ''}`}
              style={{
                background: isSelected
                  ? `${colors.accent}10`
                  : undefined,
                borderLeftColor: isSelected ? colors.accent : 'transparent',
                borderLeftWidth: 2,
                borderLeftStyle: 'solid',
              }}
            >
              {/* ドット */}
              <span
                className="item-dot"
                style={{
                  backgroundColor: isSelected ? colors.accent : `${colors.accent}40`,
                  boxShadow: isSelected ? `0 0 6px ${colors.accent}40` : 'none',
                }}
              />
              {/* 品名 */}
              <span
                className="item-name"
                style={{
                  color: isSelected ? colors.text : 'var(--text-secondary)',
                  fontWeight: isSelected ? 500 : 400,
                }}
              >
                {item.itemName}
              </span>
              {/* 種類タグ */}
              <span
                className="item-type-tag"
                style={{
                  backgroundColor: `${colors.accent}15`,
                  color: colors.accent,
                }}
              >
                {item.type}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
