/** 品目の種類 */
export type ItemType = 'ポリカバー' | 'ジャーポット' | '箱' | '部品' | '鍋' | 'その他';

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
  /** 新建高コード (A列) */
  newPartNumber?: string;
  // -- 气高编号 参照 --
  /** 新建高コード/气高编号 (J列) */
  newPartNumberKetaka?: string;
  /** 規格/气高编号 (K列) */
  itemNameKetaka?: string;
  /** 紐付状態 (L列: ✓ or —) */
  linkStatus?: string;
  // -- コンテナ日程 参照 --
  /** 規格/コンテナ (M列) */
  itemNameContainer?: string;
  /** 代表機種/コンテナ (N列) */
  representModelContainer?: string;
  /** 入数/コンテナ (O列) */
  packingQtyContainer?: number;
  /** 1P数/コンテナ (P列) */
  qtyPerPalletContainer?: number;
  // -- AQSS --
  /** ITEM DESCRIPTION (Q列) */
  description?: string;
  /** MODEL NO. (R列) */
  modelNo?: string;
  /** G.W. per carton (S列) */
  grossWeight?: number;
  /** CBM (T列) */
  cbm?: number;
  /** Meas. (U列) */
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
