/**
 * 「ドラム風」のコール。
 *
 * ドラマ『VIVANT』のドラムがスマホの読み上げアプリで話すときのような、
 * ていねいで落ち着いた、少し機械的な口調にコールの文を言い換える。
 * 声の感じ（トーン）は voiceSettings.ts の `drum` プリセットが受け持ち、
 * ここは文そのもの（口調）だけを変える。
 *
 * 言い換えは決まった規則だけで行う（毎回おなじ文になる）ので、
 * 一度作った音声は `ttsCache.ts` にそのまま取っておける。
 */

import type { VoiceProfile } from './voiceSettings';

/** 命令・あおりの言い方を、ていねいなお願いに直す表 */
const ENDING_RULES: [RegExp, string][] = [
  [/がんばれ[よー〜]*$/, 'がんばってください'],
  [/頑張れ[よー〜]*$/, 'がんばってください'],
  [/はしれ[よー〜]*$/, 'はしってください'],
  [/走れ[よー〜]*$/, 'はしってください'],
  [/いそげ[よー〜]*$/, 'いそいでください'],
  [/急げ[よー〜]*$/, 'いそいでください'],
  [/おせおせ$/, 'おしてください'],
  [/おせ[よー〜]*$/, 'おしてください'],
  [/やれ[よー〜]*$/, 'やってください'],
  [/こい[よー〜]*$/, 'きてください'],
  [/しっかり(しろ|せえ|せい)?[よー〜]*$/, 'しっかりしてください'],
  [/しろ[よー〜]*$/, 'してください'],
  [/(.+)すな[よー〜]*$/, '$1さないでください'],
  [/ファイト[ー〜]*$/, 'ファイトです'],
  [/(.+い)(ぞ|よ|な|ね)+$/, '$1です'],
  [/(.+)だ(ぞ|よ|な)*$/, '$1です'],
];

/** 呼び名につける敬称。すでに付いていればそのまま */
const HONORIFIC = /(さん|ちゃん|くん|君|さま|様|先輩|課長|部長|班長|係長)$/;

/** 区切りの記号（ここで文を分けて、1つずつ言い換える） */
const SPLIT = /[、，,！!。？?\s]+/;

/** 1 つの区切りを言い換える。言い換えられなければ null */
function convertClause(clause: string): string | null {
  for (const [re, to] of ENDING_RULES) {
    if (re.test(clause)) return clause.replace(re, to);
  }
  return null;
}

/** 呼び名らしい短い区切りか（「まさ」「じっちゃん」など） */
function looksLikeName(clause: string): boolean {
  return clause.length <= 6 && !/(です|ます|ください)$/.test(clause);
}

/**
 * コールの文をドラム風の口調に言い換える。
 *
 * 例:
 * - 「がんばれ、まさ」→「まささん、がんばってください。」
 * - 「おそいぞ、まさ」→「まささん、おそいです。」
 * - 「お願いします！」→「お願いします。」
 *
 * 品名や数量のように言い換える所が無い文は、語尾の「！」を「。」に
 * 落ち着かせるだけで、中身はそのまま読む。
 */
export function toDrumSpeech(text: string): string {
  const clauses = text.split(SPLIT).map((s) => s.trim()).filter(Boolean);
  if (clauses.length === 0) return text;

  const converted = clauses.map((c) => ({ src: c, out: convertClause(c) }));
  const anyConverted = converted.some((c) => c.out !== null);

  // 言い換えたところがある文だけ、残りの短い区切りを呼び名として前に出す
  const names: string[] = [];
  const body: string[] = [];
  for (const c of converted) {
    if (c.out !== null) body.push(c.out);
    else if (anyConverted && looksLikeName(c.src)) {
      names.push(HONORIFIC.test(c.src) ? c.src : `${c.src}さん`);
    } else body.push(c.src);
  }
  return `${[...names, ...body].join('、')}。`;
}

/** そのプロファイルで実際に読み上げる文（口調をドラム風にする設定なら言い換える） */
export function spokenText(text: string, profile: VoiceProfile): string {
  return profile.drumSpeech ? toDrumSpeech(text) : text;
}
