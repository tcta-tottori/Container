import { ContainerItem, ItemType } from './types';

/**
 * 内鍋の「大きい箱」とみなす入数のさかい目。
 *
 * これまでの内鍋は 1 ケース 8 個入り（46×46×29cm ほど）で、パレットには
 * 3 列 × 2 行 の 1 段 6 個で積む。
 * 3L JPV-T100 のように 1 ケース 12 個入りの大きい箱は箱そのものが長方形で、
 * 奥に横 2 個・手前に縦 3 個の 1 段 5 個で積む（40ft コンテナの実際の積み方）。
 */
export const NABE_BIG_BOX_MIN_PACKING_QTY = 9;

/** 大きい箱の内鍋か（1 段 5 個で積むほう） */
export function isBigNabeBox(type: ItemType | undefined, packingQty: number | undefined): boolean {
  return type === '鍋' && (packingQty ?? 0) >= NABE_BIG_BOX_MIN_PACKING_QTY;
}

/** 180 サイズ（段数が 1 つ少ない）か。品名で見る */
export function isLargeSizeName(itemName: string): boolean {
  return itemName.includes('180') || /18[RWCS]/.test(itemName);
}

/**
 * 内鍋の 1 段あたりの箱の数。
 *
 * - 従来の 8 個入り（46×46×29cm ほど）… 3 列 × 2 行 で 1 段 6 個
 * - 大きい箱（12 個入り）の 100・60 サイズ … 奥に横 2 個 ＋ 手前に縦 3 個 で 1 段 5 個
 * - 大きい箱（12 個入り）の 180 サイズ     … 風車（ピンホイール）状に 1 段 4 個
 *
 * 段数は 100・60 サイズが 5 段、180 サイズが 4 段。
 * つまり 1 パレットは 大きい箱: 100→25 / 180→16、従来: 100→30 / 180→24。
 */
export function nabePerLayer(
  type: ItemType | undefined, packingQty: number | undefined, itemName: string,
): number {
  if (!isBigNabeBox(type, packingQty)) return 6;
  return isLargeSizeName(itemName) ? 4 : 5;
}

/** 作業画面に出す PL / CT / pcs */
export interface DisplayQuantities {
  /** パレット枚数（PL） */
  pallets: number;
  /** 端数ケース数（CT）。検査で抜く1ケースを差し引いた数 */
  cartons: number;
  /** 総数（pcs） */
  pcs: number;
}

/**
 * 品目から、画面に出す PL / CT / pcs を求める。
 * 鍋・ジャーポットは検査を抜かない。それ以外は1ケース抜く。
 * 端数が0でパレットぴったりの場合は、1パレットを崩して検査分を抜く。
 */
export function displayQuantities(item: ContainerItem): DisplayQuantities {
  const rawFraction = item.fraction % 1 !== 0 ? Math.ceil(item.fraction) : item.fraction;
  const noInspection = item.type === '鍋' || item.type === 'ジャーポット';
  const breakPalletForInspection =
    !noInspection && rawFraction === 0 && item.palletCount > 0 && item.qtyPerPallet > 0;

  const pallets = breakPalletForInspection ? item.palletCount - 1 : item.palletCount;
  const cartons = noInspection
    ? rawFraction
    : breakPalletForInspection
      ? item.qtyPerPallet - 1
      : (rawFraction > 0 ? rawFraction - 1 : 0);

  return { pallets, cartons, pcs: Math.ceil(item.totalQty) };
}

/**
 * パレットを1つ下ろした後に画面に出る PL / CT を求める。
 * 「残り◯パレットと◯ケース」のコールを、画面の数字と必ず一致させるために使う。
 */
export function quantitiesAfterPalletRemoved(item: ContainerItem): DisplayQuantities {
  return displayQuantities({ ...item, palletCount: Math.max(0, item.palletCount - 1) });
}

/**
 * PL / CT を読み上げ文にする（例: 「3パレットと2ケース」）。
 * どちらも 0 のときは空文字を返す。
 */
export function quantityToSpeech(q: { pallets: number; cartons: number }): string {
  if (q.pallets > 0 && q.cartons > 0) return `${q.pallets}パレットと${q.cartons}ケース`;
  if (q.pallets > 0) return `${q.pallets}パレット`;
  if (q.cartons > 0) return `${q.cartons}ケース`;
  return '';
}
