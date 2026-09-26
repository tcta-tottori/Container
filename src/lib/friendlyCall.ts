/**
 * やさしい口調モードの言い換え。
 *
 * コールの文の語尾を、親しみのある話し方に直す。
 * - 「お願いします！」→「お願いね。」
 * - 「残り3品目です。」→「残り3品目だね。」
 * - 「ポリカバー。3パレットと2ケース。」→「ポリカバー。3パレットと2ケースね。」
 * - 完了のコールには「超嬉しい。」を足す
 * - 「注意、類似品があります。」→「類似品があるよ。気をつけてね。」
 *
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
const ALREADY_FRIENDLY = /(ね|よ|な|さま|嬉しい)$/;

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

/** 最後に足すひとこと */
const HAPPY = '超嬉しい';

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
  if (sentences.some((s) => COMPLETE.test(s))) out.push(HAPPY);
  return out.map((s, i) => {
    if (IN_PROGRESS.test(s)) return s;
    if (CALLING.test(s) && i < out.length - 1) return `${s}、`;
    return `${s}。`;
  }).join('');
}
