import * as XLSX from 'xlsx';
import { ContainerItem } from './types';
import { parseMasterExcel } from './masterLoader';

const REPO_OWNER = 'tcta-tottori';
const REPO_NAME = 'Container';
const FILE_PATH = 'CNS_品目一覧_全集約版.xlsx';
const BRANCH = 'main';

/**
 * ContainerItem[] → Excel ArrayBuffer を生成
 */
function buildExcelBuffer(items: ContainerItem[]): ArrayBuffer {
  const groupRow = [
    'ベース情報', '', '', '', '', '', '', '', '', '',
    '气高编号', '', '',
    'コンテナ日程', '', '', '',
    '', '', '', '', '',
  ];
  const headerRow = [
    '新建高コード', '気高コード', '規格', '種類', '代表機種', '入数', '総数', 'ケース数', '1P数', 'サイズ',
    '新建高コード\n(气高编号)', '規格\n(气高编号)', '紐付状態',
    '規格\n(コンテナ)', '代表機種\n(コンテナ)', '入数\n(コンテナ)', '1P数\n(コンテナ)',
    'ITEM\nDESCRIPTION', 'MODEL NO.', 'G.W.\n(per carton)', 'CBM', 'Meas.',
  ];
  const dataRows = items.map((it) => [
    it.newPartNumber || '', it.partNumber, it.itemName,
    it.type || '', it.representModel,
    it.packingQty || '', it.totalQty || '', it.caseCount || '', it.qtyPerPallet || '', it.size || '',
    it.newPartNumberKetaka || '', it.itemNameKetaka || '', it.linkStatus || '',
    it.itemNameContainer || '', it.representModelContainer || '',
    it.packingQtyContainer || '', it.qtyPerPalletContainer || '',
    it.description || '', it.modelNo || '',
    it.grossWeight || '', it.cbm || '', it.measurements || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([groupRow, headerRow, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '品目一覧（全集約）');
  ws['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 22 },
    { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 6 },
    { wch: 14 }, { wch: 28 }, { wch: 8 },
    { wch: 28 }, { wch: 22 }, { wch: 6 }, { wch: 6 },
    { wch: 22 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 14 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },    // ベース情報 (A-J)
    { s: { r: 0, c: 10 }, e: { r: 0, c: 12 } },   // 气高编号 (K-M)
    { s: { r: 0, c: 13 }, e: { r: 0, c: 16 } },   // コンテナ日程 (N-Q)
  ];

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf;
}

/** ArrayBuffer → base64 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * GitHub Contents API でファイルの現在の SHA とバイナリデータを取得
 */
async function getFileInfo(token: string): Promise<{ sha: string | null; buffer: ArrayBuffer | null }> {
  try {
    // SHA取得
    const metaRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(FILE_PATH)}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!metaRes.ok) return { sha: null, buffer: null };
    const meta = await metaRes.json();
    const sha = meta.sha || null;

    // バイナリ取得（Raw）
    const rawRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(FILE_PATH)}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3.raw' }, cache: 'no-store' }
    );
    if (!rawRes.ok) return { sha, buffer: null };
    const buffer = await rawRes.arrayBuffer();
    return { sha, buffer };
  } catch {
    return { sha: null, buffer: null };
  }
}

/**
 * GitHubの最新データと保存データをマージ
 *
 * 戦略:
 * - GitHub側のデータをベースとする
 * - アプリ側のデータで空でないフィールドだけ上書き
 * - GitHub側にしかない品目はそのまま保持
 * - アプリ側にしかない品目は追加
 *
 * これにより、GitHubに直接アップロードしたデータ（Meas.等）が
 * アプリの保存で消えることを防ぐ
 */
