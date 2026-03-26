import * as XLSX from 'xlsx';
import { ContainerItem, ItemType } from './types';
import { detectItemType } from './typeDetector';
import { getStoredToken } from './githubSave';

const REPO_OWNER = 'tcta-tottori';
const REPO_NAME = 'Container';
const MASTER_FILE_PATH = 'CNS_品目一覧_全集約版.xlsx';
const JKP_FILE_PATH = 'JKP_Shipping Schedule.xlsx';
const BRANCH = 'main';

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
    const sizeStr = v(9) || undefined;   // J列: サイズ (100, 180 等)
    const storedType = v(3) as ItemType;
    const description = v(17) || undefined;  // ITEM DESCRIPTION (R列)
    const itemNameKetaka = v(11) || undefined;  // 規格(气高编号) (L列)
    // D列に値があればそれを最優先、なければ自動判定
    const type = storedType
      ? storedType
      : detectItemType(itemName, qtyPerPallet, 0, partNumber, description, itemNameKetaka);

    items.push({
      id: `master-${i}`,
      partNumber,
      itemName,
      representModel: v(4),
      type,
      size: sizeStr,
      packingQty: n(5),
      totalQty: n(6),
      caseCount: n(7),
      palletCount: 0,
      fraction: 0,
      qtyPerPallet,
      newPartNumber: v(0) || undefined,
      newPartNumberKetaka: v(10) || undefined,  // K列
      itemNameKetaka: v(11) || undefined,        // L列
      linkStatus: v(12) || undefined,            // M列
      itemNameContainer: v(13) || undefined,     // N列
      representModelContainer: v(14) || undefined, // O列
      packingQtyContainer: nOpt(15),             // P列
      qtyPerPalletContainer: nOpt(16),           // Q列
      description: v(17) || undefined,           // R列
      modelNo: v(18) || undefined,               // S列
      grossWeight: nOpt(19),                     // T列
      cbm: nOpt(20),                             // U列
      measurements: v(21) || undefined,          // V列
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
 * GitHub Contents API でファイルを取得（バイナリ）
 * トークン付きで認証し、確実に最新データを返す
 */
async function fetchGitHubFile(filePath: string, token?: string): Promise<ArrayBuffer | null> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filePath)}?ref=${BRANCH}&t=${Date.now()}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.ok) {
      return await res.arrayBuffer();
    }
    console.warn(`[GitHub API] ${filePath}: ${res.status} ${res.statusText}`);
  } catch (e) {
    console.warn(`[GitHub API] ${filePath}: fetch error`, e);
  }
  return null;
}

/**
 * GitHub Raw URL でファイルを取得（フォールバック用、認証不要な公開リポジトリ向け）
 */
async function fetchGitHubRaw(filePath: string): Promise<ArrayBuffer | null> {
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
  const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${encodedPath}?t=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * CNS品目一覧を取得（GitHub API → Raw URL → ローカルの順でフォールバック）
 * GitHub Contents API（トークン付き）を最優先で使用し、確実に最新データを取得
 */
export async function fetchMasterData(): Promise<ContainerItem[]> {
  const token = typeof window !== 'undefined' ? getStoredToken() : '';
  const fallbackToken = process.env.NEXT_PUBLIC_GITHUB_TOKEN || '';
  const effectiveToken = token || fallbackToken;

  // 1. GitHub Contents API（トークン付き、最も信頼性が高い）
  if (effectiveToken) {
    const buffer = await fetchGitHubFile(MASTER_FILE_PATH, effectiveToken);
    if (buffer) {
      const items = parseMasterExcel(buffer);
      if (items.length > 0) {
        console.log(`[Master] GitHub API: ${items.length}件取得`);
        return items;
      }
    }
  }

  // 2. GitHub Contents API（トークンなし、公開リポジトリ用）
  {
    const buffer = await fetchGitHubFile(MASTER_FILE_PATH);
    if (buffer) {
      const items = parseMasterExcel(buffer);
      if (items.length > 0) {
        console.log(`[Master] GitHub API (no token): ${items.length}件取得`);
        return items;
      }
    }
  }

  // 3. GitHub Raw URL（フォールバック）
  {
    const buffer = await fetchGitHubRaw(MASTER_FILE_PATH);
    if (buffer) {
      const items = parseMasterExcel(buffer);
      if (items.length > 0) {
        console.log(`[Master] GitHub Raw: ${items.length}件取得`);
        return items;
      }
    }
  }

  // 4. ローカルからフォールバック（basePath対応）
  const bust = `?t=${Date.now()}`;
  const paths = [
    ...(typeof window !== 'undefined' ? [
      window.location.pathname.replace(/\/[^/]*$/, '') + '/data/CNS_品目一覧_全集約版.xlsx',
      window.location.origin + '/Container/data/CNS_品目一覧_全集約版.xlsx',
      window.location.origin + '/data/CNS_品目一覧_全集約版.xlsx',
    ] : ['/data/CNS_品目一覧_全集約版.xlsx']),
  ];

  for (const path of paths) {
    try {
      const res = await fetch(path + bust, { cache: 'no-store' });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const items = parseMasterExcel(buffer);
        if (items.length > 0) {
          console.log(`[Master] Local: ${items.length}件取得`);
          return items;
        }
      }
    } catch { /* 次のパスを試す */ }
  }

  return [];
}

