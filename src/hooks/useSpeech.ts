'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ContainerItem } from '@/lib/types';
import { itemNameForSpeech, areSimilarItems } from '@/lib/typeDetector';
import { itemNameForCall } from '@/lib/partTranslations';
import { displayQuantities, quantityToSpeech } from '@/lib/itemQuantity';
import { geminiGenerateSpeech } from '@/lib/geminiTts';
import { sherpaGenerateSpeech } from '@/lib/sherpaTts';
import { getGeminiKey } from '@/lib/geminiApi';
import {
  getVoiceSettings, saveVoiceSettings, styleInstruction, webSpeechVolume, VoiceEngine, VoiceProfile,
} from '@/lib/voiceSettings';
import { applyVolume } from '@/lib/audioBoost';

// 音声コール開始/終了のコールバック（録音一時停止用）
let _onSpeakStart: ((text: string) => void) | null = null;
let _onSpeakEnd: (() => void) | null = null;
// Gemini TTS 等で「リクエスト送信完了 → 音声再生開始」の通知（読込スピナー解除用）
let _onSpeakPlay: (() => void) | null = null;

/* ===== Gemini が鳴らせなくなったときの自動切り替え =====
 * 圏外・APIエラーなどで音声が返ってこない状態が続くと、コールのたびに
 * 待たされたうえで無音になる。続けて失敗したら端末の音声に切り替える。 */
/** 何回続けて失敗したら端末の音声に切り替えるか */
const GEMINI_FAIL_LIMIT = 2;
let _geminiFails = 0;
/** 切り替えたことを画面に知らせる処理（page.tsx がトーストを出す） */
let _onEngineFallback: ((message: string) => void) | null = null;

/** 端末の音声に切り替えたときの通知先を登録する */
export function setEngineFallbackNotice(fn: ((message: string) => void) | null): void {
  _onEngineFallback = fn;
}

/** Gemini のコールが失敗したときの後始末。続けて失敗していたら端末の音声に切り替える */
function noteGeminiFailure(): void {
  _geminiFails += 1;
  if (_geminiFails < GEMINI_FAIL_LIMIT) return;
  const settings = getVoiceSettings();
  if (settings.engine !== 'gemini') return;
  saveVoiceSettings({ ...settings, engine: 'web' });
  _geminiFails = 0;
  _onEngineFallback?.('Gemini の音声が出ないため、端末の音声に切り替えました');
}

export function setSpeakCallbacks(
  onStart: (text: string) => void,
  onEnd: () => void,
  onPlay?: () => void,
) {
  _onSpeakStart = onStart;
  _onSpeakEnd = onEnd;
  _onSpeakPlay = onPlay || null;
}

// 現在再生中の Gemini 音声と生成中のリクエストを追跡
let _currentAudio: HTMLAudioElement | null = null;
let _currentAbort: AbortController | null = null;
let _currentAudioUrl: string | null = null;
/** ブースト用に繋いだ Web Audio ノードを切り離す処理 */
let _currentDetach: (() => void) | null = null;
/**
 * いま進行中のコールの「終わったら呼ぶ」処理。
 * 試聴ボタンの読込表示のように、鳴り終わりを待っている呼び出し元があるため、
 * 途中で止めたときも必ず呼んで待ちを解く。
 */
let _currentDone: (() => void) | null = null;

/** 現在の音声コール（Gemini / Web Speech）を全てキャンセル */
export function cancelSpeech(): void {
  if (typeof window === 'undefined') return;
  const pendingDone = _currentDone;
  _currentDone = null;
  if (_currentAbort) {
    try { _currentAbort.abort(); } catch { /* ignore */ }
    _currentAbort = null;
  }
  if (_currentAudio) {
    try {
      _currentAudio.onended = null;
      _currentAudio.onerror = null;
      _currentAudio.pause();
    } catch { /* ignore */ }
    _currentAudio = null;
  }
  if (_currentAudioUrl) {
    try { URL.revokeObjectURL(_currentAudioUrl); } catch { /* ignore */ }
    _currentAudioUrl = null;
  }
  if (_currentDetach) { _currentDetach(); _currentDetach = null; }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  _onSpeakEnd?.();
  pendingDone?.();
}

