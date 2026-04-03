'use client';

/**
 * Googleドライブ連携
 * - Google Picker APIでファイルを選択
 * - Google Drive APIでファイルをダウンロード
 * - OAuth2トークンをlocalStorageに保持
 */

const GOOGLE_CLIENT_ID = '1010616579476-mpvmmbt5dqpn5nfso0jj9dc8q0n03ff1.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyBsizrSkJoyFT7ybcRsqUb44xKtqBvzAOE';
const GOOGLE_FOLDER_ID = '1k_y7D1gjFoaHrSuseOTXAtKONrQXVz9F';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

const STORAGE_KEY_TOKEN = 'cns-google-token';

// 固定設定を返す（localStorage不使用）
export function getGoogleConfig(): { clientId: string; apiKey: string; folderId: string } {
  return { clientId: GOOGLE_CLIENT_ID, apiKey: GOOGLE_API_KEY, folderId: GOOGLE_FOLDER_ID };
}

export function isGoogleConfigured(): boolean {
  return true;
}

// OAuth2トークンの管理
export function getStoredGoogleToken(): string {
  if (typeof window === 'undefined') return '';
  // 古いlocalStorage設定をクリア
  localStorage.removeItem('cns-google-client-id');
  localStorage.removeItem('cns-google-api-key');
  localStorage.removeItem('cns-google-folder-id');
  // 古いトークンもクリア（403対策）
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  return '';
}

function storeGoogleToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
}

export function clearGoogleToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

// GAPIスクリプトのロード
let gapiLoaded = false;
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

async function ensureGapiLoaded(): Promise<void> {
  if (gapiLoaded) return;
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gapi.load('client:picker', () => resolve());
  });
  gapiLoaded = true;
}

async function ensureGisLoaded(): Promise<void> {
  if (gisLoaded) return;
  await loadScript('https://accounts.google.com/gsi/client');
  gisLoaded = true;
}

// OAuth2でアクセストークンを取得
export async function authenticateGoogle(): Promise<string> {
  const { clientId } = getGoogleConfig();
  if (!clientId) throw new Error('Google Client IDが設定されていません');

  await ensureGisLoaded();

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        storeGoogleToken(response.access_token);
        resolve(response.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// Google Pickerでファイル選択
export async function openGooglePicker(): Promise<{ id: string; name: string; mimeType: string }[] | null> {
  const { apiKey, folderId } = getGoogleConfig();
  let token = getStoredGoogleToken();

  if (!token) {
    token = await authenticateGoogle();
  }

  await ensureGapiLoaded();

  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
    view.setMode(google.picker.DocsViewMode.LIST);
    // 指定フォルダ内のみ表示
    if (folderId) {
      view.setParent(folderId);
    }

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setTitle(folderId ? 'CNSフォルダからファイルを選択' : 'Excelファイルを選択')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const files = data.docs.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
          }));
          resolve(files);
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

// Google Driveからファイルをダウンロード
export async function downloadFromDrive(fileId: string, fileName: string): Promise<File> {
  let token = getStoredGoogleToken();
  if (!token) {
    token = await authenticateGoogle();
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      // トークン期限切れ → 再認証
      clearGoogleToken();
      token = await authenticateGoogle();
      const retry = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!retry.ok) throw new Error(`Drive download failed: ${retry.status}`);
      const blob = await retry.blob();
      return new File([blob], fileName, { type: blob.type });
    }
    throw new Error(`Drive download failed: ${response.status}`);
  }

  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type });
}
