/**
 * アプリのバージョン情報。
 * 読込画面からバージョン表示を廃止し、メニュー下部に「Ver x.y  HH:MM」の形で表示する。
 */

export const APP_VERSION = '4.9';

/** ビルド日時（例: 2026.8.8 11:15）。ビルド時に next.config.mjs が埋め込む */
export const APP_UPDATED = process.env.NEXT_PUBLIC_BUILD_TIME || '---';

/** ビルド時刻だけを取り出したもの（例: 11:15） */
export const APP_UPDATED_TIME = APP_UPDATED.split(' ')[1] || APP_UPDATED;
