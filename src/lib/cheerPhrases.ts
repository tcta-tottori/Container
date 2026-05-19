/**
 * 応援コール（がんばれコール）のフレーズ集
 * 10分定期コール後の応援、およびヘッダーのコールボタンで使用
 */
export const CHEER_PHRASES: string[] = [
  'がんばれ、まさ',
  '部品きらすなよ、まさ',
  'しっかり、まさ',
  'まさ、ファイト',
  'じっちゃん、ファイト',
  '寝るなよ、ふくいくん',
];

/** ランダムに応援フレーズを1つ返す */
export function getRandomCheer(): string {
  return CHEER_PHRASES[Math.floor(Math.random() * CHEER_PHRASES.length)];
}
