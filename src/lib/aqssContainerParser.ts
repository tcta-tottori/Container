/**
 * AQSS04L (Invoice) / AQSS05L (Packing List) からContainerItem[]を生成
 *
 * Invoice: 品番(新建高)、品名(ITEM)、数量、DESCRIPTION
 * Packing: ケース数、G.W.、CBM、Meas.、MODEL NO.
 *
 * 同一品番の行は数量・ケース数を合算して1アイテムにまとめる
 */

import * as XLSX from 'xlsx';
import { ContainerItem, Container } from './types';
import { detectItemType } from './typeDetector';

/** Invoice行データ */
interface InvoiceRow {
  partNumber: string;   // 新建高コード (PARTS NO)
  description: string;  // ITEM DESCRIPTION
  itemName: string;     // ITEM (モデル名)
  quantity: number;     // QUANTITY
}

/** Packing行データ（2行ペア） */
interface PackingRow {
  lotNo: string;
  description: string;  // ITEM DESCRIPTION
  modelNo: string;      // MODEL NO.
  quantity: number;      // 個数
  cartons: number;       // ケース数
  gwPerUnit: number;     // G.W. per carton
  measurements: string;  // 寸法 (e.g., "47.5*30*29.5")
  totalCbm: number;      // 合計CBM
}

/** AQSS04L (Invoice) をパース */
function parseInvoice(wb: XLSX.WorkBook): {
  rows: InvoiceRow[];
  date: string;
  invoiceNo: string;
  deliveryNo: string;
} {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], date: '', invoiceNo: '', deliveryNo: '' };
  const allRows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });

  let date = '';
  let invoiceNo = '';
  let deliveryNo = '';

  // ヘッダー情報を抽出（行0〜15）
  for (let i = 0; i < Math.min(allRows.length, 16); i++) {
    const r = allRows[i];
    if (!r) continue;
    const s = (col: number) => String(r[col] || '').trim();
    // DATE
    if (s(11).includes('DATE') && s(13)) {
      const raw = s(13);
      // "2026/03/04" or serial
      const dateMatch = raw.match(/(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
      if (dateMatch) {
        date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
    }
    // INVOICE No
    if (s(11).includes('INVOICE') && s(13)) invoiceNo = s(13);
    // DELIVERY RECEIPT NO
    if (s(11).includes('DELIVERY') && s(13)) deliveryNo = s(13);
  }

  // データ行を検出（NO.列に数字がある行）
  const rows: InvoiceRow[] = [];
  for (let i = 16; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r) continue;
    const no = Number(r[0]);
    if (isNaN(no) || no <= 0) continue;

    const partNumber = String(r[8] || '').trim();
    if (!partNumber) continue;

    rows.push({
      partNumber,
      description: String(r[1] || '').trim(),
      itemName: String(r[4] || '').trim(),
      quantity: Number(r[10]) || 0,
    });
  }

  return { rows, date, invoiceNo, deliveryNo };
}

/** AQSS05L (Packing List) をパース */
function parsePackingList(wb: XLSX.WorkBook): PackingRow[] {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const allRows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });

  // データ行を検出（2行ペア: ヘッダ行 + 詳細行）
  const items: PackingRow[] = [];
  let i = 16; // ヘッダー行以降
  while (i < allRows.length - 1) {
    const r1 = allRows[i];
    const r2 = allRows[i + 1];
    if (!r1 || !r2) { i++; continue; }

    const lotNo = String(r1[0] || '').trim();
    // LOT NOがある行 = ペアのヘッダ行
    if (!lotNo || lotNo === 'LOT NO.') { i++; continue; }

    const cartons = Number(r1[7]) || 0;
    const gwPerUnit = Number(r1[12]) || 0;
    const meas = String(r1[14] || '').trim();

    const modelNo = String(r2[2] || '').trim();
    const quantity = Number(r2[5]) || 0;
    const totalCbm = Number(r2[14]) || 0;

    items.push({
      lotNo,
      description: String(r1[2] || '').trim(),
      modelNo,
      quantity,
      cartons,
      gwPerUnit,
      measurements: meas,
      totalCbm,
    });

    i += 2;
  }

  return items;
}

/**
 * AQSS Invoice (+ optional Packing) → Container を生成
 *
 * @param invoiceFile AQSS04L ファイル
 * @param packingFile AQSS05L ファイル（オプション）
 */
