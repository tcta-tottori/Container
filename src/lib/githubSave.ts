import * as XLSX from 'xlsx';
import { ContainerItem } from './types';

const REPO_OWNER = 'tcta-tottori';
const REPO_NAME = 'Container';
const FILE_PATH = 'CNS_品目一覧_全集約版.xlsx';
const BRANCH = 'main';

/**
 * ContainerItem[] → Excel ArrayBuffer を生成
 */
function buildExcelBuffer(items: ContainerItem[]): ArrayBuffer {
  const groupRow = [
    'ベース情報', '', '', '', '', '', '', '', '',
    '气高编号', '', '',
    'コンテナ日程', '', '', '',
    '', '', '', '', '',
  ];
  const headerRow = [
    '新建高コード', '気高コード', '規格', '種類', '代表機種', '入数', '総数', 'ケース数', '1P数',
    '新建高コード\n(气高编号)', '規格\n(气高编号)', '紐付状態',
    '規格\n(コンテナ)', '代表機種\n(コンテナ)', '入数\n(コンテナ)', '1P数\n(コンテナ)',
    'ITEM\nDESCRIPTION', 'MODEL NO.', 'G.W.\n(per carton)', 'CBM', 'Meas.',
  ];
  const dataRows = items.map((it) => [
    it.newPartNumber || '', it.partNumber, it.itemName,
    it.type || '', it.representModel,
    it.packingQty || '', it.totalQty || '', it.caseCount || '', it.qtyPerPallet || '',
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
    { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 6 },
    { wch: 14 }, { wch: 28 }, { wch: 8 },
    { wch: 28 }, { wch: 22 }, { wch: 6 }, { wch: 6 },
    { wch: 22 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 14 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 0, c: 9 }, e: { r: 0, c: 11 } },
    { s: { r: 0, c: 12 }, e: { r: 0, c: 15 } },
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
 * GitHub Contents API でファイルの現在の SHA を取得
 */
async function getFileSha(token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(FILE_PATH)}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha || null;
  } catch {
    return null;
  }
}

/**
 * GitHub Contents API でファイルを更新（commit & push）
 */
export async function saveToGitHub(
  items: ContainerItem[],
  token: string,
  onProgress?: (msg: string) => void,
): Promise<{ success: boolean; message: string }> {
  try {
    onProgress?.('Excelファイルを生成中...');
    const buffer = buildExcelBuffer(items);
    const content = arrayBufferToBase64(buffer);

    onProgress?.('GitHubから現在のファイル情報を取得中...');
    const sha = await getFileSha(token);

    onProgress?.('GitHubへアップロード中...');
    const body: Record<string, string> = {
      message: `Update CNS_品目一覧_全集約版.xlsx (${items.length}件, ${new Date().toLocaleString('ja-JP')})`,
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
      return { success: true, message: `GitHub更新完了 (${items.length}件)` };
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
