import { Container, ContainerItem } from './types';
import { detectItemType } from './typeDetector';
import { sortItems } from './sorter';
import { geminiExtractContainer, getGeminiKey } from './geminiApi';
import { prepareImageForOcr } from './imagePrep';

/**
 * コンテナ日程の写真（JPG/PNG等）を解析し、Container に変換する。
 *
 * 対応書式（添付画像の書式）:
 *   ヘッダー左上: 「4月15日 26K0308」などの日付＋コンテナ番号
 *   列: 品番 / 品名 / 代表機種 / 入荷数量 / ケース数 / パレット枚数 / 端数
 *
 * 優先順位:
 *   1. Gemini API キーが設定されていれば Gemini Vision で構造化抽出（高精度）
 *   2. キー未設定時は tesseract.js の Japanese OCR を使用（精度低）
 */

export interface PhotoParseResult {
  container: Container | null;
  rawText: string;
  errors: string[];
  /** 使用した抽出エンジン */
  engine: 'gemini' | 'tesseract' | 'none';
}

export type PhotoProgressFn = (progress: number, message: string) => void;

/** 品番パターン: 3TGxxx / 3YMxxx 系 */
const PART_NUMBER_RE = /\b(3[A-Z]{2}[A-Z0-9]{6,12})\b/;
/** OCR の読み違いを含む品番候補（先頭の 3 が S/B に、途中の 0/1 が O/I/l になりやすい） */
const PART_CANDIDATE_RE = /(?:^|[^A-Za-z0-9])([3SB][A-Z]{2}[A-Za-z0-9]{6,12})(?![A-Za-z0-9])/;

/** 品番候補の読み違いを補正する: 先頭は 3、4文字目以降で数字に挟まれた O/I/l/S/B は数字に */
function fixPartNumber(raw: string): string {
  const s = raw.toUpperCase().split('');
  s[0] = '3';
  const toDigit: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', S: '5', B: '8', Z: '2' };
  const isDigit = (c?: string) => !!c && /[0-9]/.test(c);
  for (let i = 3; i < s.length; i++) {
    const d = toDigit[s[i]];
    if (!d) continue;
    const prev = s[i - 1];
    const next = s[i + 1];
    // 末尾、または両隣が数字のときだけ置換（A10121 の A のような本物の英字は残す）
    if ((isDigit(prev) || i === 3) && (isDigit(next) || next === undefined)) s[i] = d;
  }
  return s.join('');
}
const HEADER_DATE_RE = /(\d{1,2})月(\d{1,2})日[\s　]*([0-9A-Z]{4,10})?/;

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches) return [];
  return matches.map((s) => Number(s.replace(/,/g, ''))).filter((n) => !isNaN(n));
}

function normalizeOcrText(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[‐－―ｰ]/g, '-')
    .replace(/　/g, ' ');
}

/** 今日の日付を YYYY-MM-DD で */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "MM-DD" → "YYYY-MM-DD" (YYYY は現在年) */
function normalizeDate(input: string): string {
  if (!input) return todayIso();
  const d = new Date();
  const m = input.match(/(\d{1,2})[^\d]+(\d{1,2})/);
  if (!m) return todayIso();
  const mm = String(Number(m[1])).padStart(2, '0');
  const dd = String(Number(m[2])).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// =============== Gemini 経路 ===============

async function parseWithGemini(
  file: File,
  onProgress?: PhotoProgressFn,
): Promise<PhotoParseResult> {
  onProgress?.(20, 'Gemini APIに画像を送信中...');

  let gemini;
  try {
    gemini = await geminiExtractContainer(file);
  } catch (e) {
    return {
      container: null,
      rawText: '',
      errors: [`Gemini抽出失敗: ${e instanceof Error ? e.message : String(e)}`],
      engine: 'gemini',
    };
  }

  onProgress?.(85, `${gemini.items.length}品目を受信。変換中...`);

  const containerNo = gemini.containerNo || 'PHOTO';
  const date = normalizeDate(gemini.date);

  const items: ContainerItem[] = gemini.items
    .filter((g) => g.partNumber || g.itemName)
    .map((g, idx) => ({
      id: `${containerNo}-photo-${idx}`,
      partNumber: g.partNumber,
      itemName: g.itemName,
      representModel: g.representModel,
      type: detectItemType(g.itemName, 0, g.palletCount, g.partNumber),
      packingQty: 0,
      totalQty: g.totalQty,
      caseCount: g.caseCount,
      palletCount: g.palletCount,
      fraction: g.fraction,
      qtyPerPallet: 0,
    }));

  if (items.length === 0) {
    return {
      container: null,
      rawText: JSON.stringify(gemini),
      errors: ['Geminiが品目を検出できませんでした'],
      engine: 'gemini',
    };
  }

  onProgress?.(95, `${items.length}品目を抽出`);

  return {
    container: { date, containerNo, items: sortItems(items) },
    rawText: JSON.stringify(gemini, null, 2),
    errors: [],
    engine: 'gemini',
  };
}

// =============== Tesseract 経路（フォールバック） ===============

function parseTesseractRow(
  line: string,
  containerNo: string,
  rowIndex: number,
): ContainerItem | null {
  const normalized = normalizeOcrText(line).trim();
  if (!normalized) return null;

  let partMatch = normalized.match(PART_NUMBER_RE);
  let partNumber: string;
  let partEnd: number;
  if (partMatch) {
    partNumber = partMatch[1];
    partEnd = partMatch.index! + partNumber.length;
  } else {
    partMatch = normalized.match(PART_CANDIDATE_RE);
    if (!partMatch) return null;
    const raw = partMatch[1];
    partNumber = fixPartNumber(raw);
    partEnd = partMatch.index! + partMatch[0].length;
  }

  const afterPart = normalized.slice(partEnd).trim();
  const nums = extractNumbers(afterPart);

  const tokens = afterPart.split(/\s+/).filter(Boolean);
  const trailingNums: number[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].replace(/,/g, '');
    if (/^-?\d+(?:\.\d+)?$/.test(t)) trailingNums.unshift(Number(t));
    else break;
  }
  const trailing = trailingNums.length >= 2 ? trailingNums : nums;

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

  const nameTokensEnd = tokens.length - trailingNums.length;
  const nameTokens = tokens.slice(0, nameTokensEnd);
  let itemName = '';
  let representModel = '';
  if (nameTokens.length >= 2) {
    representModel = nameTokens[nameTokens.length - 1];
    itemName = nameTokens.slice(0, -1).join(' ');
  } else if (nameTokens.length === 1) {
    itemName = nameTokens[0];
    representModel = nameTokens[0].replace(/ポリカバー|カバー$/, '');
  }

  if (!itemName && !representModel) return null;

  return {
    id: `${containerNo}-photo-${rowIndex}`,
    partNumber,
    itemName,
    representModel,
    type: detectItemType(itemName, 0, palletCount, partNumber),
    packingQty: 0,
    totalQty,
    caseCount,
    palletCount,
    fraction,
    qtyPerPallet: 0,
  };
}

