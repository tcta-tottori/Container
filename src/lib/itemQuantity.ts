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
