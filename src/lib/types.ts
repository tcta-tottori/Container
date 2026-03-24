/** 品目の種類 */
export type ItemType = 'ポリカバー' | '箱' | '部品' | 'その他';

/** コンテナ内の1品目 */
export interface ContainerItem {
  /** 一意ID（コンテナNo + 行インデックス） */
  id: string;
  /** 新建高コード (A列) */
  newPartNumber?: string;
  /** 気高コード (B列) */
  partNumber: string;
  /** 規格 (C列) */
  itemName: string;
  /** 種類 (D列) — 自動判定 */
  type: ItemType;
  /** 代表機種 (E列) */
  representModel: string;
  /** 入数（個/ケース） (F列) */
  packingQty: number;
  /** 総数 (G列) */
  totalQty: number;
  /** ケース数 (H列) */
  caseCount: number;
  /** 1パレットあたりケース数 (I列) */
  qtyPerPallet: number;
  /** ITEM DESCRIPTION (J列) */
  description?: string;
  /** MODEL NO. (K列) */
  modelNo?: string;
  /** G.W.（総重量 KGS） (L列) */
  grossWeight?: number;
  /** CBM（容積 立方メートル） (M列) */
  cbm?: number;
  /** Meas.（外寸 例: 55*38*38） (N列) */
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
