import { Container, ContainerItem } from './types';
import { detectItemType } from './typeDetector';
import { sortItems } from './sorter';

/**
 * コンテナ日程の写真（JPG/PNG等）をOCRで読み込み、Container に変換する。
 *
 * 対応書式（添付画像の書式）:
 *   ヘッダー左上: 「4月15日 26K0308」などの日付＋コンテナ番号
 *   列: 品番 / 品名 / 代表機種 / 入荷数量 / ケース数 / パレット枚数 / 端数
 *
 * tesseract.js を動的インポートして Japanese+English OCR を実行。
 * 精度は環境・画像品質に依存するため、結果は管理ページ等で編集する想定。
 */

export interface PhotoParseResult {
  container: Container | null;
  rawText: string;
  errors: string[];
}

export type PhotoProgressFn = (progress: number, message: string) => void;

/** 品番パターン: 3TGxxx / 3YMxxx / 3XXxxx 系 (10〜12桁英数) */
const PART_NUMBER_RE = /\b(3[A-Z]{2}[A-Z0-9]{6,12})\b/;

/** 日付＋コンテナ番号パターン: 「4月15日 26K0308」など */
const HEADER_DATE_RE = /(\d{1,2})月(\d{1,2})日[\s　]*([0-9A-Z]{4,10})?/;

/** 数字列抽出（カンマ区切りにも対応） */
function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches) return [];
  return matches
    .map((s) => Number(s.replace(/,/g, '')))
    .filter((n) => !isNaN(n));
}

/** OCR結果のクセを整形（全角数字→半角、ゼロ/オー混同の簡易補正など） */
function normalizeOcrText(text: string): string {
  return text
    // 全角数字→半角
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // 全角英字→半角
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // 全角ハイフン・マイナスの統一
    .replace(/[‐－―ｰ]/g, '-')
    // 全角スペース→半角
    .replace(/　/g, ' ');
}

/** 1行のOCRテキストを ContainerItem に変換。失敗時 null */
function parseRow(
  line: string,
  containerNo: string,
  rowIndex: number,
): ContainerItem | null {
  const normalized = normalizeOcrText(line).trim();
  if (!normalized) return null;

  const partMatch = normalized.match(PART_NUMBER_RE);
  if (!partMatch) return null;
  const partNumber = partMatch[1];

  // 品番以降を対象にする
  const afterPart = normalized.slice(partMatch.index! + partNumber.length).trim();

  // 末尾の数字列を抽出（入荷数量/ケース数/パレット枚数/端数 の 2〜4個）
  const nums = extractNumbers(afterPart);

  // 末尾の連続した数字トークンだけ使う: 空白で分割してから末尾から数値を取る
  const tokens = afterPart.split(/\s+/).filter(Boolean);
  const trailingNums: number[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].replace(/,/g, '');
    if (/^-?\d+(?:\.\d+)?$/.test(t)) {
      trailingNums.unshift(Number(t));
    } else {
      break;
    }
  }

  // 末尾数値群を優先（OCRで他箇所に誤認識された数字が混ざるため）
  const trailing = trailingNums.length >= 2 ? trailingNums : nums;

  // 4列揃っている想定: 入荷数量, ケース数, パレット枚数, 端数
  //   少ない場合は末尾優先で詰める
  let totalQty = 0, caseCount = 0, palletCount = 0, fraction = 0;
  if (trailing.length >= 4) {
    [totalQty, caseCount, palletCount, fraction] = trailing.slice(-4);
  } else if (trailing.length === 3) {
    [totalQty, caseCount, palletCount] = trailing;
  } else if (trailing.length === 2) {
    [totalQty, caseCount] = trailing;
  } else if (trailing.length === 1) {
    totalQty = trailing[0];
  }

  // 品名と代表機種は末尾数値列を除いた残り
  const nameTokensEnd = tokens.length - trailingNums.length;
  const nameTokens = tokens.slice(0, nameTokensEnd);
  let itemName = '';
  let representModel = '';
  if (nameTokens.length >= 2) {
    // 最後のトークンを代表機種、それ以外を品名とする
    representModel = nameTokens[nameTokens.length - 1];
    itemName = nameTokens.slice(0, -1).join(' ');
  } else if (nameTokens.length === 1) {
    itemName = nameTokens[0];
    representModel = nameTokens[0].replace(/ポリカバー|カバー$/, '');
  }

  // 品名が空で数値のみだった場合は無効行とみなす
  if (!itemName && !representModel) return null;

  const type = detectItemType(itemName, 0, palletCount, partNumber);

  const item: ContainerItem = {
    id: `${containerNo}-photo-${rowIndex}`,
    partNumber,
    itemName,
    representModel,
    type,
    packingQty: 0,
    totalQty,
    caseCount,
    palletCount,
    fraction,
    qtyPerPallet: 0,
  };
  return item;
}

/** 画像上部のヘッダー「4月15日 26K0308」から日付・コンテナ番号を抽出 */
function parseHeader(text: string): { date: string; containerNo: string } {
  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const match = normalizeOcrText(text).match(HEADER_DATE_RE);
  if (!match) return { date: defaultDate, containerNo: 'PHOTO' };
  const [, mm, dd, cn] = match;
  const month = String(Number(mm)).padStart(2, '0');
  const day = String(Number(dd)).padStart(2, '0');
  const date = `${now.getFullYear()}-${month}-${day}`;
  return { date, containerNo: cn || 'PHOTO' };
}

/**
 * 写真ファイルから Container を抽出する。
 * tesseract.js を動的インポートして使用。
 */
export async function parsePhotoFile(
  file: File,
  onProgress?: PhotoProgressFn,
): Promise<PhotoParseResult> {
  onProgress?.(5, 'OCRエンジンを準備中...');

  // 動的インポート（バンドルサイズ軽減）
  const mod = await import('tesseract.js');
  // ESM / CJS 差異を吸収
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tesseract: any = (mod as any).default || mod;

  onProgress?.(15, 'OCRエンジンを初期化中...');

  let rawText = '';
  try {
    const result = await Tesseract.recognize(file, 'jpn+eng', {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          const pct = 30 + Math.round(m.progress * 60);
          onProgress?.(pct, `文字認識中... ${Math.round(m.progress * 100)}%`);
        } else if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
          onProgress?.(20, 'エンジンを読込中...');
        } else if (m.status === 'loading language traineddata') {
          onProgress?.(25, '日本語辞書を読込中...');
        }
      },
    });
    rawText = result.data.text || '';
  } catch (e) {
    return {
      container: null,
      rawText: '',
      errors: [`OCR失敗: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  onProgress?.(92, '表データを解析中...');

  const { date, containerNo } = parseHeader(rawText);
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const items: ContainerItem[] = [];
  const errors: string[] = [];
  let idx = 0;
  for (const line of lines) {
    // ヘッダー行（品番/品名など）は除外
    if (/品番|品名|代表機種|入荷数量|ケース数|パレット/.test(line)) continue;
    const item = parseRow(line, containerNo, idx++);
    if (item) items.push(item);
  }

  if (items.length === 0) {
    errors.push('写真から品目を検出できませんでした');
    return { container: null, rawText, errors };
  }

  const container: Container = {
    date,
    containerNo,
    items: sortItems(items),
  };

  onProgress?.(98, `${items.length}品目を検出`);
  return { container, rawText, errors };
}
