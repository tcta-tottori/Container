/**
 * 応援コール（がんばれコール）のフレーズ集
 * 10分定期コール後の応援、およびヘッダーのコールボタンで使用
 */
export const CHEER_PHRASES: string[] = [
  'がんばれ、まさ！',
  'じっちゃん、がんばれ！',
  'まさ、ファイト！',
  'あと少し、がんばれ！',
  'まさ、その調子！',
  'じっちゃん、ファイト！',
  'よし、いい感じだ！',
  'まさ、最高！',
];

/** ランダムに応援フレーズを1つ返す */
export function getRandomCheer(): string {
  return CHEER_PHRASES[Math.floor(Math.random() * CHEER_PHRASES.length)];
}

/**
 * 経過時間コール後のあおりフレーズ集。
 * 元気な女性の声で、明るくあおるように読み上げる用。
 */
export const TAUNT_PHRASES: string[] = [
  'がんばれ、まさ',
  'ファイト、まさ',
  'おせおせ、まさ',
  '部品きらすなよ、まさ',
  'おそいぞ、まさ',
  'まさ、しっかり',
  'はしれよ、まさ',
  'がんばれ、じっちゃん',
  'きんちゃん、ファイト',
  '長谷川さーん、こっちにきて〜',
];

/** ランダムにあおりフレーズを1つ返す */
export function getRandomTaunt(): string {
  return TAUNT_PHRASES[Math.floor(Math.random() * TAUNT_PHRASES.length)];
}
