import { ItemType } from './types';

/**
 * 品番・品名のパターンからジャーポット製品かどうかを判定
 * JRI, JPI, JPK, JPV, JPH, JPG, JPD, JPC, JPT, JPX, JPW, SR-JW, SR-FCC 等の
 * 炊飯器・ポット製品のプレフィックスにマッチ
 */
const JAR_POT_PREFIXES = [
  'JRI-', 'JRI+', 'JPI-', 'JPI+',
  'JPK-', 'JPK+', 'JPV-', 'JPV+',
  'JPH-', 'JPH+', 'JPG-', 'JPG+',
  'JPD-', 'JPD+', 'JPC-', 'JPC+',
  'JPT-', 'JPT+', 'JPX-', 'JPX+',
  'JPW-', 'JPW+', 'JPM-', 'JPM+',
  'SR-JW', 'SR-FCC',
  'UBE-',
  'WMS-',
];

/**
 * 箱・半完成品のプレフィックス
 * PDRS, PDU, PVW, PDN, PVWB 等のプレフィックスにマッチ
 */
const BOX_PREFIXES = [
  'PDRS', 'PDU+', 'PDU-', 'PDUA', 'PDUB',
  'PVW+', 'PVW-', 'PVWB',
  'PDN',
];

/**
 * 部品キーワード（品名に含まれる場合に部品と判定）
 */
const PARTS_KEYWORDS = [
  'ﾌﾀﾚﾊﾞ', 'レバー', 'ﾚﾊﾞ',
  'ﾎｳﾈﾂｲﾀ', 'ホウネツイタ', '放熱板', '放热板',
  'ｽﾄｯﾊﾟｰ', 'ストッパー',
  'ﾎｷｮｳｲﾀ', '補強板',
  'ｽｲﾘｮｳｶﾊﾞｰ',
  'ﾊﾟｯｷﾝ', 'パッキン',
  'ﾘﾝｸ', 'リンク',
  'ｾﾞﾂｴﾝｼｰﾄ', 'ゼツエンシート',
  'ｶﾝｾｲﾍﾞﾝ', '完成弁',
  'ﾏｸﾞﾈｯﾄ', 'マグネット',
  'ﾀｰﾐﾅﾙ', 'ターミナル',
  'ﾋｭｰｽﾞ', 'ヒューズ',
  'ｽｲｯﾁ', 'スイッチ',
  'ﾌﾟﾗｸﾞ', 'プラグ',
  'ﾎﾞﾙﾄ', 'ボルト',
  'ｼｬﾌﾄ', 'シャフト',
  'ﾊﾞｯﾃﾘｰ', 'バッテリー',
  'LED',
  'POP',
  'ﾃﾞﾝｹﾞﾝｺｰﾄﾞ', '電源コード',
  'ﾋｰﾀｰ', 'ヒーター',
  'ｶﾞｲｼ', 'ガイシ',
  'ﾏｲｶ', 'マイカ',
  'ｵﾓﾘ',
  'ﾊﾟﾝﾁﾝｸﾞ',
  'ﾌﾛ-ﾄ', 'フロート',
  'ﾌｳﾁｶﾊﾞｰ',
  'ｳﾁﾌﾀｶﾊﾞｰ',
  'ﾌｱﾂﾍﾞﾝ',
];

/**
 * 箱（ハコ）パーツキーワード - 個装箱
 */
const BOX_KEYWORDS = [
  'ﾊｺ', 'ハコ', '箱',
  'ﾊﾝｶﾝｾｲ', '半完成',
  '容器組立',
  '電源BOX',
];

/**
 * 品名・品番・代表機種の情報から種類を自動判定する
 *
 * 判定順序:
 * 1. 品名に「ポリカバー」を含む → 'ポリカバー'
 * 2. 品名にジャーポット製品のプレフィックスを含む → 'ジャーポット'
 * 3. 品名に箱/半完成キーワードを含む → '箱'
 * 4. 品名に部品キーワードを含む → '部品'
 * 5. 品番パターンで判定（気高コードの分類文字）
 * 6. パレット情報による判定
 * 7. 上記以外 → 'その他'
 */
export function detectItemType(
  itemName: string,
  qtyPerPallet: number,
  palletCount: number,
  partNumber?: string
): ItemType {
  const name = itemName.trim();
  const pn = (partNumber || '').trim();

  // 1. ポリカバー（品名に含まれる場合）
  if (name.includes('ポリカバー') || name.includes('ﾎﾟﾘｶﾊﾞｰ')) {
    return 'ポリカバー';
  }

  // 2. ジャーポット製品（プレフィックスマッチ）
  for (const prefix of JAR_POT_PREFIXES) {
    if (name.startsWith(prefix) || name.includes(prefix)) {
      // 部品キーワードが含まれている場合は部品
      for (const kw of PARTS_KEYWORDS) {
        if (name.includes(kw)) return '部品';
      }
      // 箱キーワードが含まれている場合は箱
      for (const kw of BOX_KEYWORDS) {
        if (name.includes(kw)) return '箱';
      }
      return 'ジャーポット';
    }
  }

  // 3. 箱製品（プレフィックスマッチ）
  for (const prefix of BOX_PREFIXES) {
    if (name.startsWith(prefix) || name.includes(prefix)) {
      // 半完成品も箱カテゴリに含める
      return '箱';
    }
  }

  // 4. 箱キーワードマッチ
  for (const kw of BOX_KEYWORDS) {
    if (name.includes(kw)) return '箱';
  }

  // 5. 部品キーワードマッチ
  for (const kw of PARTS_KEYWORDS) {
    if (name.includes(kw)) return '部品';
  }

  // 6. 品番パターンによる判定
  if (pn) {
    // 品番に "A" が含まれるパターン（xxAxxxxx）は通常完成品
    // 品番に "P" が含まれるパターン（xxPxxxxx）は通常部品
    // 品番に "K" が含まれるパターン（xxKxxxxx）は通常箱
    const codeMatch = pn.match(/^3TG\d{3}([APKE])/);
    if (codeMatch) {
      const typeCode = codeMatch[1];
      if (typeCode === 'P') return '部品';
      if (typeCode === 'K') return '箱';
      if (typeCode === 'A') {
        // A = Assembly、パレット情報があればジャーポット
        if (qtyPerPallet > 0) return 'ジャーポット';
        return '箱';
      }
      if (typeCode === 'E') return '部品';
    }
  }

  // 7. パレット情報による判定
  if (qtyPerPallet === 0 && palletCount === 0) return '部品';

  // 8. デフォルト
  return 'その他';
}
