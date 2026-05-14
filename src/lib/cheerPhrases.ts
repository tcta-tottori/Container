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
