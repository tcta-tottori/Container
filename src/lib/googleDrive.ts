'use client';

/**
 * Googleドライブ連携
 * - Drive API でフォルダの中身を一覧する（選択はアプリ内の独自UIで行う）
 * - Drive API でファイルをダウンロードする（進捗つき）
 * - OAuth2トークンはメモリ内にのみ保持する
 *
 * Google Picker は使わない。
 * Picker は別ウィンドウ（ドライブのアプリやブラウザ）が立ち上がってしまい、
 * 選び終わるまでアプリの外へ出てしまうため、一覧の取得だけ API で行い、
 * 見た目と操作はアプリ内の GoogleDrivePicker に任せている。
 */

const GOOGLE_CLIENT_ID = '1010616579476-mpvmmbt5dqpn5nfso0jj9dc8q0n03ff1.apps.googleusercontent.com';
const GOOGLE_FOLDER_ID = '1k_y7D1gjFoaHrSuseOTXAtKONrQXVz9F';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

const STORAGE_KEY_TOKEN = 'cns-google-token';

/**
 * そのまま画面に出してよいエラー。
 * これ以外（想定外の例外）は英語のまま出さず、決まった案内に置き換える。
 */
export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveError';
  }
}

/** 画面に出す文言を選ぶ。DriveError 以外は中身を見せない */
export function driveErrorMessage(err: unknown): string {
  if (err instanceof DriveError) return err.message;
  console.error('Google Drive error:', err);
  return 'Googleドライブに接続できませんでした';
}

/** ドライブのフォルダ */
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
/** Googleスプレッドシート（そのままでは落とせないので xlsx に変換して取得する） */
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 一覧に出すファイル（Excel と写真、それにフォルダ） */
const PICKABLE_EXTENSIONS = ['.xlsx', '.xls', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.bmp'];

/** ドライブ上のファイル1件 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** フォルダなら true。一覧では開いて中へ入る */
  isFolder: boolean;
  /** 更新日時（ISO文字列）。並べ替えと表示に使う */
  modifiedTime?: string;
  /** バイト数。Googleスプレッドシートなど実体のないファイルでは無い */
  size?: number;
}

// 固定設定を返す（localStorage不使用）
export function getGoogleConfig(): { clientId: string; folderId: string } {
  return { clientId: GOOGLE_CLIENT_ID, folderId: GOOGLE_FOLDER_ID };
}

export function isGoogleConfigured(): boolean {
  return true;
}

// OAuth2トークンの管理（メモリ内に保持、localStorage不使用）
let _cachedToken = '';

export function getStoredGoogleToken(): string {
  if (typeof window === 'undefined') return '';
  // 古いlocalStorage設定をクリア（1回のみ）
  localStorage.removeItem('cns-google-client-id');
  localStorage.removeItem('cns-google-api-key');
  localStorage.removeItem('cns-google-folder-id');
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  return _cachedToken;
}

function storeGoogleToken(token: string): void {
  _cachedToken = token;
}

export function clearGoogleToken(): void {
  _cachedToken = '';
}

// GISスクリプトのロード
let gisLoaded = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureGisLoaded(): Promise<void> {
  if (gisLoaded) return;
  try {
    await loadScript('https://accounts.google.com/gsi/client');
  } catch {
    throw new DriveError('Googleに接続できませんでした。通信環境を確認してください');
  }
  gisLoaded = true;
}

/**
 * OAuth2でアクセストークンを取得する。
 * 一度許可していれば画面を出さずに通ることが多い（prompt を空にしているため）。
 */