/**
 * JKP_Shipping Schedule.xlsx を GitHub から取得
 * GitHub Contents API（トークン付き）→ Raw URL の順でフォールバック
 * @returns XLSX WorkBook or null
 */
export async function fetchJkpFromGitHub(): Promise<XLSX.WorkBook | null> {
  const token = typeof window !== 'undefined' ? getStoredToken() : '';
  const fallbackToken = process.env.NEXT_PUBLIC_GITHUB_TOKEN || '';
  const effectiveToken = token || fallbackToken;

  // 1. GitHub Contents API（トークン付き）
  if (effectiveToken) {
    const buffer = await fetchGitHubFile(JKP_FILE_PATH, effectiveToken);
    if (buffer) {
      try {
        const wb = XLSX.read(buffer, { type: 'array' });
        console.log(`[JKP] GitHub API: ファイル取得成功 (シート: ${Object.keys(wb.Sheets).join(', ')})`);
        return wb;
      } catch (e) {
        console.warn('[JKP] GitHub API: parse error', e);
      }
    }
  }

  // 2. GitHub Contents API（トークンなし）
  {
    const buffer = await fetchGitHubFile(JKP_FILE_PATH);
    if (buffer) {
      try {
        const wb = XLSX.read(buffer, { type: 'array' });
        console.log(`[JKP] GitHub API (no token): ファイル取得成功`);
        return wb;
      } catch (e) {
        console.warn('[JKP] GitHub API (no token): parse error', e);
      }
    }
  }

  // 3. GitHub Raw URL（フォールバック）
  {
    const buffer = await fetchGitHubRaw(JKP_FILE_PATH);
    if (buffer) {
      try {
        const wb = XLSX.read(buffer, { type: 'array' });
        console.log(`[JKP] GitHub Raw: ファイル取得成功`);
        return wb;
      } catch (e) {
        console.warn('[JKP] GitHub Raw: parse error', e);
      }
    }
  }

  return null;
}

/**
 * GitHub上のファイルの最終更新情報を取得
 * Commits APIで最新コミットの日時・メッセージを返す
 */
