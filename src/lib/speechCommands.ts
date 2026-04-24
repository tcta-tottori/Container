/** 音声コマンド定義 */
export type VoiceAction =
  | 'MOVE_NEXT'
  | 'MOVE_PREV'
  | 'DELETE_CURRENT'
  | 'ANNOUNCE'
  | 'INCREASE_QTY'
  | 'DECREASE_QTY'
  | 'QUERY_CURRENT_QTY'
  | 'QUERY_REMAINING'
  | 'QUERY_PALLET'
  | 'QUERY_FRACTION'
  | 'CONFIRM_OK'
  | 'CONTAINER_SUMMARY'
  | 'QUERY_PROGRESS'
  | 'UNDO_DECREASE'
  | 'QUERY_TYPE_COUNT'
  | 'MASA_CHEER'
  | 'WEATHER'
  | 'TEMPERATURE'
  | 'TOTTORI_NEWS'
  | 'FINANCE_NEWS'
  | 'STOP_SPEECH';

/** キーワード → アクション マッピング */
const VOICE_COMMANDS: [string, VoiceAction][] = [
  ['次', 'MOVE_NEXT'],
  ['つぎ', 'MOVE_NEXT'],
  ['前', 'MOVE_PREV'],
  ['まえ', 'MOVE_PREV'],
  ['完了', 'DELETE_CURRENT'],
  ['かんりょう', 'DELETE_CURRENT'],
  ['読み上げ', 'ANNOUNCE'],
  ['よみあげ', 'ANNOUNCE'],
  ['増やす', 'INCREASE_QTY'],
  ['ふやす', 'INCREASE_QTY'],
  ['プラス', 'INCREASE_QTY'],
  ['ぷらす', 'INCREASE_QTY'],
  ['減らす', 'DECREASE_QTY'],
  ['へらす', 'DECREASE_QTY'],
  ['マイナス', 'DECREASE_QTY'],
  ['まいなす', 'DECREASE_QTY'],
  ['数量', 'QUERY_CURRENT_QTY'],
  ['すうりょう', 'QUERY_CURRENT_QTY'],
  ['残り', 'QUERY_REMAINING'],
  ['のこり', 'QUERY_REMAINING'],
  ['パレット何枚', 'QUERY_PALLET'],
  ['ぱれっとなんまい', 'QUERY_PALLET'],
  ['パレット数', 'QUERY_PALLET'],
  ['端数', 'QUERY_FRACTION'],
  ['はすう', 'QUERY_FRACTION'],
  ['お願いします', 'CONFIRM_OK'],
  ['おねがいします', 'CONFIRM_OK'],
  ['okです', 'CONFIRM_OK'],
  ['ok', 'CONFIRM_OK'],
  ['オッケー', 'CONFIRM_OK'],
  ['おっけー', 'CONFIRM_OK'],
  ['オーケー', 'CONFIRM_OK'],
  ['おーけー', 'CONFIRM_OK'],
  ['概要', 'CONTAINER_SUMMARY'],
  ['がいよう', 'CONTAINER_SUMMARY'],
  ['コンテナ', 'CONTAINER_SUMMARY'],
  ['こんてな', 'CONTAINER_SUMMARY'],
  ['進捗', 'QUERY_PROGRESS'],
  ['しんちょく', 'QUERY_PROGRESS'],
  ['状況', 'QUERY_PROGRESS'],
  ['じょうきょう', 'QUERY_PROGRESS'],
  ['戻して', 'UNDO_DECREASE'],
  ['もどして', 'UNDO_DECREASE'],
  ['元に戻', 'UNDO_DECREASE'],
  ['もとにもど', 'UNDO_DECREASE'],
  ['何種類', 'QUERY_TYPE_COUNT'],
  ['なんしゅるい', 'QUERY_TYPE_COUNT'],
  ['まさ', 'MASA_CHEER'],
  ['マサ', 'MASA_CHEER'],
  ['今日の天気', 'WEATHER'],
  ['きょうのてんき', 'WEATHER'],
  ['気温', 'TEMPERATURE'],
  ['きおん', 'TEMPERATURE'],
  ['鳥取のニュース', 'TOTTORI_NEWS'],
  ['とっとりのニュース', 'TOTTORI_NEWS'],
  ['ニュース', 'TOTTORI_NEWS'],
  ['金融', 'FINANCE_NEWS'],
  ['株', 'FINANCE_NEWS'],
  ['かぶ', 'FINANCE_NEWS'],
  ['ファイナンス', 'FINANCE_NEWS'],
  ['ストップ', 'STOP_SPEECH'],
  ['止めて', 'STOP_SPEECH'],
  ['やめて', 'STOP_SPEECH'],
  ['とめて', 'STOP_SPEECH'],
];

/**
 * 認識テキストからコマンドをマッチングする
 * 短いキーワードマッチに限定（倉庫の騒音対策）
 */
export function matchVoiceCommand(transcript: string): VoiceAction | null {
  const text = transcript.trim().toLowerCase();
  // 「okです」を先にチェック（「ok」より長いマッチ優先）
  for (const [keyword, action] of VOICE_COMMANDS) {
    if (text.includes(keyword)) {
      return action;
    }
  }
  return null;
}
