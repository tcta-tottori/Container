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

/**
 * セルの値を入荷日 (YYYY-MM-DD) として解釈する
 * - Excelシリアル値（数値）
 * - Date オブジェクト（cellDates 有効時）
 * - 文字列の日付 (2026/07/05, 2026-07-05 等)
 * 日付として解釈できなければ null
 */
function parseDateCell(val: unknown): string | null {
  if (val == null || val === '') return null;

  if (typeof val === 'number') {
    // 1970-01-01(25569) 〜 2100年頃(73000) の範囲のみ日付とみなす
    if (val > 25569 && val < 73000) return formatDate(excelSerialToDate(val));
    return null;
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    return formatDate(val);
  }

  if (typeof val === 'string') {
    const m = val.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
  }

  return null;
}

/** コンテナ番号らしい値か判定（例: 26K0705） */
function isContainerNoCell(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^\d{2}[A-Za-z]\d{3,5}$/.test(val.trim());
}

/**
 * A列・B列から「入荷日」と「コンテナ番号」を取り出す
 * ファイルによって A=日付/B=コンテナ番号 と A=コンテナ番号/B=日付 の
 * どちらのレイアウトもあるため、日付として解釈できた側を日付とする
 */
function readContainerHeader(
  aVal: unknown,
  bVal: unknown
): { date: string; containerNo: string } | null {
  const dateA = parseDateCell(aVal);
  if (dateA !== null) {
    return { date: dateA, containerNo: String(bVal ?? '').trim() };
  }
  const dateB = parseDateCell(bVal);
  if (dateB !== null) {
    return { date: dateB, containerNo: String(aVal ?? '').trim() };
  }
  // 日付が無くコンテナ番号だけある行にも対応
  if (isContainerNoCell(aVal)) {
    return { date: '', containerNo: String(aVal).trim() };
  }
  if (isContainerNoCell(bVal)) {
    return { date: '', containerNo: String(bVal).trim() };
  }
  return null;
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

    const aVal = row[0]; // A列: 日付 or コンテナ番号（ファイルによって入れ替わる）
    const bVal = row[1]; // B列: コンテナ番号 or 日付
    const cVal = row[2]; // C列: 品番
    const dVal = row[3]; // D列: 品名

    // A列・B列に日付／コンテナ番号があればコンテナ先頭行
    const header = readContainerHeader(aVal, bVal);
    if (header && (header.date !== '' || header.containerNo !== '')) {
      if (current && current.items.length > 0) containers.push(current);
      current = {
        date: header.date,
        containerNo: header.containerNo,
        items: [],
      };
    }

    // ヘッダー行（品番／品名の見出し）はスキップ
    if (cVal === '品番' || dVal === '品名') continue;

    // D列に品名があればアイテム行
    if (dVal && typeof dVal === 'string' && dVal.trim() !== '' && current) {
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