function speakWebSpeech(text: string, onDone?: () => void, profile?: VoiceProfile): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    _onSpeakEnd?.();
    onDone?.();
    return;
  }
  const settings = getVoiceSettings();
  const p = profile || settings.main;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = Math.min(2, Math.max(0.5, p.rate * 1.1));
  u.pitch = Math.min(2, Math.max(0, p.pitch));
  // 端末の音声は仕様上 1.0 が上限。ブースト分は乗せられない
  u.volume = webSpeechVolume(settings);
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find((v) => v.lang.startsWith('ja'));
  if (jaVoice) u.voice = jaVoice;
  let done = false;
  const finish = () => { if (done) return; done = true; _onSpeakEnd?.(); onDone?.(); };
  u.onstart = () => { _onSpeakStart?.(text); _onSpeakPlay?.(); };
  u.onend = finish;
  u.onerror = finish;
  window.speechSynthesis.speak(u);
}

/**
 * 音声データを作って鳴らす共通処理（Gemini TTS / sherpa-onnx）。
 * 生成に時間がかかるため、先にコール開始を通知して録音を止める。
 * @param makeBlob 音声（WAV）を作る処理。中断は signal で伝える。
 * @param onFail   生成・再生に失敗したときの逃げ道（sherpa-onnx は端末の音声に切り替える）
 */
async function speakBlob(
  text: string,
  makeBlob: (signal: AbortSignal) => Promise<Blob>,
  onDone?: () => void,
  onFail?: (finish: () => void) => void,
): Promise<void> {
  const abort = new AbortController();
  _currentAbort = abort;
  // 生成前にコール開始を通知（録音をすぐ止めてフィードバック防止）
  _onSpeakStart?.(text);
  let finished = false;
  const finish = () => { if (finished) return; finished = true; _onSpeakEnd?.(); onDone?.(); };
  try {
    const blob = await makeBlob(abort.signal);
    if (abort.signal.aborted) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    // 100%超はここで Web Audio のゲインに載せ替える
    const detach = await applyVolume(audio, getVoiceSettings().volume);
    if (abort.signal.aborted) { detach(); URL.revokeObjectURL(url); return; }
    _currentAudio = audio;
    _currentAudioUrl = url;
    _currentDetach = detach;
    const releaseUrl = () => {
      detach();
      if (_currentDetach === detach) _currentDetach = null;
      if (_currentAudioUrl === url) { URL.revokeObjectURL(url); _currentAudioUrl = null; }
      if (_currentAudio === audio) _currentAudio = null;
    };
    audio.onended = () => { releaseUrl(); finish(); };
    audio.onerror = () => { releaseUrl(); finish(); };
    audio.onplay = () => { _onSpeakPlay?.(); };
    await audio.play();
  } catch (err) {
    if (abort.signal.aborted) return;
    console.error('音声コールに失敗:', err);
    if (onFail) onFail(finish);
    else finish();
  } finally {
    if (_currentAbort === abort) _currentAbort = null;
  }
}

/**
 * Gemini TTS で読み上げる。
 * 失敗したときはコールが無音にならないよう端末の音声で読み上げ直し、
 * それが続くようなら設定そのものを端末の音声に切り替える。
 */
function speakGemini(text: string, profile: VoiceProfile, onDone?: () => void): Promise<void> {
  return speakBlob(
    text,
    async (signal) => {
      const blob = await geminiGenerateSpeech(text, {
        signal, stylePrefix: styleInstruction(profile), voice: profile.voice,
      });
      _geminiFails = 0; // 鳴ったら数え直す
      return blob;
    },
    onDone,
    (finish) => {
      noteGeminiFailure();
      speakWebSpeech(text, finish, profile);
    },
  );
}

/**
 * sherpa-onnx（端末内 TTS）で読み上げる。
 * モデルが未配置・読み込み失敗のときはコールが無音にならないよう端末の音声に切り替える。
 */
