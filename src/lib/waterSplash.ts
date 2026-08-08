'use client';

/**
 * 水面の効果音
 * ------------------------------------------------------------------
 * せせらぎモードで品目情報が水面から出てくる／沈むときに鳴らす音。
 *
 * 音源ファイルは持たず、その場で作っている（WebAudio）。
 * 短い音のために数百KBのファイルを足したくないのと、
 * 電波の届かない現場でも必ず鳴るようにするため。
 *
 * 大きさは「水の音」設定の音量に合わせる。水の音を絞っている人には
 * こちらも小さく鳴り、0 にしていれば鳴らない。
 */

import { getWaterSoundEngine } from './waterSound';

let _ctx: AudioContext | null = null;
let _noise: AudioBuffer | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_ctx) {
    // 端末が止めている場合は起こす（タップの流れで呼ばれるので通る）
    if (_ctx.state === 'suspended') void _ctx.resume().catch(() => { /* ignore */ });
    return _ctx;
  }
  const Ctor = window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    _ctx = new Ctor();
    return _ctx;
  } catch {
    return null;
  }
}

/** ざぁーという音のもと（ホワイトノイズ）。1回作って使い回す */
function getNoise(ctx: AudioContext): AudioBuffer {
  if (_noise && _noise.sampleRate === ctx.sampleRate) return _noise;
  const len = Math.floor(ctx.sampleRate * 1.2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  _noise = buf;
  return buf;
}

/** 「水の音」設定の音量。0 なら鳴らさない */
function waterVolume(): number {
  try {
    return getWaterSoundEngine().getVolume();
  } catch {
    return 0.4;
  }
}

/** ノイズを1発鳴らす（フィルタの種類と音量の変化を指定する） */
function burst(
  ctx: AudioContext, out: GainNode, at: number,
  opts: {
    type: BiquadFilterType; freqFrom: number; freqTo: number; q?: number;
    peak: number; attack: number; decay: number;
  },
): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filt = ctx.createBiquadFilter();
  filt.type = opts.type;
  filt.Q.value = opts.q ?? 1;
  filt.frequency.setValueAtTime(opts.freqFrom, at);
  filt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqTo), at + opts.attack + opts.decay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.peak), at + opts.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.attack + opts.decay);
  src.connect(filt).connect(g).connect(out);
  src.start(at);
  src.stop(at + opts.attack + opts.decay + 0.05);
}

/** ぽちゃん、という水滴。高い音から素早く下がる */
function droplet(ctx: AudioContext, out: GainNode, at: number, freq: number, peak: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.45, at + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + 0.18);
}

/**
 * 水を押しのける、こもった音。
 * 文字が水面へ近づいている間に鳴らす（まだ割れていない）。
 */
export function playWaterPush(): void {
  const vol = waterVolume();
  if (vol <= 0.001) return;
  const ctx = getCtx();
  if (!ctx) return;

  const out = ctx.createGain();
  out.gain.value = vol;
  out.connect(ctx.destination);

  const t = ctx.currentTime + 0.02;
  burst(ctx, out, t, { type: 'lowpass', freqFrom: 520, freqTo: 240, peak: 0.3, attack: 0.26, decay: 0.45 });

  window.setTimeout(() => { try { out.disconnect(); } catch { /* ignore */ } }, 1100);
}

/**
 * 水面が割れた瞬間の音。
 * しぶき → 流れ落ちる水 → 落ちた水滴、の順に重ねる。
 * 画面の割れる瞬間に合わせて呼ぶ。
 */
export function playSurfaceBreak(): void {
  const vol = waterVolume();
  if (vol <= 0.001) return;
  const ctx = getCtx();
  if (!ctx) return;

  const out = ctx.createGain();
  out.gain.value = vol;
  out.connect(ctx.destination);

  const t = ctx.currentTime + 0.02;
  // 水面が割れるしぶき
  burst(ctx, out, t, { type: 'bandpass', freqFrom: 1500, freqTo: 3200, q: 0.9, peak: 0.32, attack: 0.012, decay: 0.34 });
  // 流れ落ちる水
  burst(ctx, out, t + 0.14, { type: 'highpass', freqFrom: 900, freqTo: 2200, peak: 0.12, attack: 0.1, decay: 0.6 });
  // 落ちた水滴
  droplet(ctx, out, t + 0.28, 1250, 0.1);
  droplet(ctx, out, t + 0.44, 980, 0.075);
  droplet(ctx, out, t + 0.65, 1450, 0.055);

  window.setTimeout(() => { try { out.disconnect(); } catch { /* ignore */ } }, 1400);
}

/** 水面へ沈んでいく音。低くこもって、最後にひと呑みする */
export function playSubmerging(): void {
  const vol = waterVolume();
  if (vol <= 0.001) return;
  const ctx = getCtx();
  if (!ctx) return;

  const out = ctx.createGain();
  out.gain.value = vol * 0.75;
  out.connect(ctx.destination);

  const t = ctx.currentTime + 0.02;
  burst(ctx, out, t, { type: 'lowpass', freqFrom: 700, freqTo: 200, peak: 0.2, attack: 0.2, decay: 0.5 });

  // ごぼっ、と呑まれる音
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(240, t + 0.22);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.22);
  g.gain.exponentialRampToValueAtTime(0.13, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.56);
  osc.connect(g).connect(out);
  osc.start(t + 0.22);
  osc.stop(t + 0.6);

  window.setTimeout(() => { try { out.disconnect(); } catch { /* ignore */ } }, 1200);
}
