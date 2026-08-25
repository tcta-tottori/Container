import { ContainerItem } from './types';

/**
 * コンテナの積載量（CBM・重量）をひとつの決まりで出すところ。
 *
 * これまで積載率が 999% のようにおかしくなっていたのは、品目の `cbm` の意味が
 * 取り込み元ごとにバラバラだったため。
 *   - CNS品目一覧マスタ (U列)   … その品目の「出荷合計CBM」（AQSSパッキングリストの残り値）
 *   - AQSS / JKP パーサ         … 「1個あたりCBM」
 * これをどちらもケース数に掛けていたので、合計が実際の何十倍にもなっていた。
 *
 * 一番あてになるのは Meas.（1ケースの外寸 cm）なので、こちらから
 * 1ケースあたりの体積を出す。マスタで Meas. を持つ品目は CBM 列も必ず持つので、
 * Meas. があるかぎり CBM 列は使わない。
 */

export type ContainerTypeKey = '20FT' | '40FT' | '40HQ';

export interface ContainerSpec {
  /** 表示名 */
  name: string;
  /** 内寸 長さ(mm) */
  lengthMm: number;
  /** 内寸 幅(mm) */
  widthMm: number;
  /** 内寸 高さ(mm) */
  heightMm: number;
  /** 内容積(m³) */
  cbm: number;
  /** 最大積載重量(kg) */
  maxKg: number;
}

/** コンテナ内寸（一般的なドライコンテナの実寸） */
export const CONTAINER_SPECS: Record<ContainerTypeKey, ContainerSpec> = {
  '20FT': { name: "20' DRY", lengthMm: 5898, widthMm: 2352, heightMm: 2393, cbm: 33.2, maxKg: 21770 },
  '40FT': { name: "40' DRY", lengthMm: 12032, widthMm: 2352, heightMm: 2393, cbm: 67.7, maxKg: 26680 },
  '40HQ': { name: "40' HIGH CUBE", lengthMm: 12032, widthMm: 2352, heightMm: 2698, cbm: 76.3, maxKg: 26460 },
};

/**
 * 実務上ここまでしか詰められないという割合。
 * 箱と箱の隙間・パレットの余白があるので、内容積いっぱいには積めない。
 * コンテナサイズの推定に使う。
 */
export const STUFFING_RATE = 0.85;

/** 1ケースあたりの体積として現実的な上限(m³)。これを超える値は誤りとみなす */
const MAX_CARTON_CBM = 2;

/** Meas文字列 "55*38*38"（cm） → [W, D, H] cm */
export function parseMeasCm(meas?: string): [number, number, number] | null {
  if (!meas) return null;
  const m = meas.match(/(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const dims: [number, number, number] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (dims.some((d) => !isFinite(d) || d <= 0)) return null;
  return dims;
}

/**
 * 1ケースあたりの体積(m³)。
 * 1) Meas.（cm）があればそこから出す（一番あてになる）
 * 2) 無ければ「1個あたりCBM × 入数」で出す（AQSS/JKP 由来の cbm はこの意味）
 */
export function cartonCbm(item: ContainerItem): number {
  const dims = parseMeasCm(item.measurements);
  if (dims) {
    const v = (dims[0] * dims[1] * dims[2]) / 1_000_000; // cm³ → m³
    if (v > 0 && v <= MAX_CARTON_CBM) return v;
  }
  if (item.cbm && item.cbm > 0 && item.packingQty > 0) {
    const v = item.cbm * item.packingQty;
    if (v <= MAX_CARTON_CBM) return v;
  }
  return 0;
}

/**
 * そのコンテナに入っているケース数。
 * ケース数が空の品目（バラ積みの部品など）は、総数と入数から数え直す。
 */
export function cartonCount(item: ContainerItem): number {
  if (item.caseCount && item.caseCount > 0) return item.caseCount;
  if (item.totalQty > 0 && item.packingQty > 0) return Math.ceil(item.totalQty / item.packingQty);
  return 0;
}

/** 品目1行分の体積(m³) */
export function itemCbm(item: ContainerItem): number {
  return cartonCbm(item) * cartonCount(item);
}

/** 品目1行分の重量(kg)。G.W. は1ケースあたりの値 */
export function itemWeightKg(item: ContainerItem): number {
  if (!item.grossWeight || item.grossWeight <= 0) return 0;
  return item.grossWeight * cartonCount(item);
}

/**
 * 積んだ量からコンテナの種類を推定する。
 * 隙間があるので内容積いっぱいには積めない前提（STUFFING_RATE）で、
 * 収まる一番小さいコンテナを選ぶ。
 */
export function estimateContainerType(totalCbm: number, totalKg: number): ContainerTypeKey {
  const order: ContainerTypeKey[] = ['20FT', '40FT', '40HQ'];
  for (const key of order) {
    const spec = CONTAINER_SPECS[key];
    if (totalCbm <= spec.cbm * STUFFING_RATE && totalKg <= spec.maxKg) return key;
  }
  return '40HQ';
}

export interface LoadSummary {
  /** 積載体積(m³) */
  totalCbm: number;
  /** 完了ぶんの体積(m³) */
  doneCbm: number;
  /** 残りの体積(m³) */
  remainCbm: number;
  /** 積載重量(kg) */
  totalKg: number;
  /** 完了ぶんの重量(kg) */
  doneKg: number;
  /** 残りの重量(kg) */
  remainKg: number;
  /** 体積を出せた品目があるか */
  hasCbm: boolean;
  /** 寸法(Meas.)を持つ品目数 */
  sizedCount: number;
  /** 推定したコンテナの種類 */
  containerType: ContainerTypeKey;
  /** 推定したコンテナの諸元 */
  spec: ContainerSpec;
  /** 積載率 0〜1（1 を超えることもある） */
  loadRatio: number;
  /** 重量率 0〜1 */
  weightRatio: number;
}

/** コンテナ1本ぶんの積載量をまとめて出す */
export function summarizeLoad(items: ContainerItem[], completedIds: Set<string>): LoadSummary {
  let totalCbm = 0, doneCbm = 0, totalKg = 0, doneKg = 0, sizedCount = 0;

  for (const it of items) {
    if (parseMeasCm(it.measurements)) sizedCount++;
    const cbm = itemCbm(it);
    const kg = itemWeightKg(it);
    totalCbm += cbm;
    totalKg += kg;
    if (completedIds.has(it.id)) {
      doneCbm += cbm;
      doneKg += kg;
    }
  }

  const containerType = estimateContainerType(totalCbm, totalKg);
  const spec = CONTAINER_SPECS[containerType];

  return {
    totalCbm,
    doneCbm,
    remainCbm: totalCbm - doneCbm,
    totalKg,
    doneKg,
    remainKg: totalKg - doneKg,
    hasCbm: totalCbm > 0,
    sizedCount,
    containerType,
    spec,
    loadRatio: spec.cbm > 0 ? totalCbm / spec.cbm : 0,
    weightRatio: spec.maxKg > 0 ? totalKg / spec.maxKg : 0,
  };
}
