import { ContainerItem, ItemType } from './types';

/** 種類の優先順位 */
const TYPE_ORDER: Record<ItemType, number> = {
  'ポリカバー': 1,
  'ジャーポット': 2,
  '箱': 3,
  '部品': 4,
  '鍋': 5,
  'その他': 6,
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
 */
export function sortItems(items: ContainerItem[]): ContainerItem[] {
  return [...items].sort((a, b) => {
    const typeA = TYPE_ORDER[a.type] ?? 4;
    const typeB = TYPE_ORDER[b.type] ?? 4;
    if (typeA !== typeB) return typeA - typeB;

    if (a.type === 'ポリカバー') {
      const subA = getPolycoverSubOrder(a.itemName);
      const subB = getPolycoverSubOrder(b.itemName);
      if (subA !== subB) return subA - subB;
    }

    return a.itemName.localeCompare(b.itemName, 'ja');
  });
}
