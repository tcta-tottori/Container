import * as XLSX from 'xlsx';

/** 船便出荷予定明細1行 */
export interface ShipmentRecord {
  refNo: string;            // C列: REF NO.
  factoryShipDate: string;  // D列: 工場出荷日 (YYYY-MM-DD)
  partNumber: string;       // E列: 気高コード
  newPartNumber: string;    // F列: 新建高コード
  itemName: string;         // G列: 規格
  qty: number;              // H列: 数量
  orderNo: string;          // I列: 注文番号
  delivery: string;         // J列: 納期・宛先
  remark: string;           // K列: 備考
  vesselName: string;       // L列: 船便名
  voyage: string;           // M列: 航次
  siVgmCut: string;         // N列: S/I VGM CUT
  cyVgmCut: string;         // O列: C/Y VGM CUT
  departureDate: string;    // P列: 出港予定日 (YYYY-MM-DD)
  arrivalDate: string;      // Q列: 入港予定日 (YYYY-MM-DD) - フィルタ対象
  carrier: string;          // R列: 運送会社
}

export interface ShipmentParseResult {
  records: ShipmentRecord[];
  rangeStart: string;       // 読込対象範囲開始 (YYYY-MM-DD)
  rangeEnd: string;         // 読込対象範囲終了 (YYYY-MM-DD)
  totalRows: number;        // シート全体の有効行数
  filteredCount: number;    // フィルタ後件数
}

/** Excelシリアル値 or "M/D/YY"文字列 を YYYY-MM-DD に変換 */
function toIsoDate(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v == null || cell.v === '') return '';
  // 数値（Excelシリアル値）の場合
  if (cell.t === 'n' && typeof cell.v === 'number') {
    const d = XLSX.SSF.parse_date_code(cell.v);
    if (d && d.y && d.m && d.d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  // 文字列（"M/D/YY" や "YYYY/M/D" 等）の場合
  const str = String(cell.w ?? cell.v).trim();
  if (!str) return '';
  // M/D/YY (2026年=26)
  let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const yy = Number(m[3]);
    const year = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${year}-${String(Number(m[1])).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
  }
  // YYYY/M/D or YYYY-M-D
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`;
  }
  return '';
}

/** セルの値を文字列で取得 */
function cellStr(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v == null) return '';
  const v = cell.w ?? cell.v;
  return String(v).trim();
}

/** セルの値を数値で取得 */
function cellNum(cell: XLSX.CellObject | undefined): number {
  if (!cell || cell.v == null || cell.v === '') return 0;
  if (typeof cell.v === 'number') return cell.v;
  const n = Number(String(cell.v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

/** シート名を柔軟に検索 */
function findShipmentSheet(wb: XLSX.WorkBook): XLSX.WorkSheet | null {
  const candidates = ['船便出荷予定明細', '船便出荷予定明細表', '船便出荷予定'];
  for (const c of candidates) {
    if (wb.Sheets[c]) return wb.Sheets[c];
  }
  // 部分一致
  const found = Object.keys(wb.Sheets).find(n => n.includes('船便') && n.includes('出荷'));
  return found ? wb.Sheets[found] : null;
}

/** YYYY-MM-DD（ローカル） */
function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 船便出荷予定明細をパースし、Q列（入港予定日）が
 * 当日の3週間前 〜 当日 の範囲内のレコードを返す
 */
export function parseShipmentSchedule(
  wb: XLSX.WorkBook,
  options?: { rangeStart?: string; rangeEnd?: string },
): ShipmentParseResult {
  const ws = findShipmentSheet(wb);
  if (!ws) {
    console.warn('[ShipmentSchedule] 船便出荷予定明細シートが見つかりません。シート一覧:', Object.keys(wb.Sheets));
    return { records: [], rangeStart: '', rangeEnd: '', totalRows: 0, filteredCount: 0 };
  }

  // デフォルト範囲: 3週間前〜当日
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeWeeksAgo = new Date(today);
  threeWeeksAgo.setDate(today.getDate() - 21);
  const rangeStart = options?.rangeStart || toLocalIso(threeWeeksAgo);
  const rangeEnd = options?.rangeEnd || toLocalIso(today);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  // 列インデックス（0-based）。Excel A=0, B=1, ..., Q=16, R=17
  const COL = {
    refNo: 2,           // C
    factoryShip: 3,     // D
    partNumber: 4,      // E
    newPartNumber: 5,   // F
    itemName: 6,        // G
    qty: 7,             // H
    orderNo: 8,         // I
    delivery: 9,        // J
    remark: 10,         // K
    vessel: 11,         // L
    voyage: 12,         // M
    siVgm: 13,          // N
    cyVgm: 14,          // O
    departure: 15,      // P
    arrival: 16,        // Q ← フィルタ対象
    carrier: 17,        // R
  };

  const get = (r: number, c: number): XLSX.CellObject | undefined =>
    ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;

  const records: ShipmentRecord[] = [];
  let totalRows = 0;
  // ヘッダーは行0(Excel行1)。データは行1(Excel行2)から
  for (let r = 1; r <= range.e.r; r++) {
    const refNo = cellStr(get(r, COL.refNo));
    const partNumber = cellStr(get(r, COL.partNumber));
    const newPartNumber = cellStr(get(r, COL.newPartNumber));
    // 全項目空ならスキップ
    if (!refNo && !partNumber && !newPartNumber) continue;
    totalRows++;

    const arrivalDate = toIsoDate(get(r, COL.arrival));
    if (!arrivalDate) continue;
    if (arrivalDate < rangeStart || arrivalDate > rangeEnd) continue;

    records.push({
      refNo,
      factoryShipDate: toIsoDate(get(r, COL.factoryShip)),
      partNumber,
      newPartNumber,
      itemName: cellStr(get(r, COL.itemName)),
      qty: cellNum(get(r, COL.qty)),
      orderNo: cellStr(get(r, COL.orderNo)),
      delivery: cellStr(get(r, COL.delivery)),
      remark: cellStr(get(r, COL.remark)),
      vesselName: cellStr(get(r, COL.vessel)),
      voyage: cellStr(get(r, COL.voyage)),
      siVgmCut: cellStr(get(r, COL.siVgm)),
      cyVgmCut: cellStr(get(r, COL.cyVgm)),
      departureDate: toIsoDate(get(r, COL.departure)),
      arrivalDate,
      carrier: cellStr(get(r, COL.carrier)),
    });
  }

  // 入港日 → 工場出荷日 → REF NO. でソート
  records.sort((a, b) => {
    if (a.arrivalDate !== b.arrivalDate) return a.arrivalDate.localeCompare(b.arrivalDate);
    if (a.factoryShipDate !== b.factoryShipDate) return a.factoryShipDate.localeCompare(b.factoryShipDate);
    return a.refNo.localeCompare(b.refNo);
  });

  console.log(`[ShipmentSchedule] ${records.length}件 (範囲: ${rangeStart}〜${rangeEnd}, 全${totalRows}行)`);
  return { records, rangeStart, rangeEnd, totalRows, filteredCount: records.length };
}
