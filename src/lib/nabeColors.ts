/**
 * 鍋アイテムの機種別カラーマッピング
 *
 * 品名（itemName）からモデルキーを抽出し、機種ごとの色を返す。
 * サイズ違い（100/180等）は同色。デフォルトルールはlocalStorageで上書き可能。
 */

export interface NabeColorRule {
  /** モデルキー（数字除去後: "JPVH", "JRIC", "JPVHW" 等） */
  key: string;
  /** 表示用ラベル（例: "JPV-H100"） */
  label: string;
  /** CSS色 */
  color: string;
}

/** デフォルトの色ルール */
const DEFAULT_RULES: NabeColorRule[] = [
  { key: 'JPVH',  label: 'JPVH (100/180)',   color: '#22c55e' },  // 緑
  { key: 'JRIC',  label: 'JRIC (060)',        color: '#eab308' },  // 黄色
  { key: 'JRIB',  label: 'JRIB (100/180)',    color: '#ec4899' },  // ピンク
  { key: 'JRIH',  label: 'JRIH (100/180)',    color: '#a0a0a0' },  // 黒系→ライトグレー表示
  { key: 'JPVHW', label: 'JPV+H W (10W/18W)', color: '#3b82f6' },  // 青
  { key: 'JPIT',  label: 'JPIT (100/180)',    color: '#eab308' },  // 黄色
  { key: 'JRIA',  label: 'JRIA (100/180)',    color: '#a0a0a0' },  // 黒系→ライトグレー表示
];

/** デフォルト（マッチしない場合）の色: 赤 */
const DEFAULT_FALLBACK_COLOR = '#ef4444';

const STORAGE_KEY = 'nabeColorRules';

/** localStorageからルールを取得（なければデフォルト） */
export function getNabeColorRules(): NabeColorRule[] {
  if (typeof window === 'undefined') return DEFAULT_RULES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as NabeColorRule[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_RULES;
}

/** ルールをlocalStorageに保存 */
export function saveNabeColorRules(rules: NabeColorRule[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

/** デフォルトルールにリセット */
export function resetNabeColorRules(): NabeColorRule[] {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  return [...DEFAULT_RULES];
}

/**
 * 品名からモデルキーを抽出
 *
 * 例: "JPVH100ウチナベ$" → "JPVH"
 *     "JPV+H10Wウチナベ$" → "JPVHW"
 *     "JRIC060ウチナベ$" → "JRIC"
 *     "JPVS100ウチナベ$" → "JPVS"
 */
export function extractNabeModelKey(itemName: string): string {
  if (!itemName) return '';

  // 日本語・記号より前のアルファベット+数字部分を取得
  const alphaNumPart = itemName.match(/^[A-Z+\-\d]+/i)?.[0] || '';
  if (!alphaNumPart) return '';

  // "+"とハイフンを除去し、数字を除去して残ったアルファベットがモデルキー
  const cleaned = alphaNumPart.replace(/[+\-]/g, '');
  // 数字を除去
  const key = cleaned.replace(/\d/g, '');
  return key.toUpperCase();
}

/**
 * 鍋アイテムの機種色を取得
 * @returns 機種色（CSS color）。鍋以外はnullを返す
 */
export function getNabeModelColor(itemName: string, type?: string): string | null {
  if (type && type !== '鍋') return null;

  const modelKey = extractNabeModelKey(itemName);
  if (!modelKey) return null;

  const rules = getNabeColorRules();

  // 長いキーから先にマッチ（"JPVHW"が"JPVH"より優先）
  const sortedRules = [...rules].sort((a, b) => b.key.length - a.key.length);
  for (const rule of sortedRules) {
    if (modelKey === rule.key) return rule.color;
  }

  // マッチしなかった → デフォルト赤
  return DEFAULT_FALLBACK_COLOR;
}

/** フォールバック色（赤）を取得 */
export function getNabeFallbackColor(): string {
  return DEFAULT_FALLBACK_COLOR;
}

/**
 * 色の明暗を判定（テキスト色選択用）
 * @returns true = 暗い色（白テキスト推奨）
 */
export function isColorDark(color: string): boolean {
  const hex = color.replace('#', '');
  if (hex.length < 6) return true;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // 輝度計算
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * 色からダークモード背景用の暗い版を生成（行背景用）
 */
export function nabeColorToDarkBg(color: string): string {
  const hex = color.replace('#', '');
  if (hex.length < 6) return '#1e1518';
  const r = Math.round(parseInt(hex.slice(0, 2), 16) * 0.12 + 20);
  const g = Math.round(parseInt(hex.slice(2, 4), 16) * 0.12 + 18);
  const b = Math.round(parseInt(hex.slice(4, 6), 16) * 0.12 + 20);
  return `rgb(${r},${g},${b})`;
}

/**
 * 色からグロー用の半透明版を生成
 */
export function nabeColorToGlow(color: string, alpha = 0.15): string {
  const hex = color.replace('#', '');
  if (hex.length < 6) return `rgba(239, 68, 68, ${alpha})`;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
