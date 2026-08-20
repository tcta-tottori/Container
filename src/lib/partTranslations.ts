/**
 * AQSS04L 由来データのポリカバー以外の部品向け日本語表示変換。
 *
 * AQSS04L (Invoice) は以下の特性を持つ:
 *   - DESCRIPTION (B列): 英語の品種名 (例: "JAR POT", "flash_holder", "STEAM ROOT PACKING")
 *   - ITEM (E列): モデル名と中国語の説明が混在 (例: "PDZ+A40U 半成品出荷", "闪光支架 23F3N1")
 *
 * ポリカバー (UPPER LID ASSY) はそのまま表示し、それ以外の部品は
 *   英語 DESCRIPTION + 中国語 ITEM を可能な範囲で日本語訳した文字列を生成する。
 */

import { ContainerItem } from './types';
import { itemNameForSpeech } from './typeDetector';

/** 英語 DESCRIPTION → 日本語 */
const EN_DESCRIPTION_JP: Record<string, string> = {
  'JAR POT': 'ジャーポット',
  'CARTON BOX': '段ボール箱',
  'UPPER LID ASSY': '上蓋組立',
  'FRAME THIMBLE UNDER': '下口カバー',
  'GLASS PIPE HOLDER': '水量カバー',
  'ALUMITE RADIATION PLATE': '放熱板',
  'SPRING HINGE R': 'バネ蝶番',
  'STEAM ROOT PACKING': '蒸気弁パッキン',
  'PCB BASE': '基板座',
  'SCREW': 'ネジ',
  'CN PCB': 'CN基板',
  'CPE BAG': 'CPE袋',
  'Packing': 'パッキン',
  'flash_holder': 'フラッシュホルダー',
  'cut filter holder': 'カットフィルターホルダー',
  'sapphire_holder': 'サファイアホルダー',
  'head_stopper_r': 'ヘッドストッパー(右)',
  'head_stopper_l': 'ヘッドストッパー(左)',
  'heatsink holder': 'ヒートシンクホルダー',
  'body_ring': '本体リング',
  'body_upper_ASSY': '本体上組立',
  'inner_lid_lever_gasket': '内蓋レバーパッキン',
};

/** 中国語フレーズ → 日本語 (長いものから順に置換) */
const CN_PHRASE_JP: Array<[string, string]> = [
  ['顶盖组装成品', '上蓋組立品'],
  ['大壳套环下', '下口カバー'],
  ['显示管固定胶板', '水量カバー'],
  ['基板壳组装', '基板ケース組立'],
  ['主体上盖组装', '本体上蓋組立'],
  ['压力安全阀', '圧力安全弁'],
  ['超压胶圈', '圧力パッキン'],
  ['内盖罩胶圈', '内蓋カバーパッキン'],
  ['负压阀胶圈', '負圧弁パッキン'],
  ['闪光支架', 'フラッシュホルダー'],
  ['滤光片支架', 'カットフィルターホルダー'],
  ['蓝宝石支架', 'サファイアホルダー'],
  ['头部塞子', 'ヘッドストッパー'],
  ['主体环', '本体リング'],
  ['表面处理', '表面処理'],
  ['出荷编号', '出荷番号'],
  ['半成品出荷', '半製品出荷'],
  ['单品出荷', '単品出荷'],
  ['气高专用', '気高専用'],
  ['杯子组装', 'カップ組立'],
  ['放热板', '放熱板'],
  ['弹簧轴右', 'バネ蝶番(右)'],
  ['弹簧轴左', 'バネ蝶番(左)'],
  ['基板座', '基板座'],
  ['高温注意', '高温注意'],
  ['氧化', '酸化'],
  ['胶袋', '袋'],
  ['香槟金', 'シャンパンゴールド'],
  ['主体', '本体'],
  ['组装', '組立'],
  ['基板', '基板'],
  ['胶圈', 'パッキン'],
  ['支架', 'ホルダー'],
  ['塞子', 'ストッパー'],
  ['右', '右'],
  ['左', '左'],
];

/**
 * 英語 DESCRIPTION を日本語に翻訳。
 * 大文字小文字を無視して完全一致 → 部分一致の順に検索。
 * 該当しない場合は元の文字列を返す。
 */
export function translateEnDescription(description: string): string {
  if (!description) return '';
  const key = description.trim();
  if (EN_DESCRIPTION_JP[key]) return EN_DESCRIPTION_JP[key];

  const upper = key.toUpperCase();
  for (const [en, jp] of Object.entries(EN_DESCRIPTION_JP)) {
    if (en.toUpperCase() === upper) return jp;
  }
  for (const [en, jp] of Object.entries(EN_DESCRIPTION_JP)) {
    if (upper.includes(en.toUpperCase())) return jp;
  }
  return key;
}

