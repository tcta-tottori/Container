/** 更新履歴管理 — IndexedDB */

export interface HistoryFile {
  type: 'hinmoku' | 'jkp';
  filename: string;
  data: ArrayBuffer;
}

export interface HistoryEntry {
  id: number;
  timestamp: string;
  description: string;
  files: HistoryFile[];
}

const DB_NAME = 'cns-history';
const STORE_NAME = 'entries';
const DB_VERSION = 1;
const MAX_ENTRIES = 5;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 履歴を取得（新しい順） */
export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const entries = (req.result as HistoryEntry[]).sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(entries);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** 履歴を保存（MAX_ENTRIES件まで） */
export async function saveHistory(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // 保存
    store.add(entry);

    // 古いエントリを削除
    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const all = (getAllReq.result as HistoryEntry[]).sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      // MAX超過分を削除
      for (let i = MAX_ENTRIES; i < all.length; i++) {
        store.delete(all[i].id);
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB unavailable
  }
}

/** ファイルをダウンロード */
export function downloadHistoryFile(file: HistoryFile): void {
  const blob = new Blob([file.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  a.click();
  URL.revokeObjectURL(url);
}
