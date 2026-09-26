/**
 * やさしい口調モードの言い換え。
 *
 * コールの文の語尾を、親しみのある話し方に直す。
 * - 「お願いします！」→「お願いね。」
 * - 「残り3品目です。」→「残り3品目だね。」
 * - 「ポリカバー。3パレットと2ケース。」→「ポリカバー。3パレットと2ケースね。」
 * - 完了のコールには「超嬉しい、超嬉しい。」を足す（うれしい気持ちは 2 回くり返して伝える）
 * - 全品目が終わったら「さすがね、おめでとう。」とほめる
 * - 合図だけのコールは「お願いね、お願いね。」と 2 回くり返す
 * - 「注意、類似品があります。」→「類似品があるよ。気をつけてね。」
 *
 * しゃべり方の参考: 語尾は「〜ね」「〜よ」「〜あるよ」でやわらかく語りかけ、
 * 気持ちを伝える言葉は 2 回くり返して強調する。
 * 決まった規則だけで直す（毎回おなじ文になる）ので、
 * 一度作った音声は `ttsCache.ts` にそのまま取っておける。
 */

/** 文の終わりの言い方を直す表（上から順に試し、最初に当たったもので直す） */
const ENDING_RULES: [RegExp, string][] = [
  // 類似品の注意は「注意、」を外して「〜があるよ」（あとに「気をつけてね」を足す）
  [/^(?:注意、)?(.*類似品が)あります$/, '$1あるよ'],
  [/お願いします$/, 'お願いね'],
  [/(お疲れ様|おつかれさま|お疲れさま)でした$/, 'お疲れさま'],
  [/ませんでした$/, 'なかったね'],
  [/でした$/, 'だったね'],
  [/しました$/, 'したね'],
  [/ありません$/, 'ないね'],
  [/あります$/, 'あるね'],
  [/ます$/, 'ますね'],
  [/(い)です$/, '$1ね'],
  [/です$/, 'だね'],
];

/** もう親しみのある終わり方になっているか（重ねて「ね」を付けないため） */
const ALREADY_FRIENDLY = /(ね|よ|な|さま|嬉しい|おめでとう)$/;

/** 読み上げの途中を示す終わり方（「取得中...」など）。言い換えない */
const IN_PROGRESS = /(\.\.\.|…)$/;

/** 完了を伝える文か */
const COMPLETE = /完了/;

/** 呼びかけ（「長谷川さん！」）。次の文と「、」でつなぐ */
const CALLING = /(さん|ちゃん|くん)$/;

/** 類似品の注意の文か */
const SIMILAR = /類似品が/;

/** 類似品の注意のあとに足すひとこと */
const CAREFUL = '気をつけてね';

/** 完了のあとに足すひとこと（2 回くり返して気持ちを強く伝える） */
const HAPPY = '超嬉しい、超嬉しい';

/** 全品目が終わったときのほめ言葉 */
const PRAISE = 'さすがね、おめでとう';

/** 全品目が終わったことを伝える文か */
const ALL_COMPLETE = /全品目.*完了/;

/** 合図の「お願いね」。合図だけのコールでは 2 回くり返す */
const REQUEST = 'お願いね';

/** 1 つの文の終わり方を直す。最後の文だけは、名詞で終わっていても「ね」を付ける */
function convertSentence(sentence: string, isLast: boolean): string {
  if (IN_PROGRESS.test(sentence)) return sentence;
  for (const [re, to] of ENDING_RULES) {
    if (re.test(sentence)) return sentence.replace(re, to);
  }
  if (isLast && !ALREADY_FRIENDLY.test(sentence) && !COMPLETE.test(sentence)) return `${sentence}ね`;
  return sentence;
}

/**
 * コールの文を、やさしい口調に言い換える。
 * 文は「。」「！」「？」で区切って 1 つずつ直し、「。」でつなぎ直す。
 */
export function toFriendlySpeech(text: string): string {
  const sentences = text.split(/[。！!？?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) return text;
  const out = sentences.map((s, i) => convertSentence(s, i === sentences.length - 1));
  // 類似品の注意は、最後の注意のすぐあとに 1 回だけ「気をつけてね」を足す
  const lastSimilar = sentences.map((s) => SIMILAR.test(s)).lastIndexOf(true);
  if (lastSimilar >= 0) out.splice(lastSimilar + 1, 0, CAREFUL);
  // 合図だけのコール（「お願いします！」「長谷川さん！お願いします！」）は 2 回くり返す
  const last = out.length - 1;
  if (out[last] === REQUEST && out.slice(0, last).every((s) => CALLING.test(s))) {
    out[last] = `${REQUEST}、${REQUEST}`;
  }
  if (sentences.some((s) => ALL_COMPLETE.test(s))) {
    // お疲れさまの前でほめる
    const tired = out.findIndex((s) => s === 'お疲れさま');
    out.splice(tired >= 0 ? tired : out.length, 0, PRAISE);
  }
  if (sentences.some((s) => COMPLETE.test(s))) out.push(HAPPY);
  return out.map((s, i) => {
    if (IN_PROGRESS.test(s)) return s;
    if (CALLING.test(s) && i < out.length - 1) return `${s}、`;
    return `${s}。`;
  }).join('');
}