/**
 * 中国語を含む文字列内のフレーズを日本語に置換。
 * モデルコードやサイズ等の英数字は維持。
 */
export function translateChineseInText(text: string): string {
  if (!text) return '';
  let result = text;
  for (const [cn, jp] of CN_PHRASE_JP) {
    if (result.includes(cn)) {
      result = result.split(cn).join(jp);
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

/** 文字列に CJK 漢字が含まれるか */
function hasChinese(text: string): boolean {
  return /[一-鿿㐀-䶿]/.test(text);
}

/**
 * 型式コードを抽出する。
 * 種類名・中国語・電圧などのノイズのみ除去し、コード自体（+ - U (KZ) サイズ等）は整形せずそのまま残す。
 */
function extractModelCode(item: ContainerItem): string {
  let m = (item.itemName || item.representModel || '').trim();
  // 埋め込まれた種類名・ラベル（和文/半角カナ）を除去
  m = m.replace(/段ボール箱|放熱板|彩盒|ジャーポット|半成?品出荷|ホウネツイタ|ﾎｳﾈﾂｲﾀ|タイプ|ﾀｲﾌﾟ/g, ' ');
  // 残った中国語（CJK漢字）を除去
  m = m.replace(/[一-鿿㐀-䶿]+/g, ' ');
  // 電圧表記（110V/220V 等）を除去
  m = m.replace(/\s*\d{2,3}V(?![A-Za-z0-9])/g, ' ');
  // 空の括弧を除去
  m = m.replace(/[（(]\s*[）)]/g, ' ');
  // 余分な空白・前後の区切り記号を整理（コード内の + - は保持）
  m = m.replace(/\s+/g, ' ').replace(/^[\s/]+|[\s/]+$/g, '').trim();
  return m;
}

/**
 * ポリカバー以外の部品向けに、日本語表示用の品名を生成。
 *   英語 DESCRIPTION → 日本語訳
 *   中国語 ITEM (rawItemName) → 日本語訳
 * 両方ある場合は「日本語DESCRIPTION ／ 日本語ITEM」形式で結合。
 * 翻訳対象なし (ポリカバー or 情報なし) の場合は null を返す。
 *
 * 例外: ジャーポット・放熱板・段ボール箱は「型式 + ラベル」で表示する。
 *   ジャーポット → 型式のみ（例: PDZ+A40U）
 *   放熱板       → 型式 + 放熱板（例: JPW+G10S 放熱板）
 *   段ボール箱   → 型式 + 箱（例: PDU-A40A 箱）
 */
export function buildJapanesePartName(item: ContainerItem): string | null {
  if (item.type === 'ポリカバー') return null;

  const enDesc = item.description?.trim() || '';
  const enUpper = enDesc.toUpperCase();

  const isJarPot = item.type === 'ジャーポット' || enUpper.includes('JAR POT');
  const isBox = item.type === '箱' || enUpper.includes('CARTON BOX');
  const isRadiation = enUpper.includes('RADIATION PLATE');
  if (isJarPot || isBox || isRadiation) {
    const model = extractModelCode(item);
    if (isJarPot) return model || null;
    const label = isBox ? '箱' : '放熱板';
    return model ? `${model} ${label}` : label;
  }

  const raw = item.rawItemName?.trim() || '';

  const jpDesc = enDesc ? translateEnDescription(enDesc) : '';
  let jpRaw = raw && hasChinese(raw) ? translateChineseInText(raw) : raw;

  // 中国語訳が英語訳と同じ語で始まる場合 (例: "フラッシュホルダー" と "フラッシュホルダー 23F3N1")
  // 重複部分を取り除き、モデルコード等の残りだけ残す。
  if (jpDesc && jpRaw && jpRaw.startsWith(jpDesc)) {
    jpRaw = jpRaw.slice(jpDesc.length).replace(/^[\s\-\/]+/, '').trim();
  }

  const parts: string[] = [];
  if (jpDesc) parts.push(jpDesc);
  if (jpRaw && jpRaw !== jpDesc) parts.push(jpRaw);

  if (parts.length === 0) return null;
  return parts.join(' ／ ');
}

/**
 * コール（読み上げ）に使う品名。
 *
 * 画面に出している表示名をそのまま読む。部品の表示名が
 * 「日本語名 ／ 型式など」の形になっている場合は、先頭の表示名だけを読み、
 * 詳しい型式までは読み上げない（コールを短くするため）。
 */
export function itemNameForCall(item: ContainerItem): string {
  const jp = buildJapanesePartName(item);
  if (jp) {
    const head = jp.split('／')[0].trim() || jp;
    return itemNameForSpeech(head);
  }
  return itemNameForSpeech(item.itemName);
}
