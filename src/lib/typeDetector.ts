import { ItemType } from './types';

/**
 * ポリカバー製品のプレフィックス
 * JRI, JPI, JPK, JPV, JPH, JPG, JPD, JPC, JPT, JPX, JPW, JPM 等の
 * 炊飯器・ポット製品のプレフィックスにマッチ → すべてポリカバー
 */
const POLYCOVER_PREFIXES = [
  'JRI-', 'JRI+', 'JPI-', 'JPI+',
  'JPK-', 'JPK+', 'JPV-', 'JPV+',
  'JPH-', 'JPH+', 'JPG-', 'JPG+',
  'JPD-', 'JPD+', 'JPC-', 'JPC+',
  'JPT-', 'JPT+', 'JPX-', 'JPX+',
  'JPW-', 'JPW+', 'JPM-', 'JPM+',
  'SR-JW', 'SR-FCC',
];

/**
 * 箱・半完成品のプレフィックス
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
 * 箱（ハコ）キーワード
 */
const BOX_KEYWORDS = [
  'ﾊｺ', 'ハコ', '箱',
  'ﾊﾝｶﾝｾｲ', '半完成',
  '容器組立',
  '電源BOX',
];

/**
 * 品名・品番の情報から種類を自動判定する
 *
 * 判定順序:
 * 1. 品名に「ポリカバー」を含む → 'ポリカバー'
 * 2. 品名がポリカバー製品のプレフィックスで始まる → 'ポリカバー'
 *    (ただし部品/箱キーワードが含まれる場合はそちらを優先)
 * 3. 品名に箱プレフィックス/キーワードを含む → '箱'
 * 4. 品名に部品キーワードを含む → '部品'
 * 5. 品番パターンで判定
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

  // 2. ポリカバー製品プレフィックス（JRI-, JPI-, JPK- 等はすべてポリカバー）
  for (const prefix of POLYCOVER_PREFIXES) {
    if (name.startsWith(prefix) || name.includes(prefix)) {
      // 部品キーワードが含まれている場合は部品
      for (const kw of PARTS_KEYWORDS) {
        if (name.includes(kw)) return '部品';
      }
      // 箱キーワードが含まれている場合は箱
      for (const kw of BOX_KEYWORDS) {
        if (name.includes(kw)) return '箱';
      }
      return 'ポリカバー';
    }
  }

  // 3. 箱製品（プレフィックスマッチ）
  for (const prefix of BOX_PREFIXES) {
    if (name.startsWith(prefix) || name.includes(prefix)) {
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
    const codeMatch = pn.match(/^3TG\d{3}([APKE])/);
    if (codeMatch) {
      const typeCode = codeMatch[1];
      if (typeCode === 'P') return '部品';
      if (typeCode === 'K') return '箱';
      if (typeCode === 'A') {
        // A = Assembly → ポリカバー
        if (qtyPerPallet > 0) return 'ポリカバー';
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

/**
 * 品名から色情報を抽出する
 * 括弧内のK=黒, W=白 等を判定
 */
export function extractColor(itemName: string): string | null {
  // (KB), (K), (KM), (KV), (KKB) etc. → 黒系
  // (W), (WS), (WM), (WG), (WY), (WP) etc. → 白系
  // (T), (TD) → その他の色
  const parenMatch = itemName.match(/\(([^)]+)\)/);
  if (!parenMatch) return null;

  const code = parenMatch[1];
  if (code.startsWith('K') || code.includes('KK')) return '黒';
  if (code.startsWith('W')) return '白';
  if (code.startsWith('T')) return '他色';
  return null;
}

/**
 * 品名から読み上げ用テキストを生成
 * - 「ポリカバー」を除去
 * - 括弧内の色コードを日本語に変換
 */
export function itemNameForSpeech(itemName: string): string {
  let name = itemName
    .replace(/ポリカバー/g, '')
    .replace(/ﾎﾟﾘｶﾊﾞｰ/g, '')
    .trim();

  // 括弧内の色コードを変換
  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const code = parenMatch[1];
    let colorName = '';
    if (code.startsWith('K') || code.includes('KK')) colorName = '黒';
    else if (code.startsWith('W')) colorName = '白';
    else if (code.startsWith('T')) colorName = '他色';

    if (colorName) {
      name = name.replace(/\([^)]+\)/, colorName);
    }
  }

  return name;
}

/**
 * 2つの品名の類似度を判定（色違いや1文字違い）
 */
export function areSimilarItems(name1: string, name2: string): boolean {
  if (name1 === name2) return false;

  // 括弧を除いた部分を比較
  const base1 = name1.replace(/\([^)]*\)/g, '').replace(/ポリカバー/g, '').trim();
  const base2 = name2.replace(/\([^)]*\)/g, '').replace(/ポリカバー/g, '').trim();

  // 色だけ違う場合
  if (base1 === base2) return true;

  // 1文字だけ違う場合
  if (Math.abs(base1.length - base2.length) <= 1) {
    const longer = base1.length >= base2.length ? base1 : base2;
    const shorter = base1.length < base2.length ? base1 : base2;
    let diffs = 0;
    let si = 0;
    for (let li = 0; li < longer.length && diffs <= 1; li++) {
      if (si < shorter.length && longer[li] === shorter[si]) {
        si++;
      } else {
        diffs++;
        if (longer.length === shorter.length) si++;
      }
    }
    if (diffs <= 1) return true;
  }

  return false;
}
