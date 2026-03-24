/** 品目の種類 */
export type ItemType = 'ポリカバー' | '箱' | '部品' | 'その他';

/** コンテナ内の1品目 */
export interface ContainerItem {
  /** 一意ID（コンテナNo + 行インデックス） */
  id: string;
  /** 気高コード — 「内容」シート C列 */
  partNumber: string;
  /** 規格（品名） — 「内容」シート D列 */
  itemName: string;
  /** 代表機種 — 「内容」シート E列 */
  representModel: string;
  /** 種類 — 自動判定 */
  type: ItemType;
  /** 入数（個/ケース） — 「内容」シート F列 */
  packingQty: number;
  /** 総数 — 「内容」シート G列 */
  totalQty: number;
  /** ケース数 — 「内容」シート H列 */
  caseCount: number;
  /** パレット枚数 — 「内容」シート I列 */
  palletCount: number;
  /** 端数（ケース） — 「内容」シート J列 */
  fraction: number;
  /** 1パレットあたりケース数 — 「内容」シート K列 */
  qtyPerPallet: number;
  // --- 以下はCNS品目一覧マスタデータ ---
  /** 新建高コード (CNS品目一覧 A列) */
  newPartNumber?: string;
  /** ITEM DESCRIPTION (CNS品目一覧 J列) */
  description?: string;
  /** MODEL NO. (CNS品目一覧 K列) */
  modelNo?: string;
  /** G.W.（総重量 KGS） (CNS品目一覧 L列) */
  grossWeight?: number;
  /** CBM（容積 立方メートル） (CNS品目一覧 M列) */
  cbm?: number;
  /** Meas.（外寸 例: 55*38*38） (CNS品目一覧 N列) */
  measurements?: string;
}

/** 1コンテナ分のデータ */
export interface Container {
  /** 入荷日 (YYYY-MM-DD) */
  date: string;
  /** コンテナ番号 */
  containerNo: string;
  /** 品目リスト（並べ替え済み） */
  items: ContainerItem[];
}

/** アプリ全体のデータ */
export interface AppData {
  containers: Container[];
}
