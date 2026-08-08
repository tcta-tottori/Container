import { ContainerItem } from './types';

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
