'use client';

/**
 * せせらぎモードの切り替えに使う煙の動画
 * ------------------------------------------------------------------
 * 黒地に白い煙が立ち込めて、また晴れていく10秒の映像。
 * 実測した濃さの移り変わりは次のとおり。
 *
 *   0.0〜1.0秒  ほぼ真っ暗（まだ煙が無い）
 *   1.0〜4.5秒  煙が立ち込めてくる
 *   4.5〜6.5秒  いちばん濃い
 *   6.5〜9.0秒  晴れていく
 *   9.0〜10.0秒 また真っ暗
 *
 * このうち「立ち込める〜晴れる」だけを使い、いちばん濃いところで
 * 画面を入れ替える。黒い所は screen 合成で透けるので、煙だけが重なる。
 *
 * 元は横向き(1280x720)なので、90度回して縦画面に使う。
 * 縦のまま cover で拡げると横が大きく切れてしまうが、回してからなら
 * ほとんど切らずに画面いっぱいに使える。
 */

const BASE = process.env.NODE_ENV === 'production' ? '/Container' : '';

export const MIST_VIDEO = `${BASE}/videos/mist-transition.mp4`;

/** 使い始める位置（秒）。煙が出てくる直前から */
export const MIST_FROM = 1.0;
/** いちばん濃くなる位置（秒）。ここで画面を入れ替える */
export const MIST_PEAK = 5.6;
/** 使い終わる位置（秒）。晴れきったところ */
export const MIST_END = 9.0;
/** 再生の速さ。切り替えが長くなりすぎないよう早回しする */
export const MIST_RATE = 2.9;

/** 元の画面が煙で覆われるまで(ms) */
export const MIST_IN_MS = Math.round(((MIST_PEAK - MIST_FROM) / MIST_RATE) * 1000);
/** 煙が晴れるまで(ms) */
export const MIST_CLEAR_MS = Math.round(((MIST_END - MIST_PEAK) / MIST_RATE) * 1000);
