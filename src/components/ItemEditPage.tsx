'use client';

import { useState, useCallback } from 'react';
import { ContainerItem, ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { extractColor } from '@/lib/typeDetector';

interface ItemEditPageProps {
  items: ContainerItem[];
  onUpdateItem: (idx: number, updates: Partial<ContainerItem>) => void;
  onSelectAndGoDetail: (idx: number) => void;
}

const ITEM_TYPES: ItemType[] = ['ポリカバー', '箱', '部品', 'その他'];

export default function ItemEditPage({
  items,
  onUpdateItem,
  onSelectAndGoDetail,
}: ItemEditPageProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<ItemType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = items.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(q) ||
        item.partNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 種類ごとの件数
  const typeCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="edit-page">
      {/* サマリーヘッダー */}
      <div className="edit-summary">
        <div className="edit-summary-title">
          <span className="edit-summary-count">{items.length}</span>
          <span className="edit-summary-label">品目</span>
        </div>
        <div className="edit-type-chips">
          {ITEM_TYPES.map((t) => {
            const c = COLOR_MAP[t];
            const count = typeCounts[t] || 0;
            if (count === 0) return null;
            return (
              <button
                key={t}
                className={`edit-chip ${filterType === t ? 'active' : ''}`}
                style={{
                  '--chip-color': c.accent,
                  '--chip-bg': `${c.accent}15`,
                } as React.CSSProperties}
                onClick={() => setFilterType(filterType === t ? 'all' : t)}
              >
                <span className="edit-chip-dot" style={{ background: c.accent }} />
                {t}
                <span className="edit-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 検索バー */}
      <div className="edit-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="品名・気高コードで検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="edit-search-input"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="edit-search-clear"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* テーブルヘッダー */}
      <div className="edit-table-header">
        <span className="edit-th edit-th-name">品名</span>
        <span className="edit-th edit-th-code">気高コード</span>
        <span className="edit-th edit-th-type">種類</span>
        <span className="edit-th edit-th-pallet">1P数</span>
        <span className="edit-th edit-th-qty">P枚</span>
        <span className="edit-th edit-th-frac">端数</span>
      </div>

      {/* リスト */}
      <div className="edit-list">
        {filtered.map((item) => {
          const realIdx = items.indexOf(item);
          const isEditing = editingIdx === realIdx;
          const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
          const itemColor = extractColor(item.itemName);

          return (
            <EditRow
              key={item.id}
              item={item}
              isEditing={isEditing}
              colors={colors}
              itemColor={itemColor}
              onStartEdit={() => setEditingIdx(isEditing ? null : realIdx)}
              onUpdate={(updates) => {
                onUpdateItem(realIdx, updates);
              }}
              onGoDetail={() => onSelectAndGoDetail(realIdx)}
            />
          );
        })}
        {filtered.length === 0 && (
          <div className="edit-empty">
            該当する品目がありません
          </div>
        )}
      </div>
    </div>
  );
}

function EditRow({
  item, isEditing, colors, itemColor,
  onStartEdit, onUpdate, onGoDetail,
}: {
  item: ContainerItem;
  isEditing: boolean;
  colors: { accent: string; text: string };
  itemColor: string | null;
  onStartEdit: () => void;
  onUpdate: (updates: Partial<ContainerItem>) => void;
  onGoDetail: () => void;
}) {
  const [editType, setEditType] = useState(item.type);
  const [editQtyPerPallet, setEditQtyPerPallet] = useState(String(item.qtyPerPallet));
  const [editPalletCount, setEditPalletCount] = useState(String(item.palletCount));
  const [editFraction, setEditFraction] = useState(String(item.fraction));

  const handleSave = useCallback(() => {
    onUpdate({
      type: editType,
      qtyPerPallet: Number(editQtyPerPallet) || 0,
      palletCount: Number(editPalletCount) || 0,
      fraction: Number(editFraction) || 0,
    });
    onStartEdit(); // close
  }, [editType, editQtyPerPallet, editPalletCount, editFraction, onUpdate, onStartEdit]);

  if (isEditing) {
    return (
      <div className="edit-row-expanded">
        {/* 品名ヘッダー */}
        <div className="edit-row-name-header">
          <span style={{ color: colors.accent, fontWeight: 600, fontSize: 14 }}>
            {item.itemName}
          </span>
          {itemColor && (
            <span className="edit-color-badge" style={{
              background: itemColor === '黒' ? '#333' : itemColor === '白' ? '#eee' : '#c49a3c',
              color: itemColor === '黒' ? '#ccc' : itemColor === '白' ? '#333' : '#fff',
            }}>
              {itemColor}
            </span>
          )}
        </div>
        <div className="edit-row-code" style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>
          {item.partNumber}
        </div>

        {/* 編集フィールド */}
        <div className="edit-fields">
          <div className="edit-field">
            <label className="edit-field-label">種類</label>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value as ItemType)}
              className="edit-field-select"
            >
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="edit-field">
            <label className="edit-field-label">1パレット数</label>
            <input
              type="number"
              inputMode="numeric"
              value={editQtyPerPallet}
              onChange={(e) => setEditQtyPerPallet(e.target.value)}
              className="edit-field-input"
            />
          </div>
          <div className="edit-field">
            <label className="edit-field-label">パレット枚数</label>
            <input
              type="number"
              inputMode="numeric"
              value={editPalletCount}
              onChange={(e) => setEditPalletCount(e.target.value)}
              className="edit-field-input"
            />
          </div>
          <div className="edit-field">
            <label className="edit-field-label">端数</label>
            <input
              type="number"
              inputMode="numeric"
              value={editFraction}
              onChange={(e) => setEditFraction(e.target.value)}
              className="edit-field-input"
            />
          </div>
        </div>

        {/* アクション */}
        <div className="edit-row-actions">
          <button className="edit-btn edit-btn-detail" onClick={onGoDetail}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            詳細
          </button>
          <button className="edit-btn edit-btn-cancel" onClick={onStartEdit}>
            キャンセル
          </button>
          <button className="edit-btn edit-btn-save" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    );
  }

  return (
    <button className="edit-row" onClick={onStartEdit}>
      <span className="edit-td edit-td-name">
        <span className="edit-row-dot" style={{ background: colors.accent }} />
        <span className="edit-row-name-text">{item.itemName}</span>
      </span>
      <span className="edit-td edit-td-code">{item.partNumber.slice(-6)}</span>
      <span className="edit-td edit-td-type">
        <span className="edit-type-mini" style={{ color: colors.accent, background: `${colors.accent}15` }}>
          {item.type}
        </span>
      </span>
      <span className="edit-td edit-td-pallet">{item.qtyPerPallet || '-'}</span>
      <span className="edit-td edit-td-qty">{item.palletCount}</span>
      <span className="edit-td edit-td-frac">{item.fraction}</span>
    </button>
  );
}
