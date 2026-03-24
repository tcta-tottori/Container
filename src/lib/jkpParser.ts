import * as XLSX from 'xlsx';
import { ContainerItem } from './types';

/** JKP Sheet1: 鍋品目リスト */
export interface JkpItem {
  partNumber: string;  // 気高コード (col1)
  itemName: string;    // 品名 (col3)
}

/** JKP 体積Ｍ３シート */
export interface JkpVolume {
  partNumber: string;  // 気高コード (col1)
  itemName: string;    // 品名 (col2)
  measMm: string;      // 箱寸mm (col3)
  packingQty: number;  // 入数 (col4)
  cbmPerPc: number;    // M³/PC (col5)
}

/** JKP updata: 出荷予定 */
export interface JkpShipment {
  partNumber: string;
  itemName: string;
  schedule: Map<string, number | string>; // key: "YYYY-MM-DD" → value: 数量 or メモ
}

/** サイズ自動判定（鍋） */
export function detectNabeSize(itemName: string): string {
  if (!itemName) return '';
  if (itemName.includes('180') || itemName.includes('18')) return '180';
  if (itemName.includes('100') || itemName.includes('10')) return '100';
  return '';
}

/** mm箱寸をcm Meas.文字列に変換 */
function mmToCmMeas(mmStr: string): string {
  // "460460290" → "460*460*290" → "46*46*29"
  // or "460*460*290" → "46*46*29"
  const cleaned = mmStr.replace(/\s/g, '');
  const m = cleaned.match(/(\d+)[*×xX](\d+)[*×xX](\d+)/);
  if (m) {
    return `${Math.round(Number(m[1]) / 10)}*${Math.round(Number(m[2]) / 10)}*${Math.round(Number(m[3]) / 10)}`;
  }
  // 区切りなし: 3桁ずつ分割を試行
  if (/^\d{9,}$/.test(cleaned)) {
    const digits = cleaned;
    // 3桁×3 = 9桁
    if (digits.length === 9) {
      const w = Number(digits.slice(0, 3));
      const d = Number(digits.slice(3, 6));
      const h = Number(digits.slice(6, 9));
      return `${Math.round(w / 10)}*${Math.round(d / 10)}*${Math.round(h / 10)}`;
    }
  }
  return mmStr;
}

/** JKP Sheet1 パース */
export function parseJkpSheet1(wb: XLSX.WorkBook): JkpItem[] {
  const ws = wb.Sheets['Sheet1'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
  const items: JkpItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const partNumber = String(row[1] || '').trim();
    const itemName = String(row[3] || '').trim();
    if (partNumber) items.push({ partNumber, itemName });
  }
  return items;
}

/** JKP 体積Ｍ３ パース */
export function parseJkpVolume(wb: XLSX.WorkBook): Map<string, JkpVolume> {
  const ws = wb.Sheets['体積Ｍ３'];
  if (!ws) return new Map();
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
  const map = new Map<string, JkpVolume>();
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const partNumber = String(row[1] || '').trim();
    if (!partNumber) continue;
    map.set(partNumber, {
      partNumber,
      itemName: String(row[2] || '').trim(),
      measMm: String(row[3] || '').trim(),
      packingQty: Number(row[4]) || 0,
      cbmPerPc: Number(row[5]) || 0,
    });
  }
  return map;
}

