'use client';

import { useState, useCallback, useRef } from 'react';
import { ContainerItem, ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { detectItemType } from '@/lib/typeDetector';
import * as XLSX from 'xlsx';

interface ItemEditPageProps {
  items: ContainerItem[];
  containerNo: string;
  onUpdateItem: (idx: number, updates: Partial<ContainerItem>) => void;
  onAddItem: (item: ContainerItem) => void;
  onDeleteItem: (idx: number) => void;
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
    'DESCRIPTION': it.description || '',
    '入数': it.packingQty,
    '総数': it.totalQty,
    'ケース数': it.caseCount,
    'パレット枚数': it.palletCount,
    '端数': it.fraction,
    '1P数': it.qtyPerPallet,
    'G.W.(KGS)': it.grossWeight || '',
    'CBM': it.cbm || '',
    'Meas.': it.measurements || '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '品目一覧');
  ws['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 10 },
    { wch: 12 }, { wch: 20 }, { wch: 8 }, { wch: 10 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 10 }, { wch: 8 }, { wch: 14 },
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

/* ===== 共通スタイル ===== */
const inputStyle: React.CSSProperties = {
  background: '#141720', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, color: '#fff', padding: '7px 10px', fontSize: 13,
  outline: 'none', width: '100%',
};
const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 500, letterSpacing: 0.5,
  color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const,
  marginBottom: 2,
};

/* ===== メインコンポーネント ===== */
export default function ItemEditPage({
  items, containerNo, onUpdateItem, onAddItem, onDeleteItem, onSelectAndGoDetail,
}: ItemEditPageProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<ItemType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.itemName.toLowerCase().includes(q)
        || item.partNumber.toLowerCase().includes(q)
        || (item.newPartNumber || '').toLowerCase().includes(q)
        || (item.description || '').toLowerCase().includes(q);
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

  const handleAddItem = useCallback((item: ContainerItem) => {
    onAddItem(item);
    setShowAddForm(false);
  }, [onAddItem]);

  const handleDeleteItem = useCallback((idx: number, name: string) => {
    if (!window.confirm(`「${name}」を削除しますか？`)) return;
    onDeleteItem(idx);
    setEditingIdx(null);
  }, [onDeleteItem]);

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
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setShowAddForm(!showAddForm); setEditingIdx(null); }} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', cursor: 'pointer',
              background: showAddForm ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.15)',
              color: '#60a5fa', fontSize: 12, fontWeight: 600,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              新規
            </button>
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
        <input type="text" placeholder="品名・コード・説明で検索" value={searchQuery}
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

      {/* 新規登録フォーム */}
      {showAddForm && (
        <AddItemForm
          containerNo={containerNo}
          itemCount={items.length}
          onAdd={handleAddItem}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* テーブルヘッダー */}
      <div className="edit-grid-row" style={{
        padding: '5px 12px', flexShrink: 0,
        background: '#181b28', borderBottom: '1px solid rgba(255,255,255,0.04)',
        fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)',
      }}>
        <span>品名</span>
        <span style={{ textAlign: 'center' }}>Description</span>
        <span style={{ textAlign: 'center' }}>種類</span>
        <span style={{ textAlign: 'center' }}>PL</span>
        <span style={{ textAlign: 'center' }}>CS</span>
        <span style={{ textAlign: 'center' }}>PCS</span>
        <span style={{ textAlign: 'center' }}>G.W.</span>
        <span style={{ textAlign: 'right' }}>CBM</span>
      </div>

      {/* リスト */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {filtered.map((item) => {
          const realIdx = items.indexOf(item);
          const isEditing = editingIdx === realIdx;
          const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];

          return (
            <EditRow key={item.id} item={item} isEditing={isEditing} colors={colors}
              onStartEdit={() => { setEditingIdx(isEditing ? null : realIdx); setShowAddForm(false); }}
              onUpdate={(updates) => onUpdateItem(realIdx, updates)}
              onDelete={() => handleDeleteItem(realIdx, item.itemName)}
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

/* ===== 新規登録フォーム ===== */
function AddItemForm({ containerNo, itemCount, onAdd, onCancel }: {
  containerNo: string;
  itemCount: number;
  onAdd: (item: ContainerItem) => void;
  onCancel: () => void;
}) {
  const [partNumber, setPartNumber] = useState('');
  const [itemName, setItemName] = useState('');
  const [representModel, setRepresentModel] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ItemType>('ポリカバー');
  const [packingQty, setPackingQty] = useState('');
  const [totalQty, setTotalQty] = useState('');
  const [caseCount, setCaseCount] = useState('');
  const [palletCount, setPalletCount] = useState('');
  const [fraction, setFraction] = useState('');
  const [qtyPerPallet, setQtyPerPallet] = useState('');
  const [newPartNumber, setNewPartNumber] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [cbm, setCbm] = useState('');
  const [measurements, setMeasurements] = useState('');

  const handleSubmit = () => {
    if (!itemName.trim()) return;
    const detectedType = partNumber
      ? detectItemType(itemName, Number(qtyPerPallet) || 0, Number(palletCount) || 0, partNumber)
      : type;
    const item: ContainerItem = {
      id: `${containerNo}-new-${itemCount}-${Date.now()}`,
      partNumber: partNumber.trim(),
      itemName: itemName.trim(),
      representModel: representModel.trim(),
      type: detectedType,
      packingQty: Number(packingQty) || 0,
      totalQty: Number(totalQty) || 0,
      caseCount: Number(caseCount) || 0,
      palletCount: Number(palletCount) || 0,
      fraction: Number(fraction) || 0,
      qtyPerPallet: Number(qtyPerPallet) || 0,
      newPartNumber: newPartNumber.trim() || undefined,
      description: description.trim() || undefined,
      grossWeight: Number(grossWeight) || undefined,
      cbm: Number(cbm) || undefined,
      measurements: measurements.trim() || undefined,
    };
    onAdd(item);
  };

  return (
    <div style={{
      padding: '14px 16px', background: '#1a2235',
      borderBottom: '2px solid rgba(59,130,246,0.3)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新規品目登録
      </div>

      {/* 基本情報 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={labelStyle}>品番 *</div>
          <input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="JRI-H100(KKB)" style={inputStyle} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <div style={labelStyle}>品名 *</div>
          <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="JRI-H100KKBポリカバー" style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>新建高コード</div>
          <input value={newPartNumber} onChange={(e) => setNewPartNumber(e.target.value)} placeholder="0108230313" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>

      {/* 説明・機種 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <div style={labelStyle}>ITEM DESCRIPTION</div>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="UPPER LID ASSY" style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>代表機種</div>
          <input value={representModel} onChange={(e) => setRepresentModel(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>種類</div>
          <select value={type} onChange={(e) => setType(e.target.value as ItemType)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* 数量 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={labelStyle}>入数</div>
          <input type="number" inputMode="numeric" value={packingQty} onChange={(e) => setPackingQty(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <div style={labelStyle}>総数</div>
          <input type="number" inputMode="numeric" value={totalQty} onChange={(e) => setTotalQty(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <div style={labelStyle}>ケース数</div>
          <input type="number" inputMode="numeric" value={caseCount} onChange={(e) => setCaseCount(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <div style={labelStyle}>パレット枚</div>
          <input type="number" inputMode="numeric" value={palletCount} onChange={(e) => setPalletCount(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <div style={labelStyle}>端数</div>
          <input type="number" inputMode="numeric" value={fraction} onChange={(e) => setFraction(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <div style={labelStyle}>1P数</div>
          <input type="number" inputMode="numeric" value={qtyPerPallet} onChange={(e) => setQtyPerPallet(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>

      {/* 重量・寸法 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>G.W. (KGS)</div>
          <input type="number" inputMode="decimal" step="0.01" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} placeholder="405.00" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <div style={labelStyle}>CBM</div>
          <input type="number" inputMode="decimal" step="0.01" value={cbm} onChange={(e) => setCbm(e.target.value)} placeholder="2.38" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <div style={labelStyle}>Meas. (寸法)</div>
          <input value={measurements} onChange={(e) => setMeasurements(e.target.value)} placeholder="55*38*38" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>

      {/* ボタン */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
        }}>キャンセル</button>
        <button onClick={handleSubmit} disabled={!itemName.trim()} style={{
          flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: itemName.trim() ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.05)',
          border: '1px solid rgba(59,130,246,0.3)', color: itemName.trim() ? '#60a5fa' : 'rgba(96,165,250,0.3)',
        }}>登録</button>
      </div>
    </div>
  );
}

/* ===== 編集行 ===== */
function EditRow({ item, isEditing, colors, onStartEdit, onUpdate, onDelete, onGoDetail }: {
  item: ContainerItem; isEditing: boolean;
  colors: { accent: string; text: string };
  onStartEdit: () => void;
  onUpdate: (updates: Partial<ContainerItem>) => void;
  onDelete: () => void;
  onGoDetail: () => void;
}) {
  const [editType, setEditType] = useState(item.type);
  const [editQtyPerPallet, setEditQtyPerPallet] = useState(String(item.qtyPerPallet));
  const [editPalletCount, setEditPalletCount] = useState(String(item.palletCount));
  const [editFraction, setEditFraction] = useState(String(item.fraction));
  const [editNewPN, setEditNewPN] = useState(item.newPartNumber || '');
  const [editPartNumber, setEditPartNumber] = useState(item.partNumber);
  const [editItemName, setEditItemName] = useState(item.itemName);
  const [editRepresentModel, setEditRepresentModel] = useState(item.representModel);
  const [editDescription, setEditDescription] = useState(item.description || '');
  const [editPackingQty, setEditPackingQty] = useState(String(item.packingQty));
  const [editTotalQty, setEditTotalQty] = useState(String(item.totalQty));
  const [editCaseCount, setEditCaseCount] = useState(String(item.caseCount));
  const [editGrossWeight, setEditGrossWeight] = useState(String(item.grossWeight || ''));
  const [editCbm, setEditCbm] = useState(String(item.cbm || ''));
  const [editMeasurements, setEditMeasurements] = useState(item.measurements || '');

  const handleSave = useCallback(() => {
    onUpdate({
      partNumber: editPartNumber.trim(),
      itemName: editItemName.trim(),
      representModel: editRepresentModel.trim(),
      type: editType,
      packingQty: Number(editPackingQty) || 0,
      totalQty: Number(editTotalQty) || 0,
      caseCount: Number(editCaseCount) || 0,
      qtyPerPallet: Number(editQtyPerPallet) || 0,
      palletCount: Number(editPalletCount) || 0,
      fraction: Number(editFraction) || 0,
      newPartNumber: editNewPN || undefined,
      description: editDescription.trim() || undefined,
      grossWeight: Number(editGrossWeight) || undefined,
      cbm: Number(editCbm) || undefined,
      measurements: editMeasurements.trim() || undefined,
    });
    onStartEdit();
  }, [editPartNumber, editItemName, editRepresentModel, editType, editPackingQty, editTotalQty, editCaseCount, editQtyPerPallet, editPalletCount, editFraction, editNewPN, editDescription, editGrossWeight, editCbm, editMeasurements, onUpdate, onStartEdit]);

  if (isEditing) {
    return (
      <div style={{
        padding: '14px 16px', background: '#1e2235',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* 基本情報 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
          <div>
            <div style={labelStyle}>品番</div>
            <input value={editPartNumber} onChange={(e) => setEditPartNumber(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={labelStyle}>品名</div>
            <input value={editItemName} onChange={(e) => setEditItemName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>新建高コード</div>
            <input value={editNewPN} onChange={(e) => setEditNewPN(e.target.value)} placeholder="0108230313"
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
        </div>

        {/* 説明・機種・種類 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={labelStyle}>ITEM DESCRIPTION</div>
            <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="UPPER LID ASSY" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>代表機種</div>
            <input value={editRepresentModel} onChange={(e) => setEditRepresentModel(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>種類</div>
            <select value={editType} onChange={(e) => setEditType(e.target.value as ItemType)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* 数量 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 10 }}>
          <div>
            <div style={labelStyle}>入数</div>
            <input type="number" inputMode="numeric" value={editPackingQty} onChange={(e) => setEditPackingQty(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div>
            <div style={labelStyle}>総数</div>
            <input type="number" inputMode="numeric" value={editTotalQty} onChange={(e) => setEditTotalQty(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div>
            <div style={labelStyle}>ケース数</div>
            <input type="number" inputMode="numeric" value={editCaseCount} onChange={(e) => setEditCaseCount(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div>
            <div style={labelStyle}>パレット枚</div>
            <input type="number" inputMode="numeric" value={editPalletCount} onChange={(e) => setEditPalletCount(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div>
            <div style={labelStyle}>端数</div>
            <input type="number" inputMode="numeric" value={editFraction} onChange={(e) => setEditFraction(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div>
            <div style={labelStyle}>1P数</div>
            <input type="number" inputMode="numeric" value={editQtyPerPallet} onChange={(e) => setEditQtyPerPallet(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
        </div>

        {/* 重量・寸法 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={labelStyle}>G.W. (KGS)</div>
            <input type="number" inputMode="decimal" step="0.01" value={editGrossWeight} onChange={(e) => setEditGrossWeight(e.target.value)}
              placeholder="405.00" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div>
            <div style={labelStyle}>CBM</div>
            <input type="number" inputMode="decimal" step="0.01" value={editCbm} onChange={(e) => setEditCbm(e.target.value)}
              placeholder="2.38" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div>
            <div style={labelStyle}>Meas. (寸法)</div>
            <input value={editMeasurements} onChange={(e) => setEditMeasurements(e.target.value)}
              placeholder="55*38*38" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
          </div>
        </div>

        {/* ボタン */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onGoDetail} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa',
          }}>詳細</button>
          <button onClick={onDelete} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171',
          }}>削除</button>
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
        textAlign: 'center', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: item.description ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
      }}>
        {item.description || '---'}
      </span>
      <span style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 500, color: colors.accent, background: `${colors.accent}15` }}>
          {item.type}
        </span>
      </span>
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{fmtNum(item.palletCount)}</span>
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{fmtNum(item.fraction)}</span>
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{item.totalQty.toLocaleString()}</span>
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: item.grossWeight ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)' }}>
        {item.grossWeight ? item.grossWeight.toFixed(1) : '---'}
      </span>
      <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: item.cbm ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)' }}>
        {item.cbm ? item.cbm.toFixed(2) : '---'}
      </span>
    </button>
  );
}