export async function parseAqssToContainer(
  invoiceFile: File,
  packingFile?: File,
): Promise<Container | null> {
  const invBuf = await invoiceFile.arrayBuffer();
  const invWb = XLSX.read(invBuf, { type: 'array' });
  const { rows: invRows, date, invoiceNo, deliveryNo } = parseInvoice(invWb);

  if (invRows.length === 0) return null;

  // Packing Listがあればパース
  let packingRows: PackingRow[] = [];
  if (packingFile) {
    const pkBuf = await packingFile.arrayBuffer();
    const pkWb = XLSX.read(pkBuf, { type: 'array' });
    packingRows = parsePackingList(pkWb);
  }

  // Invoice行を品番でグループ化（同一品番の数量を合算）
  const groupMap = new Map<string, {
    partNumber: string;
    description: string;
    itemName: string;
    totalQty: number;
    rows: InvoiceRow[];
  }>();

  for (const row of invRows) {
    const existing = groupMap.get(row.partNumber);
    if (existing) {
      existing.totalQty += row.quantity;
      existing.rows.push(row);
    } else {
      groupMap.set(row.partNumber, {
        partNumber: row.partNumber,
        description: row.description,
        itemName: row.itemName,
        totalQty: row.quantity,
        rows: [row],
      });
    }
  }

  // Packing行も品番ベースでマージ（ModelNoで紐付）
  // Invoice側のITEM名とPacking側のMODEL NOでマッチ
  // Packing行も同一MODELで合算
  const packingByModel = new Map<string, {
    cartons: number;
    gwPerUnit: number;
    measurements: string;
    totalCbm: number;
    totalQty: number;
  }>();

  for (const pk of packingRows) {
    const key = pk.modelNo;
    if (!key) continue;
    const existing = packingByModel.get(key);
    if (existing) {
      existing.cartons += pk.cartons;
      existing.totalCbm += pk.totalCbm;
      existing.totalQty += pk.quantity;
      // measurements, gwPerUnit は同一モデルなら同じはず
    } else {
      packingByModel.set(key, {
        cartons: pk.cartons,
        gwPerUnit: pk.gwPerUnit,
        measurements: pk.measurements,
        totalCbm: pk.totalCbm,
        totalQty: pk.quantity,
      });
    }
  }

  // ContainerItem[] を作成
  const items: ContainerItem[] = [];
  let idx = 0;
  const containerNo = deliveryNo || invoiceNo || 'AQSS';

  const groupEntries = Array.from(groupMap.entries());
  for (const [pn, group] of groupEntries) {
    // Packing情報をモデル名で検索
    // Invoice ITEM "PDR-G221 色柄(W)" → Packing MODEL "PDR-G221 (W)" のマッチ
    // 部分一致で検索（最初のモデル名部分）
    let packingInfo: { cartons: number; gwPerUnit: number; measurements: string; totalCbm: number; totalQty: number } | undefined;
    const modelPrefix = group.itemName.replace(/色柄/g, '').replace(/\s+/g, ' ').trim();
    const packingEntries = Array.from(packingByModel.entries());
    for (const [modelKey, info] of packingEntries) {
      // モデル名の先頭部分（空白前）でマッチ
      const pkPrefix = modelKey.split(/\s/)[0].replace(/[()（）]/g, '');
      const invPrefix = modelPrefix.split(/\s/)[0].replace(/[()（）]/g, '');
      if (pkPrefix === invPrefix || modelKey.includes(invPrefix) || modelPrefix.includes(pkPrefix)) {
        packingInfo = info;
        break;
      }
    }

    const caseCount = packingInfo?.cartons || 0;
    const measurements = packingInfo?.measurements || undefined;
    const cbmTotal = packingInfo?.totalCbm || 0;
    const cbmPerPc = packingInfo && packingInfo.totalQty > 0
      ? cbmTotal / packingInfo.totalQty
      : undefined;
    const gwPerUnit = packingInfo?.gwPerUnit || undefined;
    // 入数 = 総数 / ケース数 (小数切り上げ)
    const packingQty = caseCount > 0 ? Math.round(group.totalQty / caseCount) : 0;

    const type = detectItemType(group.itemName, 0, 0, pn, group.description);

    items.push({
      id: `aqss-${idx++}`,
      partNumber: pn,  // 新建高コード → linkItemsWithMaster で気高コードに変換
      itemName: group.itemName,
      representModel: '',
      type,
      packingQty,
      totalQty: group.totalQty,
      caseCount,
      palletCount: 0,
      fraction: caseCount,
      qtyPerPallet: 0,
      description: group.description || undefined,
      grossWeight: gwPerUnit || undefined,
      cbm: cbmPerPc || undefined,
      measurements,
    });
  }

  return {
    date: date || new Date().toISOString().slice(0, 10),
    containerNo,
    items,
  };
}
