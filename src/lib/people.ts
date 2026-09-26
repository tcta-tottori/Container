/**
 * 人物出現。
 *
 * 一覧のところ（縦向きなら画面の下半分、横向きなら右半分）に、選んだ人が
 * ゆっくり現れて、しばらく居て、ゆっくり消える。
 * スマホのメニューからも、ウォッチのコールの選択からも出せる。
 *
 * 「常時表示」にすると、10 秒で消えずにずっと居る。
 * 一覧を見たいときは 1 回タップすると消えて、数秒たつとまた出てくる。
 */

/** 配信するときの置き場所（mistVideo.ts と同じ決まり） */
const BASE = process.env.NODE_ENV === 'production' ? '/Container' : '';

/** 出せる人 */
export interface Person {
  /** ウォッチとやり取りする ID */
  id: string;
  /** 画面のボタンに出す名前 */
  name: string;
  /** 写真の場所（public 配下） */
  image: string;
}

/** 出せる人。並び順がそのままボタンの並びになる */
export const PEOPLE: readonly Person[] = [
  { id: 'yamamoto', name: '山本将', image: `${BASE}/people/yamamoto.webp` },
  { id: 'kotani', name: '小谷', image: `${BASE}/people/kotani.webp` },
  { id: 'nagamura', name: '長村', image: `${BASE}/people/nagamura.webp` },
];

/** ID から人を探す。知らない ID なら null */
export function findPerson(id: string | undefined | null): Person | null {
  if (!id) return null;
  return PEOPLE.find((p) => p.id === id) ?? null;
}

/** ウォッチから届く「人物出現」の合図（arg は "person:yamamoto" の形） */
export const PERSON_CALL_PREFIX = 'person:';

/** 現れきるまで（ミリ秒） */
export const PERSON_FADE_IN_MS = 3000;

/** 消えきるまで（ミリ秒） */
export const PERSON_FADE_OUT_MS = 3000;

/** 出てから消えるまでの合計（ミリ秒）。出入りのフェードもこの中に入る */
export const PERSON_TOTAL_MS = 10000;

/** タップで消したときに、消えるまで（ミリ秒） */
export const PERSON_DISMISS_MS = 450;

/** 常時表示で、タップして消えたあと、また出てくるまで（ミリ秒） */
export const PERSON_RETURN_MS = 4000;
