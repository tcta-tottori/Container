'use client';

/**
 * 中身が決まっているコールの音声を、まとめて作って取っておく。
 *
 * 「お願いします！」「長谷川さん！」応援コール・ドラムのセリフ は毎回おなじ文なので、
 * 先に一度だけ作っておけば、あとは待たずに鳴らせる。
 * 通信が切れていても鳴り、API も消費しない（`src/lib/ttsCache.ts`）。
 */

import { fixedCallTexts } from './callPhrases';
import { geminiGenerateSpeech, geminiSpeechKey } from './geminiTts';
import { getCachedSpeech } from './ttsCache';
import { spokenText, loadDrumSerifs } from './drumCall';
import { getVoiceSettings, styleInstruction, profileForCall } from './voiceSettings';

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

/** 作るもの 1 つ分（読む文と、その話し方） */
interface PrepareJob {
  text: string;
  voice: string;
  stylePrefix: string;
}

/**
 * 中身が決まっているものをぜんぶ並べる。
 * - 応援コール・合図のコール（応援コールの声。ドラムの声を使う設定ならドラムの声）
 * - ドラムパッドのセリフ（いつもドラムの声）
 * 鳴らすときと同じ文・同じ話し方で作る（ドラム風の口調なら言い換えた文）。
 */
function prepareJobs(): PrepareJob[] {
  const settings = getVoiceSettings();
  const cheer = profileForCall(settings, 'cheer');
  const drum = settings.drum;
  const jobs: PrepareJob[] = [
    ...fixedCallTexts().map((t) => ({ text: spokenText(t, cheer), profile: cheer })),
    ...loadDrumSerifs().map((s) => ({ text: spokenText(s.text, drum), profile: drum })),
  ].map(({ text, profile }) => ({
    text, voice: profile.voice, stylePrefix: styleInstruction(profile),
  }));
  const seen = new Set<string>();
  return jobs.filter((j) => {
    const key = `${j.voice}\n${j.stylePrefix}\n${j.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 中身が決まっているコールとドラムのセリフを、ぜんぶ作って取っておく。
 * すでに取ってあるものは作り直さない。
 */
export async function prepareFixedCalls(
  onProgress?: (p: PrepareProgress) => void,
  signal?: AbortSignal,
): Promise<PrepareResult> {
  const jobs = prepareJobs();

  const result: PrepareResult = { made: 0, kept: 0, failed: 0 };
  for (let i = 0; i < jobs.length; i++) {
    if (signal?.aborted) break;
    const { text, ...opts } = jobs[i];
    onProgress?.({ done: i, total: jobs.length, text });

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
    if (i < jobs.length - 1) await new Promise((r) => setTimeout(r, GAP_MS));
  }
  onProgress?.({ done: jobs.length, total: jobs.length, text: '' });
  return result;
}

/** これから作る数（画面に出すため） */
export function fixedCallCount(): number {
  return prepareJobs().length;
}
