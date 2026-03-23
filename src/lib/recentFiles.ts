const STORAGE_KEY = 'container-recent-files';
const MAX_ENTRIES = 3;

export interface RecentFile {
  name: string;
  date: string;
  containerCount: number;
  itemCount: number;
  data: string; // base64 encoded file data
}

export function getRecentFiles(): RecentFile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentFile(file: File, containerCount: number, itemCount: number): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const base64 = (reader.result as string).split(',')[1];
      const entries = getRecentFiles();
      // 同名ファイルがあれば削除
      const filtered = entries.filter((e) => e.name !== file.name);
      filtered.unshift({
        name: file.name,
        date: new Date().toISOString(),
        containerCount,
        itemCount,
        data: base64,
      });
      // 最大3件
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ENTRIES)));
    } catch {
      // storage full等は無視
    }
  };
  reader.readAsDataURL(file);
}

export function base64ToFile(entry: RecentFile): File {
  const byteString = atob(entry.data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const ext = entry.name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel';
  return new File([ab], entry.name, { type: ext });
}
