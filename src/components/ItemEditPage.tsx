'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ContainerItem, ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { saveToGitHub, getStoredToken, storeToken } from '@/lib/githubSave';
import { detectItemType } from '@/lib/typeDetector';
import * as XLSX from 'xlsx';

interface ItemEditPageProps {
  items: ContainerItem[];
  containerNo: string;
  /** 現在のコンテナに含まれる品番セット（自動ソート用） */
  containerPartNumbers?: Set<string>;
  onUpdateItem: (idx: number, updates: Partial<ContainerItem>) => void;
  onAddItem: (item: ContainerItem) => void;
  onDeleteItem: (idx: number) => void;
  onSelectAndGoDetail: (idx: number) => void;
  onMasterReload?: () => void;
}

const ITEM_TYPES: ItemType[] = ['ポリカバー', 'ジャーポット', '箱', '部品', '鍋', 'ヤーマン部品', 'その他'];

/* saveMasterExcel は githubSave.ts に移動済み */

/* ===== Excel Export（CNS品目一覧 全集約版フォーマット） ===== */
function exportToExcel(items: ContainerItem[]) {
  // ヘッダー行0（グループ行）
  const groupRow = [
    'ベース情報', '', '', '', '', '', '', '', '',
    '气高编号', '', '',
    'コンテナ日程', '', '', '',
    '', '', '', '', '',
  ];
  // ヘッダー行1
  const headerRow = [
    '新建高コード', '気高コード', '規格', '種類', '代表機種', '入数', '総数', 'ケース数', '1P数',
    '新建高コード\n(气高编号)', '規格\n(气高编号)', '紐付状態',
    '規格\n(コンテナ)', '代表機種\n(コンテナ)', '入数\n(コンテナ)', '1P数\n(コンテナ)',
    'ITEM\nDESCRIPTION', 'MODEL NO.', 'G.W.\n(per carton)', 'CBM', 'Meas.',
  ];
  const dataRows = items.map((it) => [
    it.newPartNumber || '',
    it.partNumber,
    it.itemName,
    it.type || '',
    it.representModel,
    it.packingQty || '',
    it.totalQty || '',
    it.caseCount || '',
    it.qtyPerPallet || '',
    it.newPartNumberKetaka || '',
    it.itemNameKetaka || '',
    it.linkStatus || '',
    it.itemNameContainer || '',
    it.representModelContainer || '',
    it.packingQtyContainer || '',
    it.qtyPerPalletContainer || '',
    it.description || '',
    it.modelNo || '',
    it.grossWeight || '',
    it.cbm || '',
    it.measurements || '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([groupRow, headerRow, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '品目一覧（全集約）');
  ws['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 22 },
    { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 6 },
    { wch: 14 }, { wch: 28 }, { wch: 8 },
    { wch: 28 }, { wch: 22 }, { wch: 6 }, { wch: 6 },
    { wch: 22 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 14 },
  ];
  // ヘッダーグループのマージ
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },   // ベース情報
    { s: { r: 0, c: 9 }, e: { r: 0, c: 11 } },   // 气高编号
    { s: { r: 0, c: 12 }, e: { r: 0, c: 15 } },  // コンテナ日程
  ];
  XLSX.writeFile(wb, `CNS_品目一覧_全集約版.xlsx`);
}

/* ===== 行データからマスタ情報を抽出 ===== */
function extractMasterFromRow(r: unknown[]) {
  const v = (col: number) => r[col] != null ? String(r[col]).trim() : '';
  const n = (col: number) => { const x = Number(r[col]); return isNaN(x) ? undefined : x; };
  return {
    newPartNumber: v(0) || undefined,
    partNumber: v(1),
    itemName: v(2),
    type: (v(3) || undefined) as ItemType | undefined,
    representModel: v(4),
    packingQty: n(5) ?? 0,
    totalQty: n(6) ?? 0,
    caseCount: n(7) ?? 0,
    qtyPerPallet: n(8) ?? 0,
    newPartNumberKetaka: v(9) || undefined,
    itemNameKetaka: v(10) || undefined,
    linkStatus: v(11) || undefined,
    itemNameContainer: v(12) || undefined,
    representModelContainer: v(13) || undefined,
    packingQtyContainer: n(14),
    qtyPerPalletContainer: n(15),
    description: v(16) || undefined,
    modelNo: v(17) || undefined,
    grossWeight: n(18),
    cbm: n(19),
    measurements: v(20) || undefined,
  };
}

