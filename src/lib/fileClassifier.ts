/** 読み込んだファイルの役割をファイル名から判別する */

/** 判別されたファイルの役割 */
export type FileRole = 'container' | 'master' | 'ketaka' | 'container_schedule' | 'aqss04l' | 'aqss05l' | 'jkp' | 'photo' | 'unknown';

export interface ClassifiedFile {
  file: File;
  role: FileRole;
  label: string;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.bmp'];

/** ファイル名から画像かどうか判定 */
export function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** ファイル名からロールを自動判別 */
export function classifyFile(name: string): { role: FileRole; label: string } {
  if (isImageFile(name)) {
    return { role: 'photo', label: 'コンテナ日程（写真）' };
  }
  const upper = name.toUpperCase();
  if (upper.includes('CNS_品目一覧') || upper.includes('CNS_品目') || upper.includes('全集約版')) {
    return { role: 'master', label: 'マスターデータ' };
  }
  if (upper.includes('气高出货') || upper.includes('気高出荷')) {
    return { role: 'ketaka', label: '气高编号マッピング' };
  }
  if (upper.includes('コンテナ日程')) {
    return { role: 'container_schedule', label: 'コンテナ日程' };
  }
  if (upper.startsWith('AQSS04L') || upper.includes('AQSS04L')) {
    return { role: 'aqss04l', label: 'AQSS04L (Invoice)' };
  }
  if (upper.startsWith('AQSS05L') || upper.includes('AQSS05L')) {
    return { role: 'aqss05l', label: 'AQSS05L (Packing)' };
  }
  if (upper.includes('JKP')) {
    return { role: 'jkp', label: 'JKP出荷スケジュール' };
  }
  // デフォルト: コンテナ日程（内容シート含む作業ファイル）
  return { role: 'container', label: 'コンテナ作業ファイル' };
}