function parseTesseractHeader(text: string): { date: string; containerNo: string } {
  const match = normalizeOcrText(text).match(HEADER_DATE_RE);
  if (!match) return { date: todayIso(), containerNo: 'PHOTO' };
  const [, mm, dd, cn] = match;
  const d = new Date();
  const month = String(Number(mm)).padStart(2, '0');
  const day = String(Number(dd)).padStart(2, '0');
  return { date: `${d.getFullYear()}-${month}-${day}`, containerNo: cn || 'PHOTO' };
}

async function parseWithTesseract(
  file: File,
  onProgress?: PhotoProgressFn,
): Promise<PhotoParseResult> {
  onProgress?.(5, 'OCRエンジンを準備中...');

  const mod = await import('tesseract.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tesseract: any = (mod as any).default || mod;

  onProgress?.(15, 'OCRエンジンを初期化中...');

  // グレースケール化・コントラスト補正・文字が読める大きさへの拡大縮小
  onProgress?.(20, '画像を補正中...');
  const image = await prepareImageForOcr(file);

  let rawText = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worker: any = null;
  try {
    worker = await Tesseract.createWorker('jpn+eng', 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          const pct = 30 + Math.round(m.progress * 60);
          onProgress?.(pct, `文字認識中... ${Math.round(m.progress * 100)}%`);
        } else if (m.status === 'loading language traineddata') {
          onProgress?.(25, '日本語辞書を読込中...');
        }
      },
    });
    // 表は 1 ブロックの均一なテキストとして読ませ、列の間の空白を残す
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
    });
    const result = await worker.recognize(image);
    rawText = result.data.text || '';
  } catch (e) {
    return {
      container: null,
      rawText: '',
      errors: [`OCR失敗: ${e instanceof Error ? e.message : String(e)}`],
      engine: 'tesseract',
    };
  } finally {
    await worker?.terminate().catch(() => {});
  }

  onProgress?.(92, '表データを解析中...');

  const { date, containerNo } = parseTesseractHeader(rawText);
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const items: ContainerItem[] = [];
  const errors: string[] = [];
  let idx = 0;
  for (const line of lines) {
    if (/品番|品名|代表機種|入荷数量|ケース数|パレット/.test(line)) continue;
    const item = parseTesseractRow(line, containerNo, idx++);
    if (item) items.push(item);
  }

  if (items.length === 0) {
    errors.push('写真から品目を検出できませんでした');
    return { container: null, rawText, errors, engine: 'tesseract' };
  }

  onProgress?.(98, `${items.length}品目を検出`);
  return {
    container: { date, containerNo, items: sortItems(items) },
    rawText,
    errors,
    engine: 'tesseract',
  };
}

// =============== 公開API ===============

/**
 * 写真ファイルから Container を抽出する。
 * Gemini API キーが設定されていれば Gemini を優先使用。
 */
export async function parsePhotoFile(
  file: File,
  onProgress?: PhotoProgressFn,
): Promise<PhotoParseResult> {
  const hasGeminiKey = !!getGeminiKey();

  if (hasGeminiKey) {
    const result = await parseWithGemini(file, onProgress);
    // Gemini 失敗時は Tesseract にフォールバック（エラー通知付き）
    if (!result.container) {
      onProgress?.(10, 'Gemini失敗 → OCRにフォールバック...');
      const fallback = await parseWithTesseract(file, onProgress);
      return {
        ...fallback,
        errors: [...result.errors, ...fallback.errors],
      };
    }
    return result;
  }

  // キーなし → Tesseract のみ
  return parseWithTesseract(file, onProgress);
}
