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

/** GitHub Raw URL（最新マスタデータ取得用） */
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/tcta-tottori/Container/main/public/data/CNS_%E5%93%81%E7%9B%AE%E4%B8%80%E8%A6%A7_%E5%85%A8%E9%9B%86%E7%B4%84%E7%89%88.xlsx';

/**
 * CNS品目一覧を取得（GitHub Raw → ローカルの順でフォールバック）
 * cache-busting付きでキャッシュを回避
 */
export async function fetchMasterData(): Promise<ContainerItem[]> {
  const bust = `?t=${Date.now()}`;

  // 1. GitHubから最新を取得（キャッシュ回避）
  try {
    const res = await fetch(GITHUB_RAW_URL + bust, { cache: 'no-store' });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const items = parseMasterExcel(buffer);
      if (items.length > 0) return items;
    }
  } catch { /* GitHubが使えない場合はローカルにフォールバック */ }

  // 2. ローカル public/data/ からフォールバック
  try {
    const basePath = typeof window !== 'undefined'
      ? (document.querySelector('base')?.href || window.location.origin + '/')
      : '/';
    const url = new URL('data/CNS_品目一覧_全集約版.xlsx', basePath).href;
    const res = await fetch(url + bust, { cache: 'no-store' });
    if (!res.ok) return [];
    const buffer = await res.arrayBuffer();
    return parseMasterExcel(buffer);
  } catch {
    return [];
  }
}

/**
 * マスタデータとコンテナ品目を紐付する（同期処理）
 *
 * 紐付キー:
 *   1. 気高コード(partNumber) → マスタの partNumber (B列) で完全一致
 *   2. 新建高コード → マスタの newPartNumber (A列) で完全一致
 *   （AQSS04Lファイルでは partNumber が新建高コードの場合がある）
 *
 * 紐付されるフィールド:
 *   newPartNumber, newPartNumberKetaka, itemNameKetaka, linkStatus,
 *   itemNameContainer, representModelContainer, packingQtyContainer,
 *   qtyPerPalletContainer, description, modelNo, grossWeight, cbm, measurements
 *
 * @returns 紐付後のアイテム配列（新しい配列を返す）と紐付結果ログ
 */
export function linkItemsWithMaster(
  items: ContainerItem[],
  masterItems: ContainerItem[],
): { linkedItems: ContainerItem[]; linked: number; unlinked: number; total: number } {
  if (masterItems.length === 0) {
    return { linkedItems: items, linked: 0, unlinked: items.length, total: items.length };
  }

  // マスタの検索用Map（気高コード→マスタ, 新建高コード→マスタ）
  const byPartNumber = new Map<string, ContainerItem>();
  const byNewPartNumber = new Map<string, ContainerItem>();
  for (const m of masterItems) {
    if (m.partNumber) byPartNumber.set(m.partNumber, m);
    if (m.newPartNumber) byNewPartNumber.set(m.newPartNumber, m);
  }

  let linked = 0;
  const linkedItems = items.map((item) => {
    // 1. 気高コードで検索
    let master = byPartNumber.get(item.partNumber);

    // 2. 見つからなければ新建高コードとして検索
    if (!master) {
      master = byNewPartNumber.get(item.partNumber);
    }

    if (!master) return item;

    linked++;
    const updated = { ...item };

    // 気高コードでマッチした場合: マスタのpartNumberが気高コード
    // 新建高コードでマッチした場合: itemのpartNumberが新建高コード → マスタのpartNumberを気高コードとして設定
    if (master.partNumber !== item.partNumber) {
      // 新建高コードでマッチ → マスタのpartNumberが本来の気高コード
      updated.newPartNumber = item.partNumber; // 元のコードが新建高
      updated.partNumber = master.partNumber;  // マスタの気高コードを正とする
    }

    // マスタから全フィールドをコピー
    if (master.newPartNumber) updated.newPartNumber = master.newPartNumber;
    if (master.newPartNumberKetaka) updated.newPartNumberKetaka = master.newPartNumberKetaka;
    if (master.itemNameKetaka) updated.itemNameKetaka = master.itemNameKetaka;
    if (master.linkStatus) updated.linkStatus = master.linkStatus;
    if (master.itemNameContainer) updated.itemNameContainer = master.itemNameContainer;
    if (master.representModelContainer) updated.representModelContainer = master.representModelContainer;
    if (master.packingQtyContainer !== undefined) updated.packingQtyContainer = master.packingQtyContainer;
    if (master.qtyPerPalletContainer !== undefined) updated.qtyPerPalletContainer = master.qtyPerPalletContainer;
    if (master.description) updated.description = master.description;
    if (master.modelNo) updated.modelNo = master.modelNo;
    if (master.grossWeight !== undefined) updated.grossWeight = master.grossWeight;
    if (master.cbm !== undefined) updated.cbm = master.cbm;
    if (master.measurements) updated.measurements = master.measurements;

    // 1P数がマスタにあり、作業データにない場合はマスタから補完
    if (master.qtyPerPallet > 0 && updated.qtyPerPallet === 0) {
      updated.qtyPerPallet = master.qtyPerPallet;
    }
    // 入数もマスタから補完
    if (master.packingQty > 0 && updated.packingQty === 0) {
      updated.packingQty = master.packingQty;
    }

    return updated;
  });

  return {
    linkedItems,
    linked,
    unlinked: items.length - linked,
    total: items.length,
  };
}

/**
 * マスタデータの取得 → 紐付を一括で行うヘルパー
 * 読込実行時に呼ぶ。確実にマスタを取得してから紐付を行う。
 */
export async function fetchAndLinkMaster(
  items: ContainerItem[],
): Promise<{
  masterItems: ContainerItem[];
  linkedItems: ContainerItem[];
  linked: number;
  unlinked: number;
  total: number;
}> {
  const masterItems = await fetchMasterData();
  const result = linkItemsWithMaster(items, masterItems);
  return { masterItems, ...result };
}