function mergeItems(appItems: ContainerItem[], githubItems: ContainerItem[]): ContainerItem[] {
  // GitHub側のマップ（気高コード → アイテム）
  const ghByPart = new Map<string, ContainerItem>();
  const ghByNewPart = new Map<string, ContainerItem>();
  for (const g of githubItems) {
    if (g.partNumber) ghByPart.set(g.partNumber, g);
    if (g.newPartNumber) ghByNewPart.set(g.newPartNumber, g);
  }

  const usedGhParts = new Set<string>();
  const merged: ContainerItem[] = [];

  for (const app of appItems) {
    // GitHub側で対応するアイテムを探す
    const gh = ghByPart.get(app.partNumber) || ghByNewPart.get(app.partNumber)
      || (app.newPartNumber ? (ghByNewPart.get(app.newPartNumber) || ghByPart.get(app.newPartNumber)) : undefined);

    if (gh) {
      usedGhParts.add(gh.partNumber);
      if (gh.newPartNumber) usedGhParts.add(gh.newPartNumber);

      // GitHub側をベースにして、アプリ側の空でないフィールドで上書き
      const result = { ...gh };

      // アプリ側に値があるフィールドのみ上書き
      if (app.newPartNumber) result.newPartNumber = app.newPartNumber;
      if (app.partNumber) result.partNumber = app.partNumber;
      if (app.itemName) result.itemName = app.itemName;
      if (app.type) result.type = app.type;
      if (app.representModel) result.representModel = app.representModel;
      if (app.packingQty) result.packingQty = app.packingQty;
      if (app.qtyPerPallet) result.qtyPerPallet = app.qtyPerPallet;
      if (app.size) result.size = app.size;
      if (app.newPartNumberKetaka) result.newPartNumberKetaka = app.newPartNumberKetaka;
      if (app.itemNameKetaka) result.itemNameKetaka = app.itemNameKetaka;
      if (app.linkStatus) result.linkStatus = app.linkStatus;
      if (app.itemNameContainer) result.itemNameContainer = app.itemNameContainer;
      if (app.representModelContainer) result.representModelContainer = app.representModelContainer;
      if (app.packingQtyContainer !== undefined && app.packingQtyContainer !== 0) result.packingQtyContainer = app.packingQtyContainer;
      if (app.qtyPerPalletContainer !== undefined && app.qtyPerPalletContainer !== 0) result.qtyPerPalletContainer = app.qtyPerPalletContainer;
      if (app.description) result.description = app.description;
      if (app.modelNo) result.modelNo = app.modelNo;
      if (app.grossWeight !== undefined && app.grossWeight !== 0) result.grossWeight = app.grossWeight;
      if (app.cbm !== undefined && app.cbm !== 0) result.cbm = app.cbm;
      if (app.measurements) result.measurements = app.measurements;

      merged.push(result);
    } else {
      // GitHub側にないアプリ側の新規品目
      merged.push(app);
    }
  }

  // GitHub側にしかない品目を追加（アプリ側で削除されていない品目）
  for (const gh of githubItems) {
    if (!usedGhParts.has(gh.partNumber)) {
      merged.push(gh);
    }
  }

  return merged;
}

/**
 * GitHub Contents API でファイルを更新（マージ戦略付き）
 *
 * 保存前にGitHubの最新データを取得し、マージしてから保存する。
 * これにより、GitHub上で直接更新されたデータ（Meas.等）が失われない。
 */
export async function saveToGitHub(
  items: ContainerItem[],
  token: string,
  onProgress?: (msg: string) => void,
): Promise<{ success: boolean; message: string }> {
  try {
    onProgress?.('GitHubから最新データを取得中...');
    const { sha, buffer: ghBuffer } = await getFileInfo(token);

    // GitHub側の最新データをパース → マージ
    let mergedItems = items;
    if (ghBuffer) {
      try {
        const ghItems = parseMasterExcel(ghBuffer);
        if (ghItems.length > 0) {
          onProgress?.(`マージ中... (アプリ: ${items.length}件, GitHub: ${ghItems.length}件)`);
          mergedItems = mergeItems(items, ghItems);
          console.log(`[Save] マージ完了: ${items.length}件(アプリ) + ${ghItems.length}件(GitHub) → ${mergedItems.length}件`);
        }
      } catch (e) {
        console.warn('[Save] GitHubデータのパース失敗、アプリデータのみで保存:', e);
      }
    }

    onProgress?.(`Excelファイルを生成中... (${mergedItems.length}件)`);
    const buffer = buildExcelBuffer(mergedItems);
    const content = arrayBufferToBase64(buffer);

    onProgress?.('GitHubへアップロード中...');
    const body: Record<string, string> = {
      message: `Update CNS_品目一覧_全集約版.xlsx (${mergedItems.length}件, ${new Date().toLocaleString('ja-JP')})`,
      content,
      branch: BRANCH,
    };
    if (sha) body.sha = sha;

    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(FILE_PATH)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (res.ok) {
      return { success: true, message: `GitHub更新完了 (${mergedItems.length}件)` };
    } else {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: `GitHub更新失敗: ${res.status} ${(err as Record<string, string>).message || ''}` };
    }
  } catch (e) {
    return { success: false, message: `エラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** GitHub トークンの保存/取得（localStorage） */
const TOKEN_KEY = 'cns_github_token';
export function getStoredToken(): string { return localStorage.getItem(TOKEN_KEY) || ''; }
export function storeToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
