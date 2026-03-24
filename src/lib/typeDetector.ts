import { ItemType } from './types';

/**
 * ===== 種類の自動分類ルール =====
 *
 * 判定優先順位:
 *   1. AQSS04L の ITEM DESCRIPTION（最優先）→ detectTypeByDescription
 *   2. 气高编号の規格（先頭一致）→ detectTypeByItemName
 *   3. どちらも情報がない場合 → 'その他'
 *
 * 鍋（ｳﾁﾅﾍﾞ）はどの段階でも品名に含まれていれば優先判定
 */

/**
 * ルール① AQSS04L の ITEM DESCRIPTION で判定
 */
export function detectTypeByDescription(description: string): ItemType | null {
  if (!description) return null;
  const desc = description.toUpperCase().trim();
  if (!desc) return null;

  if (desc.includes('UPPER LID ASSY')) return 'ポリカバー';
  if (desc.includes('JAR POT')) return 'ジャーポット';
  if (desc.includes('CARTON BOX')) return '箱';
  // ITEM DESCRIPTIONがあるが上記に該当しない → 部品
  return '部品';
}

/**
 * ルール② 气高编号の規格（品名）で判定 — 先頭一致
 */
export function detectTypeByItemName(itemName: string): ItemType {
  const name = itemName.trim();

  // 鍋判定（品名にｳﾁﾅﾍﾞ・ウチナベ・内鍋を含む）
  if (name.includes('ｳﾁﾅﾍﾞ') || name.includes('ウチナベ') || name.includes('内鍋')) {
    return '鍋';
  }

  // ポリカバー: JP*, JRI*, JKX*, SR* で始まる
  if (/^(JP[A-Z]|JRI|JKX|SR)/.test(name)) return 'ポリカバー';

  // ジャーポット: PDR*, PDU*, PVW* で始まる
  if (/^(PDR|PDU|PVW)/.test(name)) return 'ジャーポット';

  // 箱: 彩盒 で始まる
  if (name.startsWith('彩盒')) return '箱';

  // それ以外 → 部品
  return '部品';
}

/**
 * 品名・品番の情報から種類を自動判定する（マスタにD列が無い場合のフォールバック）
 *
 * 判定フロー:
 * 1. descriptionがあれば → ルール①（AQSS04L ITEM DESCRIPTION）
 * 2. itemName/itemNameKetakaがあれば → ルール②（規格の先頭パターン）
 * 3. 両方なし → 'その他'
 */
export function detectItemType(
  itemName: string,
  qtyPerPallet: number,
  palletCount: number,
  partNumber?: string,
  description?: string,
  itemNameKetaka?: string,
): ItemType {
  void qtyPerPallet;
  void palletCount;
  void partNumber;

  // 鍋は最優先（品名のどこかにｳﾁﾅﾍﾞが含まれる）
  const allNames = [itemName, itemNameKetaka || ''].join('');
  if (allNames.includes('ｳﾁﾅﾍﾞ') || allNames.includes('ウチナベ') || allNames.includes('内鍋')) {
    return '鍋';
  }

  // ルール① AQSS04L ITEM DESCRIPTION（最優先）
  if (description) {
    const result = detectTypeByDescription(description);
    if (result) return result;
  }

  // ルール② 气高编号の規格 or 品名（先頭一致）
  const nameForRule2 = itemNameKetaka || itemName;
  if (nameForRule2) {
    return detectTypeByItemName(nameForRule2);
  }

  // 両方なし
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
  if (parenMatch) {
    const code = parenMatch[1];
    if (code.startsWith('K') || code.includes('KK')) return '黒';
    if (code.startsWith('W')) return '白';
    if (code.startsWith('T')) return '他色';
    return null;
  }

  // 括弧なしパターン: JRI-H100KKB, JPV-X100K 等、末尾の色コードを検出
  // ポリカバー系プレフィックス(JRI-, JPI-, JPV-, JPK-, JPH-等)の品名のみ対象
  const name = itemName.replace(/ポリカバー/g, '').replace(/ﾎﾟﾘｶﾊﾞｰ/g, '').trim();
  if (/^(JRI|JPI|JPV|JPK|JPH|JPA|JPB|JPG|JRG|JRB)-/.test(name)) {
    // 末尾の色コード: KKB, KB, KM, KV, K, WS, WM, WG, WY, WP, W, TD, T
    const suffixMatch = name.match(/(KKB|KB|KM|KV|K|WS|WM|WG|WY|WP|W|TD|T)$/);
    if (suffixMatch) {
      const code = suffixMatch[1];
      if (code.startsWith('K') || code.includes('KK')) return '黒';
      if (code.startsWith('W')) return '白';
      if (code.startsWith('T')) return '他色';
    }
  }

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

/** 類似の理由 */
export type SimilarityReason = 'color' | 'name' | null;

/**
 * 2つの品名の類似理由を返す
 * 数字の違い（10 vs 18等）は類似とみなさない
 */
export function getSimilarityReason(name1: string, name2: string): SimilarityReason {
  if (name1 === name2) return null;
  const base1 = name1.replace(/\([^)]*\)/g, '').replace(/ポリカバー/g, '').trim();
  const base2 = name2.replace(/\([^)]*\)/g, '').replace(/ポリカバー/g, '').trim();
  if (base1 === base2) return 'color';
  // 数字の違いは類似とみなさない
  if (base1.replace(/\d/g, '') === base2.replace(/\d/g, '') && base1 !== base2) return null;
  if (Math.abs(base1.length - base2.length) <= 1) {
    const longer = base1.length >= base2.length ? base1 : base2;
    const shorter = base1.length < base2.length ? base1 : base2;
    let diffs = 0, si = 0;
    for (let li = 0; li < longer.length && diffs <= 1; li++) {
      if (si < shorter.length && longer[li] === shorter[si]) { si++; }
      else { diffs++; if (longer.length === shorter.length) si++; }
    }
    if (diffs <= 1) return 'name';
  }
  return null;
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

  // 数字の違いは類似とみなさない（10 vs 18等）
  if (base1.replace(/\d/g, '') === base2.replace(/\d/g, '') && base1 !== base2) return false;

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
