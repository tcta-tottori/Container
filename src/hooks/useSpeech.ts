'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ContainerItem } from '@/lib/types';
import { itemNameForSpeech, areSimilarItems } from '@/lib/typeDetector';
import { geminiGenerateSpeech } from '@/lib/geminiTts';
import { getGeminiKey } from '@/lib/geminiApi';
import { getVoiceSettings, styleInstruction, webSpeechVolume, VoiceProfile } from '@/lib/voiceSettings';
import { applyVolume } from '@/lib/audioBoost';

// 音声コール開始/終了のコールバック（録音一時停止用）
let _onSpeakStart: ((text: string) => void) | null = null;
let _onSpeakEnd: (() => void) | null = null;
// Gemini TTS 等で「リクエスト送信完了 → 音声再生開始」の通知（読込スピナー解除用）
let _onSpeakPlay: (() => void) | null = null;

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

async function speakGemini(text: string, stylePrefix?: string, voice?: string, onDone?: () => void): Promise<void> {
  const abort = new AbortController();
  _currentAbort = abort;
  // 生成前にコール開始を通知（録音をすぐ止めてフィードバック防止）
  _onSpeakStart?.(text);
  let finished = false;
  const finish = () => { if (finished) return; finished = true; _onSpeakEnd?.(); onDone?.(); };
  try {
    const blob = await geminiGenerateSpeech(text, { signal: abort.signal, stylePrefix, voice });
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
    console.error('Gemini TTS 失敗:', err);
    // ユーザーが Gemini を明示選択しているため自動フォールバックしない。
    // 録音再開のため _onSpeakEnd を呼んで状態を解放する。
    finish();
  } finally {
    if (_currentAbort === abort) _currentAbort = null;
  }
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

/** Gemini TTS を使うか（設定が gemini で、かつ API キーがある） */
function isGeminiEngineReady(): boolean {
  return getVoiceSettings().engine === 'gemini' && !!getGeminiKey();
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

  if (isGeminiEngineReady()) {
    void speakGemini(text, styleInstruction(profile), profile.voice, done);
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
    const spokenName = itemNameForSpeech(item.itemName);
    const isPolycover = item.type === 'ポリカバー';

    // パレットと端数の読み上げ（小数点がある場合は切り上げ）
    const fractionCeil = item.fraction % 1 !== 0 ? Math.ceil(item.fraction) : item.fraction;
    let qtyText = '';
    if (item.palletCount > 0 && fractionCeil > 0) {
      qtyText = `${item.palletCount}パレットと${fractionCeil}ケース`;
    } else if (item.palletCount > 0) {
      qtyText = `${item.palletCount}パレット`;
    } else if (fractionCeil > 0) {
      qtyText = `${fractionCeil}ケース`;
    } else {
      qtyText = `${item.totalQty}個`;
    }

    let text = `${spokenName}。${qtyText}。`;

    // ポリカバーは検査で1ケース抜く（端数から1引く）。鍋は検査なし。
    // 端数=0でパレットぴったりの場合は1パレットを崩して検査分を抜く。
    if (isPolycover) {
      if (fractionCeil > 0) {
        const afterInspection = fractionCeil - 1;
        text += `検査を抜いて${afterInspection}ケース。`;
      } else if (item.palletCount > 0 && item.qtyPerPallet > 0) {
        const remainingCases = item.qtyPerPallet - 1;
        const remainingPallets = item.palletCount - 1;
        if (remainingPallets > 0) {
          text += `検査を抜いて${remainingPallets}パレットと${remainingCases}ケース。`;
        } else {
          text += `検査を抜いて${remainingCases}ケース。`;
        }
      }
    }

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

  /** コンテナ概要アナウンス（読み込み時・手動コール用）
   *  completedIds / elapsedSeconds を渡すと進捗情報も読み上げる */
  const announceContainerSummary = useCallback((
    items: ContainerItem[],
    ...rest: [string, Set<string>?, number?]
  ) => {
    const completedIds = rest[1];
    if (items.length === 0) return;

    const done = completedIds ? items.filter((it) => completedIds.has(it.id)).length : 0;
    const remaining = items.length - done;
    const pct = items.length > 0 ? Math.round(done / items.length * 100) : 0;

    // 種類別カウント（残りのみ）
    const typeCounts: Record<string, number> = {};
    const totalTypeCounts: Record<string, number> = {};
    const similarPairs: string[] = [];

    for (const it of items) {
      totalTypeCounts[it.type] = (totalTypeCounts[it.type] || 0) + 1;
      if (!completedIds || !completedIds.has(it.id)) {
        typeCounts[it.type] = (typeCounts[it.type] || 0) + 1;
      }
    }

    // 類似品チェック
    const checked = new Set<string>();
    for (const a of items) {
      for (const b of items) {
        if (a.id >= b.id) continue;
        const key = `${a.id}:${b.id}`;
        if (checked.has(key)) continue;
        checked.add(key);
        if (areSimilarItems(a.itemName, b.itemName)) {
          const nameA = itemNameForSpeech(a.itemName);
          const nameB = itemNameForSpeech(b.itemName);
          similarPairs.push(`${nameA}と${nameB}`);
        }
      }
    }

    // === 開始コール（挨拶なし、コンテナ番号なし） ===
    const isResume = completedIds && done > 0;
    let text = isResume
      ? '続きです。'
      : '荷降ろしを開始します。';

    // === 内容物コール: 「〇〇がN種類」形式 ===
    // 鍋コンテナ: サイズ別にコール
    if (totalTypeCounts['鍋'] > 0) {
      let count100 = 0, count180 = 0;
      for (const it of items) {
        if (it.type !== '鍋') continue;
        if (it.itemName.includes('180') || /18[RWCS]/.test(it.itemName)) count180++;
        else count100++;
      }
      if (count100 > 0) text += `100サイズが${count100}種類。`;
      if (count180 > 0) text += `180サイズが${count180}種類。`;
    }
    const typeLabels: [string, string][] = [
      ['ポリカバー', 'ポリカバー'],
      ['ジャーポット', 'ジャーポット'],
      ['箱', '箱'],
      ['部品', '部品'],
      ['ヤーマン部品', 'ヤーマン部品'],
      ['その他', 'その他'],
    ];
    for (const [typeKey, label] of typeLabels) {
      const count = totalTypeCounts[typeKey];
      if (count) text += `${label}が${count}種類。`;
    }

    // === 進捗情報（再開時） ===
    if (isResume) {
      text += `進捗${pct}パーセント、残り${remaining}品。`;
    }

    // === 類似品警告: 種類単位で短くコール ===
    if (similarPairs.length > 0) {
      // 類似品がある種類を収集
      const warnedTypes = new Set<string>();
      for (const a of items) {
        for (const b of items) {
          if (a.id >= b.id) continue;
          if (areSimilarItems(a.itemName, b.itemName)) {
            warnedTypes.add(a.type);
          }
        }
      }
      for (const t of Array.from(warnedTypes)) {
        text += `${t}に類似品があります。`;
      }
    }

    if (completedIds && remaining === 0) {
      text += '全品目完了です。';
    }

    text += 'よろしくお願いします。';

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
    if (remainingPallets <= 0 && (!fractionCases || fractionCases <= 0)) {
      speak('完了。');
    } else if (remainingPallets > 0 && fractionCases && fractionCases > 0) {
      speak(`残り${remainingPallets}パレットと${fractionCases}ケース。`);
    } else if (remainingPallets > 0) {
      speak(`残り${remainingPallets}パレット。`);
    } else if (fractionCases && fractionCases > 0) {
      speak(`残り${fractionCases}ケース。`);
    }
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
