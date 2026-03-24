'use client';

import { useState, useCallback, useRef } from 'react';
import { ContainerItem, ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { extractColor } from '@/lib/typeDetector';
import * as XLSX from 'xlsx';

interface ItemEditPageProps {
  items: ContainerItem[];
  onUpdateItem: (idx: number, updates: Partial<ContainerItem>) => void;
  onSelectAndGoDetail: (idx: number) => void;
}

const ITEM_TYPES: ItemType[] = ['ポリカバー', '箱', '部品', 'その他'];

/* ===== Excel Export ===== */
function exportToExcel(items: ContainerItem[]) {
  const data = items.map((it) => ({
    '新建高コード': it.newPartNumber || '',
    '気高コード': it.partNumber,
    '規格': it.itemName,
    '種類': it.type,
    '代表機種': it.representModel,
    '入数': it.packingQty,
    '総数': it.totalQty,
    'ケース数': it.caseCount,
    'パレット枚数': it.palletCount,
    '端数': it.fraction,
    '1P数': it.qtyPerPallet,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '品目一覧');
  // 列幅設定
  ws['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 10 },
    { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 8 },
  ];
  XLSX.writeFile(wb, `CNS_品目一覧_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ===== Excel Import ===== */
function importFromExcel(
  file: File,
  items: ContainerItem[],
  onUpdate: (idx: number, updates: Partial<ContainerItem>) => void
): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      let updated = 0;
      for (const row of rows) {
        const partNumber = String(row['気高コード'] || '');
        const newPN = String(row['新建高コード'] || '');
        if (!partNumber) continue;
        const idx = items.findIndex((it) => it.partNumber === partNumber);
        if (idx >= 0 && newPN) {
          onUpdate(idx, { newPartNumber: newPN });
          updated++;
        }
      }
      resolve(updated);
    };
    reader.readAsArrayBuffer(file);
  });
}

export default function ItemEditPage({ items, onUpdateItem, onSelectAndGoDetail }: ItemEditPageProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<ItemType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.itemName.toLowerCase().includes(q) || item.partNumber.toLowerCase().includes(q)
        || (item.newPartNumber || '').toLowerCase().includes(q);
    }
    return true;
  });

  const typeCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1; return acc;
  }, {});

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const count = await importFromExcel(file, items, onUpdateItem);
    setImportMsg(`${count}件の新建高コードを更新しました`);
    setTimeout(() => setImportMsg(''), 3000);
    e.target.value = '';
  }, [items, onUpdateItem]);

  return (
    <div className="edit-page" style={{ background: '#141720' }}>
      {/* ヘッダー */}
      <div style={{
        padding: '12px 16px', background: '#1a1d2e',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>{items.length}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>品目</span>
          </div>
          {/* Excel ボタン */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => importRef.current?.click()} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              borderRadius: 8, border: '1px solid rgba(33,115,70,0.4)', cursor: 'pointer',
              background: 'rgba(33,115,70,0.15)', color: '#4caf50', fontSize: 12, fontWeight: 600,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Import
            </button>
            <button onClick={() => exportToExcel(items)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              borderRadius: 8, border: '1px solid rgba(33,115,70,0.4)', cursor: 'pointer',
              background: 'rgba(33,115,70,0.15)', color: '#4caf50', fontSize: 12, fontWeight: 600,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Export
            </button>
          </div>
          <input ref={importRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        </div>
        {importMsg && (
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(76,175,80,0.15)', color: '#66bb6a', fontSize: 12, marginBottom: 8 }}>
            {importMsg}
          </div>
        )}
        {/* チップフィルター */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ITEM_TYPES.map((t) => {
            const c = COLOR_MAP[t];
            const count = typeCounts[t] || 0;
            if (count === 0) return null;
            return (
              <button key={t} onClick={() => setFilterType(filterType === t ? 'all' : t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                  borderRadius: 16, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  background: filterType === t ? `${c.accent}30` : 'rgba(255,255,255,0.05)',
                  color: filterType === t ? c.accent : 'rgba(255,255,255,0.6)',
                  border: `1px solid ${filterType === t ? c.accent + '50' : 'transparent'}`,
                }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.accent }} />
                {t} <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 検索 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        background: '#1e2130', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="品名・コードで検索" value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#fff' }} />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{
            width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,0.06)',
            border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        )}
      </div>

      {/* テーブルヘッダー */}
      <div className="edit-grid-row" style={{
        padding: '5px 12px', flexShrink: 0,
        background: '#181b28', borderBottom: '1px solid rgba(255,255,255,0.04)',
        fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)',
      }}>
        <span>品名</span>
        <span style={{ textAlign: 'center' }}>新コード</span>
        <span style={{ textAlign: 'center' }}>種類</span>
        <span style={{ textAlign: 'center' }}>PL</span>
        <span style={{ textAlign: 'center' }}>CS</span>
        <span style={{ textAlign: 'right' }}>PCS</span>
      </div>

      {/* リスト */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {filtered.map((item) => {
          const realIdx = items.indexOf(item);
          const isEditing = editingIdx === realIdx;
          const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];

          return (
            <EditRow key={item.id} item={item} isEditing={isEditing} colors={colors}
              onStartEdit={() => setEditingIdx(isEditing ? null : realIdx)}
              onUpdate={(updates) => onUpdateItem(realIdx, updates)}
              onGoDetail={() => onSelectAndGoDetail(realIdx)} />
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            該当する品目がありません
          </div>
        )}
      </div>
    </div>
  );
}

function EditRow({ item, isEditing, colors, onStartEdit, onUpdate, onGoDetail }: {
  item: ContainerItem; isEditing: boolean;
  colors: { accent: string; text: string };
  onStartEdit: () => void;
  onUpdate: (updates: Partial<ContainerItem>) => void;
  onGoDetail: () => void;
}) {
  const [editType, setEditType] = useState(item.type);
  const [editQtyPerPallet, setEditQtyPerPallet] = useState(String(item.qtyPerPallet));
  const [editPalletCount, setEditPalletCount] = useState(String(item.palletCount));
  const [editFraction, setEditFraction] = useState(String(item.fraction));
  const [editNewPN, setEditNewPN] = useState(item.newPartNumber || '');
  const itemColor = extractColor(item.itemName);

  const handleSave = useCallback(() => {
    onUpdate({
      type: editType,
      qtyPerPallet: Number(editQtyPerPallet) || 0,
      palletCount: Number(editPalletCount) || 0,
      fraction: Number(editFraction) || 0,
      newPartNumber: editNewPN || undefined,
    });
    onStartEdit();
  }, [editType, editQtyPerPallet, editPalletCount, editFraction, editNewPN, onUpdate, onStartEdit]);

  if (isEditing) {
    return (
      <div style={{
        padding: '14px 16px', background: '#1e2235',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ color: colors.accent, fontWeight: 600, fontSize: 14 }}>{item.itemName}</span>
          {itemColor && (
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
              background: itemColor === '黒' ? '#333' : itemColor === '白' ? '#eee' : '#c49a3c',
              color: itemColor === '黒' ? '#ccc' : itemColor === '白' ? '#333' : '#fff',
            }}>{itemColor}</span>
          )}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 10 }}>{item.partNumber}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 9, fontWeight: 500, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const }}>新建高コード</label>
            <input value={editNewPN} onChange={(e) => setEditNewPN(e.target.value)}
              placeholder="0108230313"
              style={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 9, fontWeight: 500, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const }}>種類</label>
            <select value={editType} onChange={(e) => setEditType(e.target.value as ItemType)}
              style={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none' }}>
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 9, fontWeight: 500, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const }}>1パレット数</label>
            <input type="number" inputMode="numeric" value={editQtyPerPallet} onChange={(e) => setEditQtyPerPallet(e.target.value)}
              style={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 9, fontWeight: 500, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const }}>パレット枚</label>
            <input type="number" inputMode="numeric" value={editPalletCount} onChange={(e) => setEditPalletCount(e.target.value)}
              style={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 9, fontWeight: 500, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const }}>ケース</label>
            <input type="number" inputMode="numeric" value={editFraction} onChange={(e) => setEditFraction(e.target.value)}
              style={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-mono)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onGoDetail} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>詳細</button>
          <button onClick={onStartEdit} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
          }}>キャンセル</button>
          <button onClick={handleSave} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80',
          }}>保存</button>
        </div>
      </div>
    );
  }

  const fmtNum = (v: number) => Number.isInteger(v) ? v : Math.ceil(v * 100) / 100;

  return (
    <button onClick={onStartEdit} className="edit-grid-row" style={{
      width: '100%', padding: '9px 12px',
      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: `${colors.accent}08`, cursor: 'pointer', textAlign: 'left' as const,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.accent, flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
          {item.itemName}
        </span>
      </span>
      <span style={{
        textAlign: 'center', fontSize: 10,
        fontFamily: 'var(--font-mono)', color: item.newPartNumber ? '#4ade80' : 'rgba(255,255,255,0.15)',
      }}>
        {item.newPartNumber ? item.newPartNumber.slice(-6) : '---'}
      </span>
      <span style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 500, color: colors.accent, background: `${colors.accent}15` }}>
          {item.type}
        </span>
      </span>
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{fmtNum(item.palletCount)}</span>
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{fmtNum(item.fraction)}</span>
      <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{item.totalQty.toLocaleString()}</span>
    </button>
  );
}
