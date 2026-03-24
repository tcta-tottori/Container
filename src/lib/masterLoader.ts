import * as XLSX from 'xlsx';
import { ContainerItem, ItemType } from './types';
import { detectItemType } from './typeDetector';

/**
 * CNS品目一覧（全集約版）をパースしてContainerItem[]を返す
 */
export function parseMasterExcel(buffer: ArrayBuffer): ContainerItem[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

  const items: ContainerItem[] = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !Array.isArray(r)) continue;
    const v = (col: number) => r[col] != null ? String(r[col]).trim() : '';
    const n = (col: number) => { const x = Number(r[col]); return isNaN(x) ? 0 : x; };
    const nOpt = (col: number) => { const x = Number(r[col]); return isNaN(x) ? undefined : x; };

    const partNumber = v(1);
    if (!partNumber) continue;

    const itemName = v(2);
    const qtyPerPallet = n(8);
    const type = (v(3) as ItemType) || detectItemType(itemName, qtyPerPallet, 0, partNumber);

    items.push({
      id: `master-${i}`,
      partNumber,
      itemName,
      representModel: v(4),
      type,
      packingQty: n(5),
      totalQty: n(6),
      caseCount: n(7),
      palletCount: 0,
      fraction: 0,
      qtyPerPallet,
      newPartNumber: v(0) || undefined,
      newPartNumberKetaka: v(9) || undefined,
      itemNameKetaka: v(10) || undefined,
      linkStatus: v(11) || undefined,
      itemNameContainer: v(12) || undefined,
      representModelContainer: v(13) || undefined,
      packingQtyContainer: nOpt(14),
      qtyPerPalletContainer: nOpt(15),
      description: v(16) || undefined,
      modelNo: v(17) || undefined,
      grossWeight: nOpt(18),
      cbm: nOpt(19),
      measurements: v(20) || undefined,
    });
  }
  return items;
}

/**
 * AQSS04L/05Lファイルをパースしてマスタデータにマージ
 * AQSS列: ITEM DESCRIPTION, MODEL NO., G.W., CBM, Meas.
 */
export function parseAqssExcel(buffer: ArrayBuffer): Map<string, Partial<ContainerItem>> {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

  const map = new Map<string, Partial<ContainerItem>>();

  // ヘッダー行から品番列とAQSS列を検出
  const header = rows[0] as string[] | undefined;
  if (!header) return map;

  let partCol = -1;
  let descCol = -1, modelCol = -1, gwCol = -1, cbmCol = -1, measCol = -1;

  for (let c = 0; c < header.length; c++) {
    const h = String(header[c] || '').replace(/\n/g, '').trim().toUpperCase();
    if (h.includes('品番') || h.includes('PART') || h.includes('気高') || h.includes('コード')) partCol = c;
    if (h.includes('DESCRIPTION') || h.includes('DESC')) descCol = c;
    if (h.includes('MODEL')) modelCol = c;
    if (h.includes('G.W') || h.includes('GROSS') || h.includes('WEIGHT')) gwCol = c;
    if (h.includes('CBM') || h.includes('容積')) cbmCol = c;
    if (h.includes('MEAS') || h.includes('寸法') || h.includes('外寸')) measCol = c;
  }

  // 品番列が見つからない場合はB列(1)を試す
  if (partCol < 0) partCol = 1;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !Array.isArray(r)) continue;
    const partNumber = String(r[partCol] || '').trim();
    if (!partNumber) continue;

    const updates: Partial<ContainerItem> = {};
    const v = (col: number) => col >= 0 && r[col] != null ? String(r[col]).trim() : '';
    const n = (col: number) => { if (col < 0) return undefined; const x = Number(r[col]); return isNaN(x) ? undefined : x; };

    if (v(descCol)) updates.description = v(descCol);
    if (v(modelCol)) updates.modelNo = v(modelCol);
    if (n(gwCol) !== undefined) updates.grossWeight = n(gwCol);
    if (n(cbmCol) !== undefined) updates.cbm = n(cbmCol);
    if (v(measCol)) updates.measurements = v(measCol);

    if (Object.keys(updates).length > 0) {
      map.set(partNumber, updates);
    }
  }
  return map;
}

/**
 * public/data/からCNS品目一覧を自動取得
 */
export async function fetchMasterData(): Promise<ContainerItem[]> {
  try {
    const basePath = typeof window !== 'undefined'
      ? (document.querySelector('base')?.href || window.location.origin + '/')
      : '/';
    const url = new URL('data/CNS_品目一覧_全集約版.xlsx', basePath).href;
    const res = await fetch(url);
    if (!res.ok) return [];
    const buffer = await res.arrayBuffer();
    return parseMasterExcel(buffer);
  } catch {
    return [];
  }
}
