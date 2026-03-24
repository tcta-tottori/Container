/** 品目の種類 */
export type ItemType = 'ポリカバー' | '箱' | '部品' | 'その他';

/** コンテナ内の1品目 */
export interface ContainerItem {
  /** 一意ID（コンテナNo + 行インデックス） */
  id: string;
  /** 品番 (C列) */
  partNumber: string;
  /** 品名 (D列) */
  itemName: string;
  /** 代表機種 (E列) */
  representModel: string;
  /** 自動判定された種類 */
  type: ItemType;
  /** 入数（個/ケース） (F列) */
  packingQty: number;
  /** 入荷数量（総数） (G列) */
  totalQty: number;
  /** ケース数 (H列) */
  caseCount: number;
  /** パレット枚数 (I列) */
  palletCount: number;
  /** 端数（ケース） (J列) */
  fraction: number;
  /** 1パレットあたりケース数 (K列) */
  qtyPerPallet: number;
  /** 新建高コード（手動入力） */
  newPartNumber?: string;
  /** ITEM DESCRIPTION（品目説明） */
  description?: string;
  /** G.W.（総重量 KGS） */
  grossWeight?: number;
  /** CBM（容積 立方メートル） */
  cbm?: number;
  /** Meas.（外寸 例: 55*38*38） */
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