export async function authenticateGoogle(): Promise<string> {
  const { clientId } = getGoogleConfig();
  if (!clientId) throw new DriveError('Google Client IDが設定されていません');

  await ensureGisLoaded();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oauth2 = (window as any).google?.accounts?.oauth2;
  if (!oauth2) throw new DriveError('Googleに接続できませんでした。通信環境を確認してください');

  return new Promise((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (response: any) => {
        if (response.error) {
          reject(new DriveError('Googleアカウントの接続に失敗しました'));
          return;
        }
        storeGoogleToken(response.access_token);
        resolve(response.access_token);
      },
      // 認証の画面を閉じられた場合など（callback は呼ばれない）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error_callback: (err: any) => {
        const type = err?.type as string | undefined;
        reject(new DriveError(
          type === 'popup_closed' || type === 'popup_failed_to_open'
            ? 'Googleアカウントの接続がキャンセルされました'
            : 'Googleアカウントの接続に失敗しました'
        ));
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Drive API を叩く。トークンが切れていたら取り直して1度だけやり直す。
 */
async function driveFetch(url: string): Promise<Response> {
  let token = getStoredGoogleToken();
  if (!token) token = await authenticateGoogle();

  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    clearGoogleToken();
    token = await authenticateGoogle();
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }
  return res;
}

/** ステータスコードから、そのまま画面に出せる日本語のメッセージを作る */
function driveError(status: number): DriveError {
  if (status === 403) return new DriveError('Googleドライブへのアクセスが許可されていません');
  if (status === 404) return new DriveError('Googleドライブにフォルダが見つかりませんでした');
  return new DriveError(`Googleドライブに接続できませんでした (${status})`);
}

/** 一覧に出す価値のあるファイルか（Excel・写真・Googleスプレッドシート） */
function isPickable(f: { name: string; mimeType: string }): boolean {
  if (f.mimeType === GOOGLE_SHEET_MIME) return true;
  const lower = f.name.toLowerCase();
  return PICKABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * フォルダの中身を一覧する。
 * folderId を省いた場合は CNS フォルダ。フォルダとファイルの両方を返す。
 */
export async function listDriveFiles(folderId?: string): Promise<DriveFile[]> {
  const { folderId: rootId } = getGoogleConfig();
  const parent = folderId || rootId;
  const out: DriveFile[] = [];
  let pageToken = '';

  // 件数が多いフォルダでも取りこぼさないよう、続きがある限り読む（上限1000件）
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({
      q: `'${parent}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
      orderBy: 'folder,name',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
    if (!res.ok) throw driveError(res.status);

    const json = await res.json();
    for (const f of (json.files || []) as { id: string; name: string; mimeType: string; modifiedTime?: string; size?: string }[]) {
      const isFolder = f.mimeType === DRIVE_FOLDER_MIME;
      if (!isFolder && !isPickable(f)) continue;
      out.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        isFolder,
        modifiedTime: f.modifiedTime,
        size: f.size ? Number(f.size) : undefined,
      });
    }

    pageToken = json.nextPageToken || '';
    if (!pageToken) break;
  }

  return out;
}

/** Googleスプレッドシートは xlsx として受け取るので、名前にも拡張子を付ける */
function downloadName(file: Pick<DriveFile, 'name' | 'mimeType'>): string {
  if (file.mimeType !== GOOGLE_SHEET_MIME) return file.name;
  return /\.xlsx?$/i.test(file.name) ? file.name : `${file.name}.xlsx`;
}

/**
 * Googleドライブからファイルを取得する。
 * onProgress には 0〜1 の進み具合を渡す（大きさが分かる場合のみ動く）。
 */
export async function downloadFromDrive(
  file: Pick<DriveFile, 'id' | 'name' | 'mimeType'>,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  const url = file.mimeType === GOOGLE_SHEET_MIME
    ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`
    : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;

  const res = await driveFetch(url);
  if (!res.ok) throw driveError(res.status);

  const name = downloadName(file);
  const type = res.headers.get('content-type') || '';
  const total = Number(res.headers.get('content-length') || 0);

  // 大きさが分かるときは、受け取りながら進み具合を伝える
  if (onProgress && res.body && total > 0) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        onProgress(Math.min(1, received / total));
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new File(chunks as any, name, { type });
  }

  const blob = await res.blob();
  onProgress?.(1);
  return new File([blob], name, { type: blob.type || type });
}
