'use client';

/**
 * 中身が決まっているコールの音声を、まとめて作って取っておく。
 *
 * 「お願いします！」「長谷川さん！」応援コール は毎回おなじ文なので、
 * 先に一度だけ作っておけば、あとは待たずに鳴らせる。
 * 通信が切れていても鳴り、API も消費しない（`src/lib/ttsCache.ts`）。
 */

import { fixedCallTexts } from './callPhrases';
import { geminiGenerateSpeech, geminiSpeechKey } from './geminiTts';
import { getCachedSpeech } from './ttsCache';
import { getVoiceSettings, styleInstruction } from './voiceSettings';

/** まとめて作っている途中の様子 */
export interface PrepareProgress {
  /** 終わった数 */
  done: number;
  /** ぜんぶの数 */
  total: number;
  /** いま作っている文言 */
  text: string;
}

/** まとめて作り終わったときの結果 */
export interface PrepareResult {
  /** 新しく作った数 */
  made: number;
  /** もう取ってあったので作らなかった数 */
  kept: number;
  /** 作れなかった数 */
  failed: number;
}

/** 1 つ作るごとに置く間（ミリ秒）。続けて投げすぎないように */
const GAP_MS = 150;

/**
 * 中身が決まっているコールを、ぜんぶ作って取っておく。
 * すでに取ってあるものは作り直さない。
 *
 * コールはどれも「応援コール」のプロファイルで読み上げているので、
 * ここでも同じ話者・話し方で作る。
 */
export async function prepareFixedCalls(
  onProgress?: (p: PrepareProgress) => void,
  signal?: AbortSignal,
): Promise<PrepareResult> {
  const texts = fixedCallTexts();
  const profile = getVoiceSettings().cheer;
  const opts = { voice: profile.voice, stylePrefix: styleInstruction(profile) };

  const result: PrepareResult = { made: 0, kept: 0, failed: 0 };
  for (let i = 0; i < texts.length; i++) {
    if (signal?.aborted) break;
    const text = texts[i];
    onProgress?.({ done: i, total: texts.length, text });

    // もう取ってあるなら作り直さない
    const cached = await getCachedSpeech(geminiSpeechKey(text, opts));
    if (cached) {
      result.kept += 1;
      continue;
    }

    try {
      await geminiGenerateSpeech(text, { ...opts, signal });
      result.made += 1;
    } catch {
      // 1 つ失敗しても残りは続ける（圏外の 1 本だけ落ちることがあるため）
      result.failed += 1;
    }
    if (i < texts.length - 1) await new Promise((r) => setTimeout(r, GAP_MS));
  }
  onProgress?.({ done: texts.length, total: texts.length, text: '' });
  return result;
}

/** これから作る文言の数（画面に出すため） */
export function fixedCallCount(): number {
  return fixedCallTexts().length;
}
