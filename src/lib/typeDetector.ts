import { ItemType } from './types';

/**
 * 品名とパレット情報から種類を自動判定する
 *
 * ルール:
 * 1. 品名に「ポリカバー」を含む → 'ポリカバー'
 * 2. 品名に「ジャーポット」を含む → 'ジャーポット'（将来対応）
 * 3. 1パレット(K列) == 0 かつ パレット枚数(I列) == 0 or 空 → '部品'
 * 4. 上記以外 → '箱'
 */
export function detectItemType(
  itemName: string,
  qtyPerPallet: number,
  palletCount: number
): ItemType {
  if (itemName.includes('ポリカバー')) return 'ポリカバー';
  if (itemName.includes('ジャーポット')) return 'ジャーポット';
  if (qtyPerPallet === 0 && palletCount === 0) return '部品';
  return '箱';
}
