import * as XLSX from 'xlsx';
import { Container, ContainerItem } from './types';
import { detectItemType } from './typeDetector';
import { sortItems } from './sorter';

export interface ParseResult {
  containers: Container[];
  errors: string[];
}

/**
 * Excelシリアル値を Date に変換する
 * Excel のシリアル値は 1900-01-01 を 1 とした日数
 */
function excelSerialToDate(serial: number): Date {
  // Excel の 1900 年うるう年バグ対応（1900-02-29 が存在する扱い）
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 86400 * 1000);
}

/** Date を YYYY-MM-DD 形式にフォーマット */
function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 値を数値に変換（空文字・undefined → 0） */
function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** 1行のデータから ContainerItem を生成 */
function createContainerItem(
  row: unknown[],
  containerNo: string,
  rowIndex: number
): ContainerItem {
  const partNumber = String(row[2] || '');
  const itemName = String(row[3] || '');
  const representModel = String(row[4] || '');
  const packingQty = toNumber(row[5]);
  const totalQty = toNumber(row[6]);
  const caseCount = toNumber(row[7]);
  const palletCount = toNumber(row[8]);
  const fraction = toNumber(row[9]);
  const qtyPerPallet = toNumber(row[10]);

  const type = detectItemType(itemName, qtyPerPallet, palletCount, partNumber);

  return {
    id: `${containerNo}-${rowIndex}`,
    partNumber,
    itemName,
    representModel,
    type,
    packingQty,
    totalQty,
    caseCount,
    palletCount,
    fraction,
    qtyPerPallet,
  };
}

/** 同一品番＋品名のアイテムを合算する */
function mergeItems(items: ContainerItem[]): ContainerItem[] {
  const map = new Map<string, ContainerItem>();
  for (const item of items) {
    const key = `${item.partNumber}::${item.itemName}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalQty += item.totalQty;
      existing.caseCount += item.caseCount;
      existing.palletCount += item.palletCount;
      existing.fraction += item.fraction;
      // qtyPerPallet, packingQty は同じ品目なので最初の値を維持
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

/**
 * Excel ファイルをブラウザ内でパースし、コンテナデータを返す
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // 「内容」シートを探す
  const wsName =
    wb.SheetNames.find((n) => n.includes('内容')) || wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  if (!ws) {
    return { containers: [], errors: ['「内容」シートが見つかりません'] };
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

  const containers: Container[] = [];
  const errors: string[] = [];
  let current: Container | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const aVal = row[0]; // A列: 日付（シリアル値 or Date）
    const bVal = row[1]; // B列: コンテナ番号
    const dVal = row[3]; // D列: 品名

    // A列に数値があればコンテナ先頭行
    if (aVal != null && typeof aVal === 'number' && aVal > 40000) {
      if (current) containers.push(current);
      const date = excelSerialToDate(aVal);
      current = {
        date: formatDate(date),
        containerNo: String(bVal || ''),
        items: [],
      };
    }

    // D列に品名があればアイテム行（ヘッダー行を除外）
    if (dVal && typeof dVal === 'string' && dVal.trim() !== '' && current) {
      // ヘッダー行 (i === 0) はスキップ
      if (i === 0) continue;
      const item = createContainerItem(
        row,
        current.containerNo,
        i
      );
      current.items.push(item);
    }
  }
  if (current && current.items.length > 0) {
    containers.push(current);
  }

  // 同一コンテナ内の同一品番・同一品名を合算
  for (const c of containers) {
    c.items = mergeItems(c.items);
  }

  // 各コンテナの品目を並べ替え
  for (const c of containers) {
    c.items = sortItems(c.items);
  }

  if (containers.length === 0) {
    errors.push('コンテナデータが見つかりませんでした');
  }

  return { containers, errors };
}
