/**
 * アプリのバージョン情報。
 * 読込画面からバージョン表示を廃止し、メニュー下部に「Ver x.y  YYYY.M.D HH:MM」の形で表示する。
 * 時刻だけだと、いつ更新されたものが入っているのか分からないため日付も出す。
 */

export const APP_VERSION = '7.5';

/** ビルド日時（例: 2026.8.8 11:15）。ビルド時に next.config.mjs が埋め込む */
export const APP_UPDATED = process.env.NEXT_PUBLIC_BUILD_TIME || '---';