/* ===== Excel Import（CNS品目一覧 全集約版 — 全品目追加） ===== */
function importFromExcel(
  file: File,
  items: ContainerItem[],
  containerNo: string,
  onUpdate: (idx: number, updates: Partial<ContainerItem>) => void,
  onAdd: (item: ContainerItem) => void,
): Promise<{ updated: number; added: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

      let updated = 0;
      let added = 0;
      const existingParts = new Set(items.map((it) => it.partNumber));

      for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !Array.isArray(r)) continue;
        const master = extractMasterFromRow(r);
        if (!master.partNumber) continue;

        const idx = items.findIndex((it) => it.partNumber === master.partNumber);
        if (idx >= 0) {
          // 既存品目を更新
          const updates: Partial<ContainerItem> = {};
          if (master.newPartNumber) updates.newPartNumber = master.newPartNumber;
          if (master.type) updates.type = master.type;
          if (master.representModel) updates.representModel = master.representModel;
          if (master.packingQty) updates.packingQty = master.packingQty;
          if (master.qtyPerPallet) updates.qtyPerPallet = master.qtyPerPallet;
          if (master.newPartNumberKetaka) updates.newPartNumberKetaka = master.newPartNumberKetaka;
          if (master.itemNameKetaka) updates.itemNameKetaka = master.itemNameKetaka;
          if (master.linkStatus) updates.linkStatus = master.linkStatus;
          if (master.itemNameContainer) updates.itemNameContainer = master.itemNameContainer;
          if (master.representModelContainer) updates.representModelContainer = master.representModelContainer;
          if (master.packingQtyContainer !== undefined) updates.packingQtyContainer = master.packingQtyContainer;
          if (master.qtyPerPalletContainer !== undefined) updates.qtyPerPalletContainer = master.qtyPerPalletContainer;
          if (master.description) updates.description = master.description;
          if (master.modelNo) updates.modelNo = master.modelNo;
          if (master.grossWeight !== undefined) updates.grossWeight = master.grossWeight;
          if (master.cbm !== undefined) updates.cbm = master.cbm;
          if (master.measurements) updates.measurements = master.measurements;
          if (Object.keys(updates).length > 0) {
            onUpdate(idx, updates);
            updated++;
          }
        } else if (!existingParts.has(master.partNumber)) {
          // 新規品目を追加（マスタデータのみ、パレット/端数は0）
          existingParts.add(master.partNumber);
          const detectedType = master.type || detectItemType(
            master.itemName, master.qtyPerPallet, 0, master.partNumber
          );
          onAdd({
            id: `master-${containerNo}-${i}`,
            partNumber: master.partNumber,
            itemName: master.itemName,
            representModel: master.representModel,
            type: detectedType,
            packingQty: master.packingQty,
            totalQty: master.totalQty,
            caseCount: master.caseCount,
            palletCount: 0,
            fraction: 0,
            qtyPerPallet: master.qtyPerPallet,
            newPartNumber: master.newPartNumber,
            newPartNumberKetaka: master.newPartNumberKetaka,
            itemNameKetaka: master.itemNameKetaka,
            linkStatus: master.linkStatus,
            itemNameContainer: master.itemNameContainer,
            representModelContainer: master.representModelContainer,
            packingQtyContainer: master.packingQtyContainer,
            qtyPerPalletContainer: master.qtyPerPalletContainer,
            description: master.description,
            modelNo: master.modelNo,
            grossWeight: master.grossWeight,
            cbm: master.cbm,
            measurements: master.measurements,
          });
          added++;
        }
      }
      resolve({ updated, added });
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
  items, containerNo, containerPartNumbers, onUpdateItem, onAddItem, onDeleteItem, onSelectAndGoDetail, onMasterReload,
}: ItemEditPageProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [containerFirst, setContainerFirst] = useState(true);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

  // Excel-like column filter/sort state
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // refreshKeyが変わるとfiltered/sortedFilteredが再計算される
  void refreshKey;

  // Close filter dropdown when clicking outside
  useEffect(() => {
    if (!activeFilterColumn) return;
    const handleClick = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setActiveFilterColumn(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activeFilterColumn]);

  // Column definitions for filtering
  const FILTER_COLUMNS: { key: string; label: string; align?: string; getValue: (item: ContainerItem) => string }[] = useMemo(() => [
    { key: 'itemName', label: '品名', getValue: (item) => item.itemName || '' },
    { key: 'partNumber', label: '気高', align: 'center', getValue: (item) => item.partNumber || '' },
    { key: 'newPartNumber', label: '新建高', align: 'center', getValue: (item) => item.newPartNumber || '' },
    { key: 'type', label: '種類', align: 'center', getValue: (item) => item.type || '' },
    { key: 'qtyPerPallet', label: '1P', align: 'center', getValue: (item) => String(item.qtyPerPallet || '') },
    { key: 'packingQty', label: '入数', align: 'center', getValue: (item) => String(item.packingQty || '') },
    { key: 'grossWeight', label: 'G.W.', align: 'center', getValue: (item) => item.grossWeight != null ? String(item.grossWeight) : '' },
    { key: 'cbm', label: 'CBM', align: 'center', getValue: (item) => item.cbm != null ? String(item.cbm) : '' },
    { key: 'measurements', label: 'Meas.', align: 'right', getValue: (item) => item.measurements || '' },
  ], []);

  // Compute unique values per column (for filter dropdowns)
  const columnUniqueValues = useMemo(() => {
    const result: Record<string, Map<string, number>> = {};
    for (const col of FILTER_COLUMNS) {
      const counts = new Map<string, number>();
      for (const item of items) {
        const val = col.getValue(item) || '(空白)';
        counts.set(val, (counts.get(val) || 0) + 1);
      }
      result[col.key] = counts;
    }
    return result;
  }, [items, FILTER_COLUMNS]);

  const filtered = items.filter((item) => {
    // Column filters
    for (const col of FILTER_COLUMNS) {
      const filterSet = columnFilters[col.key];
      if (filterSet && filterSet.size > 0) {
        const val = col.getValue(item) || '(空白)';
        if (!filterSet.has(val)) return false;
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.itemName.toLowerCase().includes(q)
        || item.partNumber.toLowerCase().includes(q)
        || (item.newPartNumber || '').toLowerCase().includes(q)
        || (item.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Sort: first by containerFirst, then by sortColumn
  const sortedFiltered = useMemo(() => {
    let result = [...filtered];
    // Column sort
    if (sortColumn) {
      const col = FILTER_COLUMNS.find((c) => c.key === sortColumn);
      if (col) {
        result.sort((a, b) => {
          const aVal = col.getValue(a);
          const bVal = col.getValue(b);
          // Try numeric comparison
          const aNum = Number(aVal);
          const bNum = Number(bVal);
          let cmp: number;
          if (!isNaN(aNum) && !isNaN(bNum) && aVal !== '' && bVal !== '') {
            cmp = aNum - bNum;
          } else {
            cmp = aVal.localeCompare(bVal, 'ja');
          }
          return sortDirection === 'asc' ? cmp : -cmp;
        });
      }
    }
    // コンテナ対象品目を上部にソート (stable: container items go first)
    if (containerFirst && containerPartNumbers && containerPartNumbers.size > 0) {
      result.sort((a, b) => {
        const aMatch = containerPartNumbers.has(a.partNumber) ? 0 : 1;
        const bMatch = containerPartNumbers.has(b.partNumber) ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    return result;
  }, [filtered, sortColumn, sortDirection, containerFirst, containerPartNumbers, FILTER_COLUMNS]);

  // Check if a column has active filters (not all selected)
  const hasActiveFilter = useCallback((colKey: string) => {
    const filterSet = columnFilters[colKey];
    if (!filterSet || filterSet.size === 0) return false;
    const totalUnique = columnUniqueValues[colKey]?.size || 0;
    return filterSet.size < totalUnique;
  }, [columnFilters, columnUniqueValues]);

  const handleToggleFilter = useCallback((colKey: string, value: string) => {
    setColumnFilters((prev) => {
      const current = prev[colKey];
      const allValues = columnUniqueValues[colKey];
      if (!allValues) return prev;

      let newSet: Set<string>;
      if (!current || current.size === 0) {
        // First click: start from all selected, then remove this one
        newSet = new Set(allValues.keys());
        newSet.delete(value);
      } else {
        newSet = new Set(current);
        if (newSet.has(value)) {
          newSet.delete(value);
        } else {
          newSet.add(value);
        }
      }
      // If all selected, clear the filter
      if (newSet.size === allValues.size) {
        const next = { ...prev };
        delete next[colKey];
        return next;
      }
      if (newSet.size === 0) {
        // Don't allow empty — keep at least the toggled value
        newSet.add(value);
      }
      return { ...prev, [colKey]: newSet };
    });
  }, [columnUniqueValues]);

  const handleSelectAll = useCallback((colKey: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  }, []);

  const handleDeselectAll = useCallback((colKey: string) => {
    // Select nothing — but we need at least something, so just clear
    // Actually for "deselect all" we set an empty set which means show nothing
    // But that's weird UX, so toggle: if all selected -> deselect all (show first only), if partially -> select all
    const filterSet = columnFilters[colKey];
    const allValues = columnUniqueValues[colKey];
    if (!allValues) return;

    if (!filterSet || filterSet.size === 0) {
      // Currently all selected — do nothing (selectAll checkbox will handle)
      return;
    }
    // Clear filter = select all
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  }, [columnFilters, columnUniqueValues]);

  const handleSort = useCallback((colKey: string, direction: 'asc' | 'desc') => {
    setSortColumn(colKey);
    setSortDirection(direction);
    setActiveFilterColumn(null);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importFromExcel(file, items, containerNo, onUpdateItem, onAddItem);
    const msgs: string[] = [];
    if (result.updated > 0) msgs.push(`${result.updated}件更新`);
    if (result.added > 0) msgs.push(`${result.added}件追加`);
    setImportMsg(msgs.length > 0 ? `${msgs.join('、')}しました（合計${items.length + result.added}件）` : '変更なし');
    setTimeout(() => setImportMsg(''), 4000);
    e.target.value = '';
  }, [items, containerNo, onUpdateItem, onAddItem]);

  const handleAddItem = useCallback((item: ContainerItem) => {
    onAddItem(item);
    setShowAddForm(false);
  }, [onAddItem]);

  const handleGitHubSave = useCallback(async () => {
    const token = getStoredToken();
    if (!token) { setShowTokenDialog(true); setTokenInput(''); return; }
    setSaving(true);
    setSaveMsg('');
    const result = await saveToGitHub(items, token, (msg) => setSaveMsg(msg));
    setSaveMsg(result.message);
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 5000);
  }, [items]);

  const handleTokenSubmit = useCallback(async () => {
    if (!tokenInput.trim()) return;
    storeToken(tokenInput.trim());
    setShowTokenDialog(false);
    setSaving(true);
    setSaveMsg('');
    const result = await saveToGitHub(items, tokenInput.trim(), (msg) => setSaveMsg(msg));
    setSaveMsg(result.message);
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 5000);
  }, [items, tokenInput]);

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
          <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
            <button onClick={() => { setShowAddForm(!showAddForm); setEditingIdx(null); }} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', cursor: 'pointer',
              background: showAddForm ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.15)',
              color: '#60a5fa', fontSize: 12, fontWeight: 600,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              新規
            </button>
            {/* GitHub保存（メイン） */}
            <button onClick={handleGitHubSave} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              borderRadius: 8, border: '1px solid rgba(139,92,246,0.4)', cursor: saving ? 'wait' : 'pointer',
              background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: 12, fontWeight: 600,
              opacity: saving ? 0.6 : 1,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              {saving ? '保存中...' : '保存'}
            </button>
            {/* マスタ再読込（メイン） */}
            {onMasterReload && (
              <button onClick={onMasterReload} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', cursor: 'pointer',
                background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontSize: 12, fontWeight: 600,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                再読込
              </button>
            )}
            {/* サブメニュー（外部Import/Export） */}
            <button onClick={() => setShowSubMenu(!showSubMenu)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
              background: showSubMenu ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.5)', fontSize: 14,
            }}>⋮</button>
            {showSubMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 10,
                background: '#252a40', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: 4, minWidth: 160,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <button onClick={() => { importRef.current?.click(); setShowSubMenu(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px',
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: '#4caf50', fontSize: 12, fontWeight: 500,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  外部Excelインポート
                </button>
                <button onClick={() => { exportToExcel(items); setShowSubMenu(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px',
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: '#4caf50', fontSize: 12, fontWeight: 500,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  外部Excelエクスポート
                </button>
              </div>
            )}
          </div>
          <input ref={importRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        </div>
        {importMsg && (
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(76,175,80,0.15)', color: '#66bb6a', fontSize: 12, marginBottom: 8 }}>
            {importMsg}
          </div>
        )}
        {/* CN優先トグル */}
        {containerPartNumbers && containerPartNumbers.size > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setContainerFirst(!containerFirst)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                borderRadius: 16, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                background: containerFirst ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                color: containerFirst ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${containerFirst ? 'rgba(251,191,36,0.4)' : 'transparent'}`,
              }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 9 6 9 6"/><polyline points="3 12 15 12"/><polyline points="3 18 21 18"/>
              </svg>
              CN優先
            </button>
          </div>
        )}
      </div>

      {/* 保存メッセージ */}
      {saveMsg && (
        <div style={{
          padding: '6px 16px', fontSize: 12, fontWeight: 600, flexShrink: 0,
          background: saveMsg.includes('完了') ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          color: saveMsg.includes('完了') ? '#4ade80' : '#f87171',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {saveMsg}
        </div>
      )}

      {/* GitHubトークン入力ダイアログ */}
      {showTokenDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        }} onClick={() => setShowTokenDialog(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#1e2235', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 24, width: '90%', maxWidth: 400,
          }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>GitHub Personal Access Token</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '0 0 16px', lineHeight: 1.5 }}>
              GitHubに保存するにはPersonal Access Tokenが必要です。<br/>
              Settings → Developer settings → Personal access tokens で作成してください。<br/>
              必要な権限: <code style={{ color: '#a78bfa' }}>repo</code> (Contents: Read and write)
            </p>
            <input type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTokenSubmit()}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
                background: '#141720', border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
                outline: 'none', marginBottom: 12, boxSizing: 'border-box',
              }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTokenDialog(false)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
              }}>キャンセル</button>
              <button onClick={handleTokenSubmit} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>保存して送信</button>
            </div>
          </div>
        </div>
      )}

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

      {/* テーブルヘッダー（Excel-like filter/sort） */}
      <div className="edit-grid-row" style={{
        padding: '8px 16px', flexShrink: 0,
        background: '#181b28', borderBottom: '1px solid rgba(255,255,255,0.04)',
        fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)',
      }}>
        {FILTER_COLUMNS.map((col) => {
          const isActive = hasActiveFilter(col.key);
          const isSorted = sortColumn === col.key;
          const isOpen = activeFilterColumn === col.key;
          return (
            <span key={col.key} style={{
              position: 'relative',
              textAlign: (col.align || 'left') as 'left' | 'center' | 'right',
              display: 'flex',
              alignItems: 'center',
              justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
              gap: 2,
              cursor: 'pointer',
              userSelect: 'none',
              color: isActive || isSorted ? '#60a5fa' : 'rgba(255,255,255,0.45)',
            }}
              onClick={() => setActiveFilterColumn(isOpen ? null : col.key)}
            >
              {col.label}
              {isSorted && <span style={{ fontSize: 9 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
              <span style={{
                fontSize: 8, marginLeft: 1,
                color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.25)',
              }}>▼</span>
              {isActive && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#60a5fa',
                }} />
              )}
              {/* Filter dropdown */}
              {isOpen && (
                <div
                  ref={filterDropdownRef}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: col.align === 'right' ? 'auto' : 0,
                    right: col.align === 'right' ? 0 : 'auto',
                    marginTop: 4,
                    zIndex: 50,
                    background: '#252a40',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    minWidth: 180,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    textTransform: 'none' as const,
                    letterSpacing: 0,
                    fontFamily: 'inherit',
                    fontWeight: 400,
                  }}
                >
                  {/* Sort buttons */}
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => handleSort(col.key, 'asc')} style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px',
                      borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                      background: sortColumn === col.key && sortDirection === 'asc' ? 'rgba(96,165,250,0.15)' : 'transparent',
                      color: sortColumn === col.key && sortDirection === 'asc' ? '#60a5fa' : 'rgba(255,255,255,0.7)',
                    }}>
                      <span>↑</span> 昇順
                    </button>
                    <button onClick={() => handleSort(col.key, 'desc')} style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px',
                      borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                      background: sortColumn === col.key && sortDirection === 'desc' ? 'rgba(96,165,250,0.15)' : 'transparent',
                      color: sortColumn === col.key && sortDirection === 'desc' ? '#60a5fa' : 'rgba(255,255,255,0.7)',
                    }}>
                      <span>↓</span> 降順
                    </button>
                  </div>
                  {/* Divider */}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 10px' }} />
                  {/* Select all checkbox */}
                  <div style={{ padding: '8px 10px 4px' }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600,
                    }}>
                      <input
                        type="checkbox"
                        checked={!columnFilters[col.key] || columnFilters[col.key]?.size === 0}
                        onChange={() => {
                          const filterSet = columnFilters[col.key];
                          if (!filterSet || filterSet.size === 0) {
                            // Currently all selected — can't deselect all, do nothing
                          } else {
                            handleSelectAll(col.key);
                          }
                        }}
                        style={{ accentColor: '#60a5fa', width: 14, height: 14 }}
                      />
                      すべて選択
                    </label>
                  </div>
                  {/* Value checkboxes */}
                  <div style={{ maxHeight: 300, overflowY: 'auto', padding: '4px 10px 8px' }}>
                    {Array.from(columnUniqueValues[col.key]?.entries() || [])
                      .sort((a: [string, number], b: [string, number]) => a[0].localeCompare(b[0], 'ja'))
                      .map(([value, count]: [string, number]) => {
                        const filterSet = columnFilters[col.key];
                        const isChecked = !filterSet || filterSet.size === 0 || filterSet.has(value);
                        return (
                          <label key={value} style={{
                            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                            fontSize: 12, color: 'rgba(255,255,255,0.7)', padding: '3px 0',
                          }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleFilter(col.key, value)}
                              style={{ accentColor: '#60a5fa', width: 14, height: 14, flexShrink: 0 }}
                            />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {value}
                            </span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                              {count}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </span>
          );
        })}
      </div>

      {/* リスト */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {sortedFiltered.map((item, sortIdx) => {
          const realIdx = items.indexOf(item);
          const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
          const isContainerMatch = containerPartNumbers?.has(item.partNumber) ?? false;
          // コンテナ対象/非対象の境界線
          const isLastMatch = containerFirst && isContainerMatch && sortIdx < sortedFiltered.length - 1
            && !containerPartNumbers?.has(sortedFiltered[sortIdx + 1]?.partNumber);

          return (
            <div key={item.id}>
              <EditRow item={item} colors={colors}
                isContainerMatch={isContainerMatch}
                onStartEdit={() => { setEditingIdx(realIdx); setShowAddForm(false); }} />
              {isLastMatch && (
                <div style={{
                  height: 2, background: 'linear-gradient(90deg, rgba(251,191,36,0.4), transparent)',
                  margin: '0 12px',
                }} />
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            該当する品目がありません
          </div>
        )}
      </div>

      {/* 詳細ポップアップ */}
      {editingIdx !== null && items[editingIdx] && (
        <EditModal
          item={items[editingIdx]}
          onClose={() => setEditingIdx(null)}
          onUpdate={(updates) => {
            onUpdateItem(editingIdx, updates);
            // 保存後、テーブルが自動リフレッシュされるよう再フィルタのきっかけを作成
            setRefreshKey((k) => k + 1);
          }}
          onDelete={() => { handleDeleteItem(editingIdx, items[editingIdx].itemName); setEditingIdx(null); }}
          onGoDetail={() => { onSelectAndGoDetail(editingIdx); setEditingIdx(null); }}
        />
      )}
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
  const [qtyPerPallet, setQtyPerPallet] = useState('');
  const [newPartNumber, setNewPartNumber] = useState('');
  const [modelNo, setModelNo] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [cbm, setCbm] = useState('');
  const [measurements, setMeasurements] = useState('');

  const handleSubmit = () => {
    if (!itemName.trim()) return;
    const detectedType = partNumber
      ? detectItemType(itemName, Number(qtyPerPallet) || 0, 0, partNumber)
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
      palletCount: 0,
      fraction: 0,
      qtyPerPallet: Number(qtyPerPallet) || 0,
      newPartNumber: newPartNumber.trim() || undefined,
      description: description.trim() || undefined,
      modelNo: modelNo.trim() || undefined,
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
          <div style={labelStyle}>1P数</div>
          <input type="number" inputMode="numeric" value={qtyPerPallet} onChange={(e) => setQtyPerPallet(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>

      {/* MODEL NO.・重量・寸法 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>MODEL NO.</div>
          <input value={modelNo} onChange={(e) => setModelNo(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
        </div>
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

/* ===== 読み取り専用フィールド ===== */
const roStyle: React.CSSProperties = {
  background: '#0d0f16', border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 8, color: 'rgba(255,255,255,0.55)', padding: '7px 10px', fontSize: 13,
  width: '100%', fontFamily: 'var(--font-mono)',
};

/* ===== セクションヘッダ ===== */
function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color,
      marginBottom: 6, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ width: 3, height: 10, borderRadius: 2, background: color }} />
      {title}
    </div>
  );
}

/* ===== 詳細ポップアップモーダル ===== */
function EditModal({ item, onClose, onUpdate, onDelete, onGoDetail }: {
  item: ContainerItem;
  onClose: () => void;
  onUpdate: (updates: Partial<ContainerItem>) => void;
  onDelete: () => void;
  onGoDetail: () => void;
}) {
  const [editType, setEditType] = useState(item.type);
  const [editQtyPerPallet, setEditQtyPerPallet] = useState(String(item.qtyPerPallet));
  const [editNewPN, setEditNewPN] = useState(item.newPartNumber || '');
  const [editPartNumber, setEditPartNumber] = useState(item.partNumber);
  const [editItemName, setEditItemName] = useState(item.itemName);
  const [editRepresentModel, setEditRepresentModel] = useState(item.representModel);
  const [editDescription, setEditDescription] = useState(item.description || '');
  const [editModelNo, setEditModelNo] = useState(item.modelNo || '');
  const [editPackingQty, setEditPackingQty] = useState(String(item.packingQty));
  const [editTotalQty, setEditTotalQty] = useState(String(item.totalQty));
  const [editCaseCount, setEditCaseCount] = useState(String(item.caseCount));
  const [editGrossWeight, setEditGrossWeight] = useState(String(item.grossWeight || ''));
  const [editCbm, setEditCbm] = useState(String(item.cbm || ''));
  const [editMeasurements, setEditMeasurements] = useState(item.measurements || '');

  // アイテムが変わったらフォームリセット
  useEffect(() => {
    setEditType(item.type);
    setEditQtyPerPallet(String(item.qtyPerPallet));
    setEditNewPN(item.newPartNumber || '');
    setEditPartNumber(item.partNumber);
    setEditItemName(item.itemName);
    setEditRepresentModel(item.representModel);
    setEditDescription(item.description || '');
    setEditModelNo(item.modelNo || '');
    setEditPackingQty(String(item.packingQty));
    setEditTotalQty(String(item.totalQty));
    setEditCaseCount(String(item.caseCount));
    setEditGrossWeight(String(item.grossWeight || ''));
    setEditCbm(String(item.cbm || ''));
    setEditMeasurements(item.measurements || '');
  }, [item]);

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
      newPartNumber: editNewPN || undefined,
      description: editDescription.trim() || undefined,
      modelNo: editModelNo.trim() || undefined,
      grossWeight: Number(editGrossWeight) || undefined,
      cbm: Number(editCbm) || undefined,
      measurements: editMeasurements.trim() || undefined,
    });
    onClose();
  }, [editPartNumber, editItemName, editRepresentModel, editType, editPackingQty, editTotalQty, editCaseCount, editQtyPerPallet, editNewPN, editDescription, editModelNo, editGrossWeight, editCbm, editMeasurements, onUpdate, onClose]);

  const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
  const selectedColors = COLOR_MAP[editType] || COLOR_MAP['その他'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#1e2235', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, width: '94%', maxWidth: 540, maxHeight: '90vh',
        overflow: 'auto', WebkitOverflowScrolling: 'touch',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        {/* ヘッダー: コード+品名（コンパクト） */}
        <div style={{
          padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: `linear-gradient(135deg, ${colors.accent}12 0%, transparent 60%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* コード行 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.accent, flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{item.partNumber}</span>
                {item.newPartNumber && (
                  <span style={{ color: '#a78bfa' }}>{item.newPartNumber}</span>
                )}
              </div>
              {/* 品名（マーキー対応） */}
              <div className="marquee-outer" style={{
                fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.2,
              }}>
                <div className={item.itemName.length > 18 ? 'marquee-scroll' : ''}>
                  <span className="marquee-text">{item.itemName}</span>
                  {item.itemName.length > 18 && (
                    <span className="marquee-text marquee-dup" aria-hidden="true">{item.itemName}</span>
                  )}
                </div>
              </div>
              {item.representModel && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{item.representModel}</div>
              )}
            </div>
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              flexShrink: 0,
            }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* ===== 種類変更 ===== */}
          <div style={{
            marginBottom: 16, padding: 14, borderRadius: 14,
            background: `linear-gradient(135deg, ${selectedColors.accent}18 0%, ${selectedColors.accent}08 100%)`,
            border: `2px solid ${selectedColors.accent}40`,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1, color: selectedColors.accent,
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 4, height: 14, borderRadius: 3, background: selectedColors.accent }} />
              種類
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
            }}>
              {ITEM_TYPES.map((t) => {
                const tc = COLOR_MAP[t];
                const sel = editType === t;
                return (
                  <button key={t} onClick={() => setEditType(t)} style={{
                    padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                    fontSize: 11, fontWeight: sel ? 800 : 500,
                    background: sel ? `${tc.accent}30` : 'rgba(255,255,255,0.04)',
                    border: sel ? `2px solid ${tc.accent}` : '1.5px solid rgba(255,255,255,0.06)',
                    color: sel ? tc.accent : 'rgba(255,255,255,0.5)',
                    transition: 'all 0.15s ease',
                    boxShadow: sel ? `0 0 12px ${tc.accent}25` : 'none',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', background: tc.accent,
                        flexShrink: 0,
                      }} />
                      {t}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== ベース情報 ===== */}
          <SectionHeader title="ベース情報" color="#60a5fa" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 6 }}>
            <div>
              <div style={labelStyle}>気高コード</div>
              <input value={editPartNumber} onChange={(e) => setEditPartNumber(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyle}>規格</div>
              <input value={editItemName} onChange={(e) => setEditItemName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>新建高コード</div>
              <input value={editNewPN} onChange={(e) => setEditNewPN(e.target.value)} placeholder="2TG35401"
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 6 }}>
            <div>
              <div style={labelStyle}>代表機種</div>
              <input value={editRepresentModel} onChange={(e) => setEditRepresentModel(e.target.value)} style={inputStyle} />
            </div>
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
              <div style={labelStyle}>1P数</div>
              <input type="number" inputMode="numeric" value={editQtyPerPallet} onChange={(e) => setEditQtyPerPallet(e.target.value)}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>

          {/* ===== 气高编号（参照・読取専用） ===== */}
          <SectionHeader title="气高编号" color="#a78bfa" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 6 }}>
            <div>
              <div style={labelStyle}>新建高コード</div>
              <div style={roStyle}>{item.newPartNumberKetaka || '—'}</div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyle}>規格</div>
              <div style={roStyle}>{item.itemNameKetaka || '—'}</div>
            </div>
            <div>
              <div style={labelStyle}>紐付状態</div>
              <div style={{
                ...roStyle,
                color: item.linkStatus === '✓' ? '#4ade80' : 'rgba(255,255,255,0.3)',
                fontWeight: 600,
              }}>{item.linkStatus || '—'}</div>
            </div>
          </div>

          {/* ===== コンテナ日程（参照・読取専用） ===== */}
          <SectionHeader title="コンテナ日程" color="#fbbf24" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 6 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyle}>規格</div>
              <div style={roStyle}>{item.itemNameContainer || '—'}</div>
            </div>
            <div>
              <div style={labelStyle}>代表機種</div>
              <div style={roStyle}>{item.representModelContainer || '—'}</div>
            </div>
            <div>
              <div style={labelStyle}>入数</div>
              <div style={roStyle}>{item.packingQtyContainer ?? '—'}</div>
            </div>
            <div>
              <div style={labelStyle}>1P数</div>
              <div style={roStyle}>{item.qtyPerPalletContainer ?? '—'}</div>
            </div>
          </div>

          {/* ===== AQSS（編集可能） ===== */}
          <SectionHeader title="AQSS" color="#34d399" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 6 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyle}>ITEM DESCRIPTION</div>
              <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="UPPER LID ASSY" style={inputStyle} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyle}>MODEL NO.</div>
              <input value={editModelNo} onChange={(e) => setEditModelNo(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
            <div>
              <div style={labelStyle}>G.W. (per carton)</div>
              <input type="number" inputMode="decimal" step="0.01" value={editGrossWeight} onChange={(e) => setEditGrossWeight(e.target.value)}
                placeholder="14.0000" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <div style={labelStyle}>CBM</div>
              <input type="number" inputMode="decimal" step="0.01" value={editCbm} onChange={(e) => setEditCbm(e.target.value)}
                placeholder="0.40" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <div style={labelStyle}>Meas.</div>
              <input value={editMeasurements} onChange={(e) => setEditMeasurements(e.target.value)}
                placeholder="55*38*38" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>

          {/* ボタン */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onGoDetail} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa',
            }}>詳細</button>
            <button onClick={onDelete} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171',
            }}>削除</button>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
            }}>閉じる</button>
            <button onClick={handleSave} style={{
              flex: 1.3, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.15))',
              border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80',
            }}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== テーブル行（タップでポップアップ） ===== */
