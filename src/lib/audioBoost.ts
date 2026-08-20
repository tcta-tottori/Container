'use client';

/**
 * 音声コールの音量ブースト。
 *
 * `HTMLAudioElement.volume` は 0〜1 までしか指定できないため、荷降ろし現場の騒音下では
 * 100% にしてもコールが小さいことがある。そこで 100% を超える音量は Web Audio の
 * ゲインで持ち上げる（最大 300%）。
 *
 * 併せてコンプレッサーを通し、小さい部分（語尾など）を持ち上げてから増幅するので、
 * 単純に音量を上げるより聞き取りやすく、そのぶん歪みも出にくい。
 *
 * 注意: 端末の音声（Web Speech API）は音声データを取り出せないため、この経路は使えない。
 * `SpeechSynthesisUtterance.volume` の上限 1.0 がそのまま上限になる。
 */

/** 音量設定の上限（300%） */
export const MAX_VOLUME = 3;

let _ctx: AudioContext | null = null;

/** ブースト用の AudioContext（初回だけ作って使い回す） */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_ctx) return _ctx;
  const Ctor = window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    _ctx = new Ctor();
  } catch {
    return null;
  }
  return _ctx;
}

/** この端末で 100% を超える音量が使えるか */
export function isBoostSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
}

/** 設定値を 0〜MAX_VOLUME に丸める */
export function clampVolume(v: number): number {
  return Number.isFinite(v) ? Math.min(MAX_VOLUME, Math.max(0, v)) : 1;
}

/**
 * 再生前の音声要素に音量を適用する。
 *
 * 100% 以下、または Web Audio が使えない端末では要素の volume をそのまま使う。
 * 100% を超えるときだけ Web Audio のゲインを挟む。
 *
 * @returns 再生が終わったら呼ぶ後始末（ノードの切り離し）。
 */
export async function applyVolume(audio: HTMLAudioElement, volume: number): Promise<() => void> {
  const v = clampVolume(volume);
  const noop = () => { /* 何もしない */ };
  if (v <= 1) {
    audio.volume = v;
    return noop;
  }

  const ctx = getContext();
  if (!ctx) {
    audio.volume = 1;
    return noop;
  }
  // 画面に触れる前は suspended のことがある。復帰できなければ素の再生に戻す
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }
  if (ctx.state !== 'running') {
    audio.volume = 1;
    return noop;
  }

  try {
    // 要素側は最大にして、増幅はゲインに任せる
    audio.volume = 1;
    const source = ctx.createMediaElementSource(audio);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    const gain = ctx.createGain();
    gain.gain.value = v;
    source.connect(comp);
    comp.connect(gain);
    gain.connect(ctx.destination);
    return () => {
      try { source.disconnect(); } catch { /* ignore */ }
      try { comp.disconnect(); } catch { /* ignore */ }
      try { gain.disconnect(); } catch { /* ignore */ }
    };
  } catch {
    // createMediaElementSource は要素ごとに1回だけ。失敗したら素の再生に戻す
    audio.volume = 1;
    return noop;
  }
}