export async function fetchFileLastUpdate(filePath: string): Promise<{ date: string; message: string } | null> {
  const token = typeof window !== 'undefined' ? getStoredToken() : '';
  const fallbackToken = process.env.NEXT_PUBLIC_GITHUB_TOKEN || '';
  const effectiveToken = token || fallbackToken;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (effectiveToken) headers['Authorization'] = `token ${effectiveToken}`;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${encodeURIComponent(filePath)}&sha=${BRANCH}&per_page=1`,
      { headers, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const commits = await res.json();
    if (!Array.isArray(commits) || commits.length === 0) return null;
    const commit = commits[0];
    return {
      date: commit.commit?.committer?.date || commit.commit?.author?.date || '',
      message: commit.commit?.message || '',
    };
  } catch {
    return null;
  }
}

/** マスタファイルの最終更新情報を取得 */
export async function fetchMasterFileLastUpdate(): Promise<{ date: string; message: string } | null> {
  return fetchFileLastUpdate(MASTER_FILE_PATH);
}

/**
 * マスタデータとコンテナ品目を紐付する（同期処理）
 *
 * ※ AQSS04Lファイルの品番は「すべて新建高コード」
 *
 * 紐付キー（優先順位）:
 *   1. 新建高コード → マスタの newPartNumber (A列) で完全一致 ★優先
 *   2. 気高コード   → マスタの partNumber   (B列) で完全一致（フォールバック）
 *
 * 紐付後:
 *   - partNumber   = マスタの気高コード（B列）に書き換え
 *   - newPartNumber = マスタの新建高コード（A列）をセット
 *   - その他マスタ情報を全コピー
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

  // マスタの検索用Map
  const byNewPartNumber = new Map<string, ContainerItem>(); // 新建高コード(A列)→マスタ
  const byPartNumber = new Map<string, ContainerItem>();    // 気高コード(B列)→マスタ
  for (const m of masterItems) {
    if (m.newPartNumber) byNewPartNumber.set(m.newPartNumber, m);
    if (m.partNumber) byPartNumber.set(m.partNumber, m);
  }

  let linked = 0;
  const linkedItems = items.map((item) => {
    // 1. 新建高コードとして検索（AQSS04Lは全て新建高コード）★優先
    let master = byNewPartNumber.get(item.partNumber);

    // 2. 見つからなければ気高コードとして検索（フォールバック）
    if (!master) {
      master = byPartNumber.get(item.partNumber);
    }

    if (!master) return item;

    linked++;
    const updated = { ...item };

    // 気高コード = マスタのpartNumber(B列)を正とする
    updated.partNumber = master.partNumber;
    // 新建高コード = マスタのnewPartNumber(A列)をセット
    if (master.newPartNumber) updated.newPartNumber = master.newPartNumber;

    // マスタから全フィールドをコピー
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

    // 種類をマスタから反映（マスタのD列が正）
    if (master.type) {
      updated.type = master.type;
    }
    // サイズをマスタから補完（J列）
    if (master.size && !updated.size) {
      updated.size = master.size;
    }
    // 1P数がマスタにあり、作業データにない場合はマスタから補完
    if (master.qtyPerPallet > 0 && updated.qtyPerPallet === 0) {
      updated.qtyPerPallet = master.qtyPerPallet;
    }
    // 入数もマスタから補完
    if (master.packingQty > 0 && updated.packingQty === 0) {
      updated.packingQty = master.packingQty;
    }
    // 鍋のデフォルト1P数（マスタにもない場合のフォールバック）
    // 60/100サイズ→30, 180サイズ→24
    if (updated.qtyPerPallet === 0 && updated.type === '鍋') {
      const name = updated.itemName || '';
      if (name.includes('180') || /18[RWCS]/.test(name)) {
        updated.qtyPerPallet = 24;
      } else {
        updated.qtyPerPallet = 30; // 60/100サイズ共通
      }
    }
    // パレット数・端数を自動計算（qtyPerPalletが設定済みで、元データにパレット情報がない場合）
    if (updated.qtyPerPallet > 0 && updated.caseCount > 0 && item.palletCount === 0) {
      updated.palletCount = Math.floor(updated.caseCount / updated.qtyPerPallet);
      updated.fraction = updated.caseCount % updated.qtyPerPallet;
    }

    return updated;
  });

  // === 第2パス: measurements/cbm/grossWeight が空のアイテムに類似品名からフォールバック ===
  // マスタ全体からmeasurementsを持つアイテムの品名→measurements マップ構築
  const measByName = new Map<string, { measurements: string; cbm?: number; grossWeight?: number }>();
  for (const m of masterItems) {
    if (m.measurements && m.itemName) {
      measByName.set(m.itemName, { measurements: m.measurements, cbm: m.cbm, grossWeight: m.grossWeight });
    }
  }

  for (let i = 0; i < linkedItems.length; i++) {
    const it = linkedItems[i];
    if (it.measurements) continue; // 既にある

    // 品名の基幹部分を抽出して類似検索（色記号やサフィックスを除いた品名で検索）
    const baseName = extractBaseName(it.itemName);
    if (!baseName) continue;

    // 完全一致 → 前方一致 → 基幹一致の順で検索
    let found: { measurements: string; cbm?: number; grossWeight?: number } | undefined;
    found = measByName.get(it.itemName);
    if (!found) {
      // 基幹品名が一致するものを探す
      for (const [name, data] of Array.from(measByName.entries())) {
        if (extractBaseName(name) === baseName) {
          found = data;
          break;
        }
      }
    }
    if (found) {
      linkedItems[i] = {
        ...it,
        measurements: found.measurements,
        cbm: it.cbm ?? found.cbm,
        grossWeight: it.grossWeight ?? found.grossWeight,
      };
    }
  }

  return {
    linkedItems,
    linked,
    unlinked: items.length - linked,
    total: items.length,
  };
}

/**
 * 品名から基幹名を抽出（色記号やサフィックスを除去）
 * 例: "JRI-H100(KKB)" → "JRI-H100", "JPV-X180(K)" → "JPV-X180"
 */
function extractBaseName(name: string): string {
  // 括弧とその中身を除去、末尾の色コードや空白を除去
  return name.replace(/\(.*?\)/g, '').replace(/[A-Z]{1,3}$/, '').replace(/[\s\-]+$/, '').trim();
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
