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

/* ===== ドラムパッドのセリフ =====
 * ボタンを押すと決まったセリフをドラムの声で話す。
 * 参考: ヒヨプロ「Flutter で VIVANT のドラムが使用するアプリを再現してみた」の
 * serifMap（「ボタン名」:「セリフ」の組）と同じ作り。
 * 中身は設定画面から変えられ、localStorage に保存する。 */

const SERIF_KEY = 'cns_drum_serifs';

/** ドラムパッドの 1 つのボタン */
export interface DrumSerif {
  /** ボタンに出す名前 */
  label: string;
  /** 話すセリフ */
  text: string;
}

/** 初期のセリフ（荷降ろしの現場で使う合図を、ドラムの口調で） */
export const DEFAULT_DRUM_SERIFS: DrumSerif[] = [
  { label: 'ドラムです',   text: 'ドラムです。' },
  { label: 'お願いします', text: 'お願いします。' },
  { label: 'ありがとう',   text: 'ありがとうございます。' },
  { label: 'おつかれさま', text: 'おつかれさまです。' },
  { label: '急いで',       text: '急いでください。' },
  { label: '気をつけて',   text: '足元に気をつけてください。' },
  { label: '休憩',         text: '休憩しましょう。' },
  { label: '大丈夫',       text: '大丈夫です。' },
];

function cleanSerifs(list: unknown): DrumSerif[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is DrumSerif => !!x && typeof x === 'object'
      && typeof (x as DrumSerif).text === 'string')
    .map((x) => ({
      label: (typeof x.label === 'string' ? x.label : '').trim(),
      text: x.text.trim(),
    }))
    .filter((x) => x.text.length > 0)
    .map((x) => ({ label: x.label || x.text, text: x.text }));
}

/** 保存されたセリフを読む（無ければ初期のセリフ） */
export function loadDrumSerifs(): DrumSerif[] {
  if (typeof window === 'undefined') return [...DEFAULT_DRUM_SERIFS];
  try {
    const raw = localStorage.getItem(SERIF_KEY);
    if (raw) {
      const list = cleanSerifs(JSON.parse(raw));
      if (list.length > 0) return list;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_DRUM_SERIFS];
}

/** セリフを保存する（セリフが空のものは除く） */
export function saveDrumSerifs(list: DrumSerif[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(SERIF_KEY, JSON.stringify(cleanSerifs(list))); } catch { /* ignore */ }
}
