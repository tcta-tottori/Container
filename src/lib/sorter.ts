import { ContainerItem, ItemType } from './types';

/** 種類の優先順位 */
const TYPE_ORDER: Record<ItemType, number> = {
  'ポリカバー': 1,
  'ジャーポット': 2,
  '箱': 3,
  '部品': 4,
  'その他': 5,
};

/**
 * ポリカバーのサブソート順を返す
 * "100"含む → 1、"180"含む → 2、その他 → 3
 */
function getPolycoverSubOrder(itemName: string): number {
  if (itemName.includes('100')) return 1;
  if (itemName.includes('180')) return 2;
  return 3;
}

/**
 * コンテナ品目を並べ替える
 *
 * 第1キー: 種類順 → ポリカバー(1) → ジャーポット(2) → 箱(3) → 部品(4)
 * 第2キー: ポリカバーのみ → "100"含む(1) → "180"含む(2) → その他(3)
 * 第3キー: 品名の文字列昇順（日本語ロケール）
 */
export function sortItems(items: ContainerItem[]): ContainerItem[] {
  return [...items].sort((a, b) => {
    // 第1キー: 種類順
    const typeA = TYPE_ORDER[a.type] ?? 5;
    const typeB = TYPE_ORDER[b.type] ?? 5;
    if (typeA !== typeB) return typeA - typeB;

    // 第2キー: ポリカバーのみサブソート
    if (a.type === 'ポリカバー') {
      const subA = getPolycoverSubOrder(a.itemName);
      const subB = getPolycoverSubOrder(b.itemName);
      if (subA !== subB) return subA - subB;
    }

    // 第3キー: 品名の文字列昇順（日本語ロケール）
    return a.itemName.localeCompare(b.itemName, 'ja');
  });
}
