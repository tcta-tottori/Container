import * as XLSX from 'xlsx';
import { ContainerItem } from './types';

/** JKP Sheet1: 鍋品目リスト */
export interface JkpItem {
  partNumber: string;  // 気高コード
  itemName: string;    // 品名
}

/** JKP 体積Ｍ３シート */
export interface JkpVolume {
  partNumber: string;  // 気高コード
  itemName: string;    // 品名
  measMm: string;      // 箱寸mm
  packingQty: number;  // 入数
  cbmPerPc: number;    // M³/PC
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
  const cleaned = mmStr.replace(/\s/g, '');
  const m = cleaned.match(/(\d+)[*×xX](\d+)[*×xX](\d+)/);
  if (m) {
    return `${Math.round(Number(m[1]) / 10)}*${Math.round(Number(m[2]) / 10)}*${Math.round(Number(m[3]) / 10)}`;
  }
  if (/^\d{9,}$/.test(cleaned) && cleaned.length === 9) {
    const w = Number(cleaned.slice(0, 3));
    const d = Number(cleaned.slice(3, 6));
    const h = Number(cleaned.slice(6, 9));
    return `${Math.round(w / 10)}*${Math.round(d / 10)}*${Math.round(h / 10)}`;
  }
  return mmStr;
}

/** シート名を柔軟に検索（大文字小文字・空白・全角半角を無視） */
function findSheet(wb: XLSX.WorkBook, ...candidates: string[]): XLSX.WorkSheet | null {
  const names = Object.keys(wb.Sheets);
  // 完全一致優先
  for (const cand of candidates) {
    if (wb.Sheets[cand]) return wb.Sheets[cand];
  }
  // 正規化一致
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[\s\u3000]/g, '').replace(/[Ｍｍ]/g, 'm').replace(/[３3]/g, '3');
  for (const cand of candidates) {
    const nc = normalize(cand);
    const found = names.find(n => normalize(n) === nc);
    if (found) return wb.Sheets[found];
  }
  // 部分一致
  for (const cand of candidates) {
    const nc = normalize(cand);
    const found = names.find(n => normalize(n).includes(nc));
    if (found) return wb.Sheets[found];
  }
  return null;
}

/** セルヘルパー */
function cellReader(ws: XLSX.WorkSheet) {
  return (r: number, c: number): string | number => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    return cell ? (cell.v ?? '') : '';
  };
}

/** 3TG気高コードか判定 */
function is3tgCode(val: string): boolean {
  return /^3TG\d{3}[A-Z]\d{5}$/i.test(val);
}

// ──────────────────────────────────────────────────────────
// Sheet1 パース
// ──────────────────────────────────────────────────────────

/** JKP Sheet1 パース
 *  実際のフォーマット: ヘッダーなし、col0=品番, col2=品名
 */
export function parseJkpSheet1(wb: XLSX.WorkBook): JkpItem[] {
  const ws = findSheet(wb, 'Sheet1', 'sheet1', 'Sheet 1');
  if (!ws) {
    console.warn('[JKP] Sheet1が見つかりません。シート一覧:', Object.keys(wb.Sheets));
    return [];
  }
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
  const items: JkpItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // col0 or col1 に品番、col2 or col3 に品名（柔軟に検索）
    let partNumber = '';
    let itemName = '';
    for (let c = 0; c < Math.min(row.length, 5); c++) {
      const val = String(row[c] || '').trim();
      if (!val) continue;
      if (!partNumber && is3tgCode(val)) {
        partNumber = val;
      } else if (partNumber && !itemName && val) {
        itemName = val;
      }
    }
    if (partNumber) items.push({ partNumber, itemName });
  }
  console.log(`[JKP] Sheet1: ${items.length}品目検出`);
  return items;
}

// ──────────────────────────────────────────────────────────
// 体積Ｍ３ パース
// ──────────────────────────────────────────────────────────