/** JKP updataシート: 日付列マッピング構築 + スケジュール抽出 */
export function parseJkpUpdata(wb: XLSX.WorkBook): JkpShipment[] {
  const sheetName = Object.keys(wb.Sheets).find(s => s.includes('updata'));
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const maxCol = Math.min(range.e.c, 3800); // 列数制限

  // ヘッダー行を読み取り: row0, row1, row2
  const getCell = (r: number, c: number): string | number => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    return cell ? (cell.v ?? '') : '';
  };

  // 年月日マッピングを構築
  // row0: 年マーカー (2019, 2020, ...)
  // row2: 日付文字列 ("3/24", "6/1" 等)
  let currentYear = 2026;
  const colDateMap = new Map<number, string>(); // col → "YYYY-MM-DD"

  for (let c = 3; c <= maxCol; c++) {
    const r0 = getCell(0, c);
    if (typeof r0 === 'number' && r0 >= 2014 && r0 <= 2030) {
      currentYear = r0;
    }

    const r2 = String(getCell(2, c)).trim();
    const dateMatch = r2.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (dateMatch) {
      const month = Number(dateMatch[1]);
      const day = Number(dateMatch[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        colDateMap.set(c, dateStr);
      }
    }
  }

  // データ行をパース
  const shipments: JkpShipment[] = [];
  for (let r = 3; r <= range.e.r; r++) {
    const partNumber = String(getCell(r, 1)).trim();
    const itemName = String(getCell(r, 2)).trim();
    if (!partNumber) continue;

    const schedule = new Map<string, number | string>();
    colDateMap.forEach((dateStr, col) => {
      const val = getCell(r, col);
      if (val === '' || val === null || val === undefined) return;
      if (typeof val === 'number' && !isNaN(val) && val > 0) {
        schedule.set(dateStr, val);
      } else if (typeof val === 'string' && val.trim()) {
        schedule.set(dateStr, val.trim());
      }
    });

    if (schedule.size > 0) {
      shipments.push({ partNumber, itemName, schedule });
    }
  }

  return shipments;
}

/** 今日以降の最も近い出荷日を探す */
export function findNearestScheduleDate(shipments: JkpShipment[], today: string): string | null {
  const allDates = new Set<string>();
  for (const s of shipments) {
    s.schedule.forEach((val, date) => {
      if (typeof val === 'number' && val > 0 && date >= today) {
        allDates.add(date);
      }
    });
  }
  if (allDates.size === 0) return null;
  return Array.from(allDates).sort()[0];
}

/** JKP → ContainerItem[]に変換（スケジュール数量付き） */
export function jkpToContainerItems(
  sheet1Items: JkpItem[],
  volumeMap: Map<string, JkpVolume>,
  shipments: JkpShipment[],
  targetDate: string,
): ContainerItem[] {
  // 品番→出荷数量マップ
  const qtyMap = new Map<string, number>();
  for (const s of shipments) {
    const val = s.schedule.get(targetDate);
    if (typeof val === 'number' && val > 0) {
      qtyMap.set(s.partNumber, val);
    }
  }

  return sheet1Items
    .filter((item) => qtyMap.has(item.partNumber))
    .map((item, idx) => {
      const vol = volumeMap.get(item.partNumber);
      const size = detectNabeSize(item.itemName);
      const measurements = vol?.measMm ? mmToCmMeas(vol.measMm) : undefined;
      const totalQty = qtyMap.get(item.partNumber) || 0;
      const packingQty = vol?.packingQty || 0;
      const caseCount = packingQty > 0 ? Math.ceil(totalQty / packingQty) : 0;

      return {
        id: `jkp-${idx}`,
        partNumber: item.partNumber,
        itemName: item.itemName,
        representModel: '',
        type: '鍋' as const,
        size: size || undefined,
        packingQty,
        totalQty,
        caseCount,
        palletCount: 0,
        fraction: caseCount,
        qtyPerPallet: 0,
        cbm: vol?.cbmPerPc || undefined,
        measurements,
      };
    });
}

/** 日付範囲でスケジュールをフィルタ */
export function filterShipmentsByDateRange(
  shipments: JkpShipment[],
  startDate: string,
  endDate: string,
): { partNumber: string; itemName: string; dailyQty: Map<string, number | string>; total: number }[] {
  const results: { partNumber: string; itemName: string; dailyQty: Map<string, number | string>; total: number }[] = [];

  for (const s of shipments) {
    const dailyQty = new Map<string, number | string>();
    let total = 0;

    s.schedule.forEach((val, date) => {
      if (date >= startDate && date <= endDate) {
        dailyQty.set(date, val);
        if (typeof val === 'number') total += val;
      }
    });

    if (dailyQty.size > 0) {
      results.push({
        partNumber: s.partNumber,
        itemName: s.itemName,
        dailyQty,
        total,
      });
    }
  }

  return results.sort((a, b) => b.total - a.total);
}
