import * as XLSX from 'xlsx';
import { Container, ContainerItem } from './types';
import { detectItemType } from './typeDetector';
import { sortItems } from './sorter';

export interface ParseResult {
  containers: Container[];
  errors: string[];
}

/**
 * Excelシリアル値を Date に変換する
 * Excel のシリアル値は 1900-01-01 を 1 とした日数
 */
function excelSerialToDate(serial: number): Date {
  // Excel の 1900 年うるう年バグ対応（1900-02-29 が存在する扱い）
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 86400 * 1000);
}

/** Date を YYYY-MM-DD 形式にフォーマット */
function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * セルの値を入荷日 (YYYY-MM-DD) として解釈する
 * - Excelシリアル値（数値）
 * - Date オブジェクト（cellDates 有効時）
 * - 文字列の日付 (2026/07/05, 2026-07-05 等)
 * 日付として解釈できなければ null
 */
function parseDateCell(val: unknown): string | null {
  if (val == null || val === '') return null;

  if (typeof val === 'number') {
    // 1970-01-01(25569) 〜 2100年頃(73000) の範囲のみ日付とみなす
    if (val > 25569 && val < 73000) return formatDate(excelSerialToDate(val));
    return null;
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    return formatDate(val);
  }

  if (typeof val === 'string') {
    const m = val.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
  }

  return null;
}

/** コンテナ番号らしい値か判定（例: 26K0705） */
function isContainerNoCell(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^\d{2}[A-Za-z]\d{3,5}$/.test(val.trim());
}

/**
 * A列・B列から「入荷日」と「コンテナ番号」を取り出す
 * ファイルによって A=日付/B=コンテナ番号 と A=コンテナ番号/B=日付 の
 * どちらのレイアウトもあるため、日付として解釈できた側を日付とする
 */
function readContainerHeader(
  aVal: unknown,
  bVal: unknown
): { date: string; containerNo: string } | null {
  const dateA = parseDateCell(aVal);
  if (dateA !== null) {
    return { date: dateA, containerNo: String(bVal ?? '').trim() };
  }
  const dateB = parseDateCell(bVal);
  if (dateB !== null) {
    return { date: dateB, containerNo: String(aVal ?? '').trim() };
  }
  // 日付が無くコンテナ番号だけある行にも対応
  if (isContainerNoCell(aVal)) {
    return { date: '', containerNo: String(aVal).trim() };
  }
  if (isContainerNoCell(bVal)) {
    return { date: '', containerNo: String(bVal).trim() };
  }
  return null;
}

/** 値を数値に変換（空文字・undefined → 0） */
function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/**
 * 未入力（空セル）と 0 を区別して読む。
 * 「内容」シートは数式の結果なので、
 *   - 0     … 数式は入っているが引き当てが無い（例: 入数が決まっていない部品）
 *   - 空セル … 数式そのものが入っていない（行を足したときに数式が伸びていない）
 * のちがいがある。空セルのときだけ Sheet1 の一覧や計算で補う。
 */