export function parseJkpVolume(wb: XLSX.WorkBook): Map<string, JkpVolume> {
  const ws = findSheet(wb, '体積Ｍ３', '体積M3', '体積m3');
  if (!ws) {
    console.warn('[JKP] 体積シートが見つかりません。シート一覧:', Object.keys(wb.Sheets));
    return new Map();
  }
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
  const map = new Map<string, JkpVolume>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // col1に品番がある行を探す
    const partNumber = String(row[1] || '').trim();
    if (!partNumber || !is3tgCode(partNumber)) continue;
    map.set(partNumber, {
      partNumber,
      itemName: String(row[2] || '').trim(),
      measMm: String(row[3] || '').trim(),
      packingQty: Number(row[4]) || 0,
      cbmPerPc: Number(row[5]) || 0,
    });
  }
  console.log(`[JKP] 体積M3: ${map.size}品目検出`);
  return map;
}

// ──────────────────────────────────────────────────────────
// updata シートパース（自動構造検出）
// ──────────────────────────────────────────────────────────

export function parseJkpUpdata(wb: XLSX.WorkBook): JkpShipment[] {
  const sheetName = Object.keys(wb.Sheets).find(s =>
    s.toLowerCase().includes('updata')
  );
  if (!sheetName) {
    console.warn('[JKP] updataシートが見つかりません。シート一覧:', Object.keys(wb.Sheets));
    return [];
  }
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const maxCol = Math.min(range.e.c, 3800);
  const getCell = cellReader(ws);

  // ──── Step 1: 日付行を自動検出（"M/D" パターンが3つ以上連続する行） ────
  let dateRow = -1;
  for (let r = 0; r <= Math.min(range.e.r, 20); r++) {
    let consecutive = 0;
    for (let c = 10; c <= Math.min(maxCol, 50); c++) {
      const v = String(getCell(r, c)).trim();
      if (/^\d{1,2}\/\d{1,2}$/.test(v)) {
        consecutive++;
        if (consecutive >= 3) { dateRow = r; break; }
      } else {
        consecutive = 0;
      }
    }
    if (dateRow >= 0) break;
  }
  if (dateRow < 0) {
    console.warn('[JKP] 日付行が見つかりません');
    return [];
  }
  console.log(`[JKP] 日付行: row${dateRow}`);

  // ──── Step 2: 年マーカー行を自動検出（dateRowより上で2014-2030の数値がある行） ────
  let yearRow = -1;
  for (let r = 0; r < dateRow; r++) {
    for (let c = 3; c <= maxCol; c++) {
      const v = getCell(r, c);
      if (typeof v === 'number' && v >= 2014 && v <= 2030) {
        yearRow = r;
        break;
      }
    }
    if (yearRow >= 0) break;
  }
  console.log(`[JKP] 年マーカー行: ${yearRow >= 0 ? 'row' + yearRow : '見つからず (デフォルト使用)'}`);

  // ──── Step 3: 列→日付マッピング構築 ────
  let currentYear = new Date().getFullYear();
  const colDateMap = new Map<number, string>();

  for (let c = 3; c <= maxCol; c++) {
    // 年マーカーを更新
    if (yearRow >= 0) {
      const yr = getCell(yearRow, c);
      if (typeof yr === 'number' && yr >= 2014 && yr <= 2030) {
        currentYear = yr;
      }
    }
    // 日付セルを読み取り
    const dv = String(getCell(dateRow, c)).trim();
    const dm = dv.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (dm) {
      const month = Number(dm[1]);
      const day = Number(dm[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        colDateMap.set(c, dateStr);
      }
    }
  }
  console.log(`[JKP] 日付列: ${colDateMap.size}列検出`);

  // ──── Step 4: データ開始行を自動検出（3TGコードが初めて出現する行） ────
  let dataStartRow = dateRow + 1;
  for (let r = dateRow + 1; r <= Math.min(range.e.r, dateRow + 20); r++) {
    const c1 = String(getCell(r, 1)).trim();
    if (is3tgCode(c1)) {
      dataStartRow = r;
      break;
    }
  }
  console.log(`[JKP] データ開始行: row${dataStartRow}`);

  // ──── Step 5: データ行をパース ────
  // 3行1組パターン: [3TGコード行, 品名行, 内部コード行]
  // 数量はどの行にも出現しうる → 3TGコードをキーに集約
  const shipmentMap = new Map<string, JkpShipment>();
  let currentPartNumber = '';
  let currentItemName = '';

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const col1 = String(getCell(r, 1)).trim();
    if (!col1) continue;

    // 3TGコード行 → 新しい品目の開始
    if (is3tgCode(col1)) {
      currentPartNumber = col1;
      currentItemName = '';
      continue;
    }

    // 品名行の判定（3TGコードの直後、JKP/JPI/JRI/JPB/JPV/JPK/JPD/JPC/JPT/JRIで始まるか英字で始まる）
    if (currentPartNumber && !currentItemName) {
      currentItemName = col1;
      // この品番をまだ登録していなければ登録
      if (!shipmentMap.has(currentPartNumber)) {
        shipmentMap.set(currentPartNumber, {
          partNumber: currentPartNumber,
          itemName: currentItemName,
          schedule: new Map(),
        });
      }
    }

    // 数量データを収集（この行に数値があれば現在の品番に紐付け）
    if (!currentPartNumber) continue;
    const shipment = shipmentMap.get(currentPartNumber);
    if (!shipment) continue;

    colDateMap.forEach((dateStr, col) => {
      const val = getCell(r, col);
      if (typeof val === 'number' && !isNaN(val) && val > 0) {
        // 既存値があれば合算（複数行にまたがる場合）
        const existing = shipment.schedule.get(dateStr);
        if (typeof existing === 'number') {
          shipment.schedule.set(dateStr, existing + val);
        } else {
          shipment.schedule.set(dateStr, val);
        }
      } else if (typeof val === 'string' && val.trim() && !shipment.schedule.has(dateStr)) {
        shipment.schedule.set(dateStr, val.trim());
      }
    });
  }

  // スケジュールが空の品目を除外
  const shipments = Array.from(shipmentMap.values()).filter(s => s.schedule.size > 0);
  console.log(`[JKP] updata: ${shipments.length}品目 (うちスケジュールあり)`);
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
  // 品番→出荷数量マップ（updataから）
  const qtyMap = new Map<string, number>();
  const nameMap = new Map<string, string>();
  for (const s of shipments) {
    const val = s.schedule.get(targetDate);
    if (typeof val === 'number' && val > 0) {
      qtyMap.set(s.partNumber, val);
      nameMap.set(s.partNumber, s.itemName);
    }
  }

  // Sheet1の品目と結合（Sheet1にない品目もupdataから追加）
  const sheet1PartNumbers = new Set(sheet1Items.map(it => it.partNumber));
  const allPartNumbers: string[] = [];
  sheet1PartNumbers.forEach(pn => allPartNumbers.push(pn));
  qtyMap.forEach((_v, pn) => { if (!sheet1PartNumbers.has(pn)) allPartNumbers.push(pn); });

  const items: ContainerItem[] = [];
  let idx = 0;

  for (const pn of allPartNumbers) {
    const qty = qtyMap.get(pn);
    if (!qty || qty <= 0) continue;

    // 品名: Sheet1 → updata → 体積シートの順で取得
    const s1 = sheet1Items.find(it => it.partNumber === pn);
    const vol = volumeMap.get(pn);
    const itemName = s1?.itemName || nameMap.get(pn) || vol?.itemName || pn;
    const size = detectNabeSize(itemName);
    const measurements = vol?.measMm ? mmToCmMeas(vol.measMm) : undefined;
    const packingQty = vol?.packingQty || 0;
    const caseCount = packingQty > 0 ? Math.ceil(qty / packingQty) : 0;

    items.push({
      id: `jkp-${idx++}`,
      partNumber: pn,
      itemName,
      representModel: '',
      type: '鍋' as const,
      size: size || undefined,
      packingQty,
      totalQty: qty,
      caseCount,
      palletCount: 0,
      fraction: caseCount,
      qtyPerPallet: 0,
      cbm: vol?.cbmPerPc || undefined,
      measurements,
    });
  }

  console.log(`[JKP] ContainerItems: ${items.length}品目 (日付: ${targetDate})`);
  return items;
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