function speakSherpa(text: string, profile: VoiceProfile, onDone?: () => void): Promise<void> {
  return speakBlob(
    text,
    (signal) => sherpaGenerateSpeech(text, { sid: profile.sid, speed: profile.rate, signal }),
    onDone,
    // 生成に失敗 → 端末の音声で読み上げ直す
    (finish) => speakWebSpeech(text, finish, profile),
  );
}

/** 進行中のコールを停止（onEnd は呼ばない。新しい発話側で管理する） */
function stopCurrentPlayback(): void {
  if (typeof window === 'undefined') return;
  if (_currentAbort) { try { _currentAbort.abort(); } catch { /* ignore */ } _currentAbort = null; }
  if (_currentAudio) {
    try { _currentAudio.onended = null; _currentAudio.onerror = null; _currentAudio.pause(); } catch { /* ignore */ }
    _currentAudio = null;
  }
  if (_currentAudioUrl) { try { URL.revokeObjectURL(_currentAudioUrl); } catch { /* ignore */ } _currentAudioUrl = null; }
  if (_currentDetach) { _currentDetach(); _currentDetach = null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

/**
 * 実際に使うエンジンを決める。
 * Gemini は API キーが無いと鳴らせないため、その場合は端末の音声に落とす。
 */
function activeEngine(): VoiceEngine {
  const engine = getVoiceSettings().engine;
  if (engine === 'gemini') return getGeminiKey() ? 'gemini' : 'web';
  return engine;
}

/** 指定プロファイルで読み上げる（エンジンの切り替えとフォールバックをまとめる） */
function speakWith(text: string, profile: VoiceProfile, onDone?: () => void): void {
  if (typeof window === 'undefined') return;

  // 前のコールを待っている人がいたら、割り込んだこの時点で終わりとして解放する
  const prevDone = _currentDone;
  _currentDone = null;
  prevDone?.();

  let called = false;
  const done = () => {
    if (called) return;
    called = true;
    if (_currentDone === done) _currentDone = null;
    onDone?.();
  };
  _currentDone = done;

  const engine = activeEngine();
  if (engine === 'gemini') {
    void speakGemini(text, profile, done);
  } else if (engine === 'sherpa') {
    void speakSherpa(text, profile, done);
  } else {
    speakWebSpeech(text, done, profile);
  }
}

/** 事前アナウンスを読み上げた後、応援コールを「そのまま」別発話で読み上げる（定期コール用）。
 *  応援を独立した発話にすることで、長文結合による語尾の乱れを防ぐ。 */
function speakThenCheer(pre: string, cheer: string): void {
  if (typeof window === 'undefined') return;
  stopCurrentPlayback();
  const startCheer = () => speakCheer(cheer);
  if (!pre.trim()) { startCheer(); return; }
  speakWith(pre, getVoiceSettings().main, startCheer);
}

/**
 * 応援コール・あおりコール専用。設定ページの「応援コール」プロファイルで読み上げる。
 * onDone は鳴り終わり（または失敗・中断）で必ず1回だけ呼ばれる。
 */
function speakCheer(text: string, onDone?: () => void): void {
  stopCurrentPlayback();
  speakWith(text, getVoiceSettings().cheer, onDone);
}

/** 経過時間のあおりコール。応援コールと同じプロファイルを使う。 */
function speakTaunt(text: string): void {
  stopCurrentPlayback();
  speakWith(text, getVoiceSettings().cheer);
}

/** 通常のコール。設定ページの「通常コール」プロファイルで読み上げる。 */
function speak(text: string): void {
  stopCurrentPlayback();
  speakWith(text, getVoiceSettings().main);
}

export function useSpeech() {
  const voicesLoaded = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const handleVoices = () => {
      voicesLoaded.current = true;
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoices);
    window.speechSynthesis.getVoices();
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
    };
  }, []);

  const announceItem = useCallback((item: ContainerItem, allItems?: ContainerItem[]) => {
    // 品名は画面の表示名をそのまま読む（部品の詳しい型式までは読まない）
    const spokenName = itemNameForCall(item);

    // 数量は画面の PL / CT と同じ値を読む。
    // ポリカバー等の検査で1ケース抜く品目は、抜いた後の数をコールする。
    const q = displayQuantities(item);
    const qtyText = quantityToSpeech(q) || `${q.pcs}個`;

    let text = `${spokenName}。${qtyText}。`;

    // 鍋: 類似品・サイズ違いアナウンスは不要
    const isNabe = item.type === '鍋';

    // 似た名前のアイテムがある場合に警告（鍋以外）。
    // 具体的な類似品の内容はコールせず「類似品があります」とだけ伝える。
    if (!isNabe && allItems && allItems.length > 0) {
      const hasSimilar = allItems.some(
        (other) => other.id !== item.id && areSimilarItems(item.itemName, other.itemName)
      );
      if (hasSimilar) {
        text += '注意、類似品があります。';
      }
    }

    speak(text);
  }, []);

  const announcePalletChange = useCallback(
    (newPallet: number) => {
      speak(`パレット${newPallet}。`);
    },
    []
  );

  const announceComplete = useCallback((itemName: string) => {
    speak(`${itemNameForSpeech(itemName)}、完了。`);
  }, []);

  const announceAllComplete = useCallback(() => {
    speak('全品目の荷降ろしが完了しました。お疲れ様でした。');
  }, []);

  const announceRemaining = useCallback((count: number) => {
    speak(`残り${count}品目です。`);
  }, []);

  /**
   * コンテナ概要アナウンス（手動コール用）。
   *
   * 挨拶・内容案内（「◯◯が N 種類」）は読み上げない。
   * 残り品数と、注意が必要な類似品だけを短く伝える。
   */
  const announceContainerSummary = useCallback((
    items: ContainerItem[],
    ...rest: [string, Set<string>?, number?]
  ) => {
    const completedIds = rest[1];
    if (items.length === 0) return;

    const done = completedIds ? items.filter((it) => completedIds.has(it.id)).length : 0;
    const remaining = items.length - done;

    let text = remaining === 0 ? '全品目完了です。' : `残り${remaining}品。`;

    // 類似品がある種類だけ短く注意する
    const warnedTypes = new Set<string>();
    for (const a of items) {
      for (const b of items) {
        if (a.id >= b.id) continue;
        if (areSimilarItems(a.itemName, b.itemName)) warnedTypes.add(a.type);
      }
    }
    for (const t of Array.from(warnedTypes)) {
      text += `${t}に類似品があります。`;
    }

    speak(text);
  }, []);

  /** 進捗状況アナウンス（完了率・残りCBM等） */
  /** 進捗コール: 進捗率 + 種類別残りのみ */
  const announceProgress = useCallback((items: ContainerItem[], completedIds: Set<string>) => {
    const total = items.length;
    const done = items.filter((it) => completedIds.has(it.id)).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    let text = `進捗${pct}パーセント。`;

    // 種類別残り
    const typeCounts: Record<string, number> = {};
    for (const it of items) {
      if (!completedIds.has(it.id)) {
        typeCounts[it.type] = (typeCounts[it.type] || 0) + 1;
      }
    }
    const parts: string[] = [];
    for (const [t, c] of Object.entries(typeCounts)) {
      parts.push(`${t}が${c}種類`);
    }
    if (parts.length > 0) text += parts.join('、') + '。';

    speak(text);
  }, []);

  /** OK確認アナウンス（残りパレット+端数のみ） */
  const announceOk = useCallback((_itemName: string, remainingPallets: number, fractionCases?: number) => {
    const qty = quantityToSpeech({ pallets: remainingPallets, cartons: fractionCases || 0 });
    speak(qty ? `残り${qty}。` : '完了。');
  }, []);

  return {
    speak,
    speakCheer,
    speakThenCheer,
    speakTaunt,
    announceItem,
    announcePalletChange,
    announceComplete,
    announceAllComplete,
    announceRemaining,
    announceContainerSummary,
    announceOk,
    announceProgress,
  };
}