function toOptionalNumber(val: unknown): number | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'string' && val.trim() === '') return undefined;
  if (val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

/** 文字列として読む。空セル・0（引き当て無し）は空文字 */
function toText(val: unknown): string {
  if (val === null || val === undefined) return '';
  // VLOOKUP が空欄を拾うと 0 になる。機種名として 0 は意味がないので空扱い
  if (val === 0 || val === '0') return '';
  return String(val).trim();
}

/** 小数の誤差（0.30000000000000004 のような値）を丸める */
function tidy(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/* ===== 「内容」シートの列を見出しから探す ===== */

/** 「内容」シートで使う列 */
type ColumnKey =
  | 'partNumber'
  | 'itemName'
  | 'representModel'
  | 'packingQty'
  | 'totalQty'
  | 'caseCount'
  | 'palletCount'
  | 'fraction'
  | 'qtyPerPallet'
  | 'casesPerTier';

/**
 * 見出しの言葉。上から順に照合するので、
 * 「1段のケース数」は「ケース数」より先に置いてある。
 */
const HEADER_KEYWORDS: [ColumnKey, string[]][] = [
  ['partNumber', ['品番', '気高コード']],
  ['itemName', ['品名', '規格']],
  ['representModel', ['代表機種']],
  ['packingQty', ['入数']],
  ['totalQty', ['入荷数量']],
  ['casesPerTier', ['1段のケース数', '1段']],
  ['caseCount', ['ケース数']],
  ['palletCount', ['パレット枚数']],
  ['fraction', ['端数']],
  ['qtyPerPallet', ['1パレット', '1p数']],
];

/** 見出しの表記ゆれ（全角数字・空白）をならす */
function normalizeHeader(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\s　]/g, '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

/** 見出しが無いファイル向けの既定の列位置（C〜L列） */
const DEFAULT_COLUMNS: Record<ColumnKey, number> = {
  partNumber: 2,
  itemName: 3,
  representModel: 4,
  packingQty: 5,
  totalQty: 6,
  caseCount: 7,
  palletCount: 8,
  fraction: 9,
  qtyPerPallet: 10,
  casesPerTier: 11,
};

interface HeaderInfo {
  /** 見出し行の位置（見つからなければ -1） */
  rowIndex: number;
  columns: Record<ColumnKey, number>;
}

/**
 * 見出し行（品番・品名…）を探して、どの列に何が入っているかを決める。
 * 列が増えたファイル（「1段のケース数」が付いたもの等）でもずれないようにする。
 */
function findHeader(rows: unknown[][]): HeaderInfo {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    const cells = row.map(normalizeHeader);
    if (!cells.includes('品番') || !cells.includes('品名')) continue;

    const columns = { ...DEFAULT_COLUMNS };
    const found = new Set<ColumnKey>();
    for (let c = 0; c < cells.length; c++) {
      const text = cells[c];
      if (!text) continue;
      for (const [key, words] of HEADER_KEYWORDS) {
        if (found.has(key)) continue;
        if (words.some((w) => text.includes(w))) {
          columns[key] = c;
          found.add(key);
          break;
        }
      }
    }
    return { rowIndex: i, columns };
  }
  return { rowIndex: -1, columns: { ...DEFAULT_COLUMNS } };
}

/* ===== Sheet1（品目の一覧表）からの補完 ===== */

/** Sheet1 の 1行 = 品番につく入数・1パレット・代表機種 */
interface LookupEntry {
  representModel: string;
  packingQty?: number;
  qtyPerPallet?: number;
}

/** 一覧表とみなすシートの大きさの上限（これより大きいものは別の表とみなして読まない） */
const LOOKUP_MAX_ROWS = 5000;
const LOOKUP_MAX_COLS = 30;

/** シートが一覧表くらいの大きさかどうか */
function isLookupSized(ws: XLSX.WorkSheet): boolean {
  const ref = ws['!ref'];
  if (!ref) return false;
  const range = XLSX.utils.decode_range(ref);
  return (
    range.e.r - range.s.r + 1 <= LOOKUP_MAX_ROWS &&
    range.e.c - range.s.c + 1 <= LOOKUP_MAX_COLS
  );
}

/**
 * 「内容」シートの数式（VLOOKUP）が見ている一覧表を読み込む。
 * 行を足したときに数式が伸びていないことがあるので、
 * 空欄になっている入数・1パレット・代表機種はここから補う。
 *
 * 一覧表は「品番・品名・代表機種・入数・1パレット」がこの順に並ぶ。
 * 左端が空の列から始まることもあるので、最初に値のある列を起点にする。
 */
function buildLookup(wb: XLSX.WorkBook, contentSheetName: string): Map<string, LookupEntry> {
  const map = new Map<string, LookupEntry>();
  for (const name of wb.SheetNames) {
    if (name === contentSheetName) continue;
    const ws = wb.Sheets[name];
    if (!ws || !isLookupSized(ws)) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    for (const row of rows) {
      if (!row || !Array.isArray(row)) continue;
      const start = row.findIndex((v) => v !== null && v !== undefined && v !== '');
      if (start < 0) continue;
      const code = String(row[start]).trim();
      const itemName = row[start + 1];
      // 品番＋品名が並んでいる行だけを一覧表とみなす
      if (!code || typeof itemName !== 'string' || itemName.trim() === '') continue;
      // VLOOKUP と同じく、同じ品番が複数あれば最初の行を使う
      if (map.has(code)) continue;
      map.set(code, {
        representModel: toText(row[start + 2]),
        packingQty: toOptionalNumber(row[start + 3]),
        qtyPerPallet: toOptionalNumber(row[start + 4]),
      });
    }
  }
  return map;
}

/** 1行のデータから ContainerItem を生成 */
function createContainerItem(
  row: unknown[],
  columns: Record<ColumnKey, number>,
  lookup: Map<string, LookupEntry>,
  containerNo: string,
  rowIndex: number
): ContainerItem {
  const cell = (key: ColumnKey) => row[columns[key]];

  const partNumber = toText(cell('partNumber'));
  const itemName = String(cell('itemName') || '').trim();
  const ref = lookup.get(partNumber);

  let representModel = toText(cell('representModel'));
  if (!representModel && ref) representModel = ref.representModel;

  // 入数・1パレットは空欄なら一覧表から補う（0 は「引き当て無し」なのでそのまま）
  let packingQty = toOptionalNumber(cell('packingQty'));
  if (packingQty === undefined) packingQty = ref?.packingQty;
  let qtyPerPallet = toOptionalNumber(cell('qtyPerPallet'));
  if (qtyPerPallet === undefined) qtyPerPallet = ref?.qtyPerPallet;

  const totalQty = toNumber(cell('totalQty'));

  // ケース数が空欄なら 入荷数量 ÷ 入数 で出す（Excel の数式と同じ）
  let caseCount = toOptionalNumber(cell('caseCount'));
  if (caseCount === undefined && packingQty && packingQty > 0) {
    caseCount = tidy(totalQty / packingQty);
  }

  // パレット枚数・端数が空欄なら ケース数 と 1パレット から出す
  let palletCount = toOptionalNumber(cell('palletCount'));
  let fraction = toOptionalNumber(cell('fraction'));
  if (caseCount !== undefined && qtyPerPallet && qtyPerPallet > 0) {
    if (palletCount === undefined) palletCount = Math.floor(caseCount / qtyPerPallet);
    if (fraction === undefined) fraction = tidy(caseCount - palletCount * qtyPerPallet);
  }

  const casesPerTier = toOptionalNumber(cell('casesPerTier'));

  const type = detectItemType(itemName, qtyPerPallet ?? 0, palletCount ?? 0, partNumber);

  const item: ContainerItem = {
    id: `${containerNo}-${rowIndex}`,
    partNumber,
    itemName,
    representModel,
    type,
    packingQty: packingQty ?? 0,
    totalQty,
    caseCount: caseCount ?? 0,
    palletCount: palletCount ?? 0,
    fraction: fraction ?? 0,
    qtyPerPallet: qtyPerPallet ?? 0,
  };
  if (casesPerTier !== undefined && casesPerTier > 0) item.casesPerTier = casesPerTier;
  return item;
}

/** 同一品番＋品名のアイテムを合算する */
function mergeItems(items: ContainerItem[]): ContainerItem[] {
  const map = new Map<string, ContainerItem>();
  for (const item of items) {
    const key = `${item.partNumber}::${item.itemName}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalQty += item.totalQty;
      existing.caseCount = tidy(existing.caseCount + item.caseCount);
      existing.palletCount += item.palletCount;
      existing.fraction = tidy(existing.fraction + item.fraction);
      // qtyPerPallet, packingQty は同じ品目なので最初の値を維持
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

/**
 * Excel ファイルをブラウザ内でパースし、コンテナデータを返す
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // 「内容」シートを探す
  const contentName = wb.SheetNames.find((n) => n.includes('内容'));
  const wsName = contentName || wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  if (!ws) {
    return { containers: [], errors: ['「内容」シートが見つかりません'] };
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  const { rowIndex: headerRow, columns } = findHeader(rows);
  // 一覧表（Sheet1）での補完は「内容」シートを持つ作業ファイルだけで行う
  const lookup = contentName
    ? buildLookup(wb, wsName)
    : new Map<string, LookupEntry>();

  const containers: Container[] = [];
  const errors: string[] = [];
  let current: Container | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    // 見出し行はスキップ
    if (i === headerRow) continue;

    const aVal = row[0]; // A列: 日付 or コンテナ番号（ファイルによって入れ替わる）
    const bVal = row[1]; // B列: コンテナ番号 or 日付
    const cVal = row[columns.partNumber];
    const dVal = row[columns.itemName];

    // A列・B列に日付／コンテナ番号があればコンテナ先頭行。
    // コンテナとコンテナの間に空行が無いファイルもあるので、
    // 区切りは空行ではなくこの行で見分ける。
    const header = readContainerHeader(aVal, bVal);
    if (header && (header.date !== '' || header.containerNo !== '')) {
      if (current && current.items.length > 0) containers.push(current);
      current = {
        date: header.date,
        containerNo: header.containerNo,
        items: [],
      };
    }

    // ヘッダー行（品番／品名の見出し）はスキップ
    if (normalizeHeader(cVal) === '品番' || normalizeHeader(dVal) === '品名') continue;

    // 品名の列に値があればアイテム行
    if (dVal && typeof dVal === 'string' && dVal.trim() !== '' && current) {
      const item = createContainerItem(row, columns, lookup, current.containerNo, i);
      current.items.push(item);
    }
  }
  if (current && current.items.length > 0) {
    containers.push(current);
  }

  // 同一コンテナ内の同一品番・同一品名を合算
  for (const c of containers) {
    c.items = mergeItems(c.items);
  }

  // 各コンテナの品目を並べ替え
  for (const c of containers) {
    c.items = sortItems(c.items);
  }

  if (containers.length === 0) {
    errors.push('コンテナデータが見つかりませんでした');
  }

  return { containers, errors };
}