function EditRow({ item, colors, isContainerMatch, onStartEdit }: {
  item: ContainerItem;
  colors: { accent: string; text: string };
  isContainerMatch?: boolean;
  onStartEdit: () => void;
}) {
  return (
    <button onClick={onStartEdit} className="edit-grid-row" style={{
      width: '100%', padding: '12px 16px',
      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: isContainerMatch ? `${colors.accent}14` : `${colors.accent}08`,
      cursor: 'pointer', textAlign: 'left' as const,
      borderLeft: isContainerMatch ? `3px solid ${colors.accent}` : 'none',
    }}>
      {/* 品名 */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.accent, flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
          {item.itemName}
        </span>
      </span>
      {/* 気高コード */}
      <span style={{
        textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: 'rgba(255,255,255,0.6)',
      }}>
        {item.partNumber || '---'}
      </span>
      {/* 新建高コード */}
      <span style={{
        textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: item.newPartNumber ? 'rgba(167,139,250,0.8)' : 'rgba(255,255,255,0.15)',
      }}>
        {item.newPartNumber || '---'}
      </span>
      {/* 種類 */}
      <span style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, color: colors.accent, background: `${colors.accent}15` }}>
          {item.type}
        </span>
      </span>
      {/* 1P */}
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{item.qtyPerPallet || '-'}</span>
      {/* 入数 */}
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{item.packingQty || '-'}</span>
      {/* G.W. */}
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: item.grossWeight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.15)' }}>
        {item.grossWeight ? item.grossWeight.toFixed(1) : '---'}
      </span>
      {/* CBM */}
      <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: item.cbm ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.15)' }}>
        {item.cbm ? item.cbm.toFixed(2) : '---'}
      </span>
      {/* Meas. */}
      <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: item.measurements ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)' }}>
        {item.measurements || '---'}
      </span>
    </button>
  );
}
