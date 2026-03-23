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
  | 'QUERY_FRACTION';

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
  ['パレット', 'QUERY_PALLET'],
  ['ぱれっと', 'QUERY_PALLET'],
  ['端数', 'QUERY_FRACTION'],
  ['はすう', 'QUERY_FRACTION'],
];

/**
 * 認識テキストからコマンドをマッチングする
 * 短いキーワードマッチに限定（倉庫の騒音対策）
 */
export function matchVoiceCommand(transcript: string): VoiceAction | null {
  const text = transcript.trim().toLowerCase();
  for (const [keyword, action] of VOICE_COMMANDS) {
    if (text.includes(keyword)) {
      return action;
    }
  }
  return null;
}
