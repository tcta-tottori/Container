'use client';

/**
 * 作業用BGM「水の流れる音（せせらぎ）」
 *
 * 音源ファイルを持たず、物理モデルでリアルタイム合成する。
 * 水音の質感は、水中で生まれる気泡の共鳴音（Minnaert 共鳴）でほぼ決まる。
 *   - 気泡の半径 r から共鳴周波数 f0 = 3/r [Hz]
 *   - 減衰 d = 0.043·f0 + 1.46e-4·f0^1.5
 *   - 減衰しながらわずかに音程が上がる f(t) = f0·(1 + σ·d·t)
 * 小さい気泡ほど数が多く高く短い「粒」に、大きい気泡ほど低い「ポコッ」になる。
 * これに乱流ノイズ（水流のボディ）を重ねたものを十数秒のループへ焼き込み、
 * 再生時に速度違いの2レイヤーとゆっくりした揺らぎを掛けてループ感を消す。
 */

/* ===== 設定の保存 ===== */

const VOLUME_KEY = 'cns_water_volume';
const FADE_KEY = 'cns_water_fade';
const PLAYING_KEY = 'cns_water_playing';
const AUTOSTART_KEY = 'cns_water_autostart';

const DEFAULT_VOLUME = 0.4;
const DEFAULT_FADE = 3; // 秒

/** 音声コール中に下げる倍率 */
const DUCK_LEVEL = 0.18;

/** ループ用バッファの長さ（秒） */
const LOOP_SECONDS = 14;

/** 1秒あたりの気泡クラスター数。水流の気泡はまとまって発生する */
const CLUSTERS_PER_SEC = 46;

/** 気泡半径の範囲（m）。小さいほど高音・短い減衰 */
const R_MIN = 0.0004; // f0 ≈ 7.5kHz（細かい弾ける音）
const R_MAX = 0.0062; // f0 ≈ 480Hz（低い「ポコッ」）

/** 減衰中の音程上昇の強さ */
const SIGMA = 0.1;

function readNumber(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** アプリ起動時に前回の再生状態を復元するか（デフォルト: オフ） */
export function isWaterAutoStartEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTOSTART_KEY) === '1';
}

export function setWaterAutoStartEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTOSTART_KEY, on ? '1' : '0');
}

/* ===== 波形の生成 ===== */

/** ピンクノイズ（Paul Kellet の近似フィルター） */
function pinkNoise(n: number): Float32Array {
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

/** 1次ハイパス（低域の唸りを削るために使う） */
function highpass(x: Float32Array, cutoffHz: number, sampleRate: number): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const a = rc / (rc + dt);
  const out = new Float32Array(x.length);
  let prevX = 0, prevY = 0;
  for (let i = 0; i < x.length; i++) {
    const y = a * (prevY + x[i] - prevX);
    out[i] = y;
    prevX = x[i];
    prevY = y;
  }
  return out;
}

/**
 * せせらぎのループ波形（ステレオ）を合成する。
 * 気泡は末尾から先頭へ巻き戻して書き込むため、ループの継ぎ目で音が切れない。
 */
export function renderStreamLoop(sampleRate: number, seconds = LOOP_SECONDS): { left: Float32Array; right: Float32Array } {
  const n = Math.floor(seconds * sampleRate);
  const tail = Math.floor(0.15 * sampleRate); // ノイズ床のクロスフェード用

  // --- 水流のボディ（乱流ノイズ）---
  // mid/side で作ると左右が自然に広がる（完全独立だと広がりすぎる）。
  // ピンクノイズのままだと低域が過多で「ゴー」という風のような音になるため、
  // ハイパスを2段掛けて 300Hz 以下を落とす。水音の帯域は気泡側で作る。
  const mid = highpass(highpass(pinkNoise(n + tail), 300, sampleRate), 300, sampleRate);
  const side = highpass(highpass(pinkNoise(n + tail), 380, sampleRate), 380, sampleRate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const BED = 0.5;
  for (let i = 0; i < n; i++) {
    let m = mid[i];
    let s = side[i];
    if (i < tail) {
      const w = i / tail;
      m = m * w + mid[n + i] * (1 - w);
      s = s * w + side[n + i] * (1 - w);
    }
    left[i] = (m + s * 0.55) * BED;
    right[i] = (m - s * 0.55) * BED;
  }

  // --- 気泡 ---
  // 一様にばらまくと「サー」に均されてしまうので、まとまり（クラスター）で発生させる。
  // これが水の「ぶくぶく」「ちょろちょろ」というリズムを作る。
  const ratio = R_MAX / R_MIN;
  const clusters = Math.floor(CLUSTERS_PER_SEC * seconds);
  for (let c = 0; c < clusters; c++) {
    const center = Math.random() * n;
    const size = 1 + Math.floor(Math.pow(Math.random(), 1.5) * 9); // 1〜9個
    const spread = (0.004 + Math.random() * 0.05) * sampleRate;
    // クラスターごとに音源の位置と大きさの傾向をそろえる
    const pan = Math.random();
    const gl = Math.cos(pan * Math.PI * 0.5);
    const gr = Math.sin(pan * Math.PI * 0.5);
    const bias = Math.random();

    for (let b = 0; b < size; b++) {
      // 小さい気泡ほど多くなるよう偏らせる。bias でクラスターごとの音域をそろえる
      const u = Math.pow(Math.random() * 0.55 + bias * 0.45, 1.5);
      const r = R_MIN * Math.pow(ratio, u);
      const f0 = 3 / r;
      const d = 0.043 * f0 + 1.46e-4 * Math.pow(f0, 1.5);
      // 大きい気泡ほど大きな音（指数を寝かせて小さい気泡の粒立ちも残す）
      const amp = 0.3 * Math.pow(r / R_MAX, 0.45) * (0.35 + 0.65 * Math.random());

      const start = Math.floor(center + (Math.random() - 0.5) * spread + n) % n;
      const dur = Math.min(n, Math.ceil((6 / d) * sampleRate)); // 振幅が 0.25% になるまで
      const twoPiF0 = 2 * Math.PI * f0;
      for (let k = 0; k < dur; k++) {
        const t = k / sampleRate;
        const env = Math.exp(-d * t);
        // f(t) = f0(1 + σ·d·t) を積分した位相
        const v = amp * env * Math.sin(twoPiF0 * t * (1 + 0.5 * SIGMA * d * t));
        const idx = (start + k) % n;
        left[idx] += v * gl;
        right[idx] += v * gr;
      }
    }
  }

  // --- 正規化（歪みを避けつつ余裕を持たせる）---
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(left[i]);
    const b2 = Math.abs(right[i]);
    if (a > peak) peak = a;
    if (b2 > peak) peak = b2;
  }
  if (peak > 0) {
    const k = 0.82 / peak;
    for (let i = 0; i < n; i++) {
      left[i] *= k;
      right[i] *= k;
    }
  }

  return { left, right };
}

/** 生成した波形を AudioBuffer にする */
export function createStreamBuffer(ctx: BaseAudioContext, seconds = LOOP_SECONDS): AudioBuffer {
  const { left, right } = renderStreamLoop(ctx.sampleRate, seconds);
  const buf = ctx.createBuffer(2, left.length, ctx.sampleRate);
  buf.getChannelData(0).set(left);
  buf.getChannelData(1).set(right);
  return buf;
}

/* ===== 再生グラフ ===== */

export interface WaterGraph {
  /** このノードを出力先へつなぐ */
  out: GainNode;
  start: (when: number) => void;
  stop: (when: number) => void;
}

/**
 * 再生グラフを組む。近い水流と遠い水流の2レイヤーに、
 * ゆっくりした揺らぎ（流れの強弱・水面の動き）を掛ける。
 * OfflineAudioContext でも動くよう BaseAudioContext だけを使う。
 */
export function buildWaterGraph(ctx: BaseAudioContext, buffer: AudioBuffer): WaterGraph {
  const out = ctx.createGain();
  out.gain.value = 1;

  // 手前の水流
  const near = ctx.createBufferSource();
  near.buffer = buffer;
  near.loop = true;
  const nearGain = ctx.createGain();
  nearGain.gain.value = 0.9;

  // 奥の水流（速度を落として音程を下げ、高域を削ると遠近感が出る）
  const far = ctx.createBufferSource();
  far.buffer = buffer;
  far.loop = true;
  far.playbackRate.value = 0.78;
  const farLp = ctx.createBiquadFilter();
  farLp.type = 'lowpass';
  farLp.frequency.value = 2800;
  const farGain = ctx.createGain();
  farGain.gain.value = 0.42;

  // 全体のトーン: 低域の唸りを削り、耳につく 3kHz 付近を少し下げ、上を丸める
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 170;
  const tame = ctx.createBiquadFilter();
  tame.type = 'peaking';
  tame.frequency.value = 3200;
  tame.Q.value = 0.9;
  tame.gain.value = -2;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7600;
  lp.Q.value = 0.5;

  // 粒立ちを揃えて「録音物」らしくまとめる
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -26;
  comp.knee.value = 24;
  comp.ratio.value = 3;
  comp.attack.value = 0.02;
  comp.release.value = 0.35;

  near.connect(nearGain).connect(hp);
  far.connect(farLp).connect(farGain).connect(hp);
  hp.connect(tame).connect(lp).connect(comp).connect(out);

  // 水面の動き: カットオフをゆっくり上下させる
  const lfoTone = ctx.createOscillator();
  lfoTone.frequency.value = 0.045;
  const lfoToneAmp = ctx.createGain();
  lfoToneAmp.gain.value = 1100;
  lfoTone.connect(lfoToneAmp).connect(lp.frequency);

  // 流れの強弱: 音量をゆっくり上下させる
  const lfoSwell = ctx.createOscillator();
  lfoSwell.frequency.value = 0.031;
  const lfoSwellAmp = ctx.createGain();
  lfoSwellAmp.gain.value = 0.09;
  lfoSwell.connect(lfoSwellAmp).connect(nearGain.gain);

  const dur = buffer.duration;
  return {
    out,
    start: (when: number) => {
      near.start(when, Math.random() * dur);
      far.start(when, Math.random() * dur);
      lfoTone.start(when);
      lfoSwell.start(when);
    },
    stop: (when: number) => {
      try { near.stop(when); } catch { /* ignore */ }
      try { far.stop(when); } catch { /* ignore */ }
      try { lfoTone.stop(when); } catch { /* ignore */ }
      try { lfoSwell.stop(when); } catch { /* ignore */ }
    },
  };
}

/* ===== 共通ヘルパー ===== */

/** S字カーブで音量をなめらかに変化させる（自然なフェードイン/アウト） */
function fadeParam(param: AudioParam, ctx: BaseAudioContext, to: number, seconds: number): void {
  const now = ctx.currentTime;
  const from = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(from, now);
  if (seconds <= 0.02) {
    param.setValueAtTime(to, now);
    return;
  }
  const STEPS = 16;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const curve = 0.5 - 0.5 * Math.cos(Math.PI * t); // ease-in-out
    param.linearRampToValueAtTime(from + (to - from) * curve, now + seconds * t);
  }
}

/* ===== エンジン ===== */

type Listener = () => void;

class WaterSoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private graph: WaterGraph | null = null;
  private fade: GainNode | null = null;
  private cleanupTimer: number | null = null;
  private listeners = new Set<Listener>();

  private playing = false;
  private preparing = false;
  private ducked = false;
  private volume = DEFAULT_VOLUME;
  private fadeSeconds = DEFAULT_FADE;
  private loaded = false;

  private ensureSettings(): void {
    if (this.loaded || typeof window === 'undefined') return;
    this.volume = readNumber(VOLUME_KEY, DEFAULT_VOLUME, 0, 1);
    this.fadeSeconds = readNumber(FADE_KEY, DEFAULT_FADE, 0.5, 12);
    this.loaded = true;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.ensureSettings();
      this.duck = this.ctx.createGain();
      this.duck.gain.value = this.ducked ? DUCK_LEVEL : 1;
      this.duck.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.duck);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { /* ignore */ });
    }
    return this.ctx;
  }

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** 初回再生時の波形合成中は true */
  isPreparing(): boolean {
    return this.preparing;
  }

  getVolume(): number {
    this.ensureSettings();
    return this.volume;
  }

  getFadeSeconds(): number {
    this.ensureSettings();
    return this.fadeSeconds;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(PLAYING_KEY, this.playing ? '1' : '0'); } catch { /* ignore */ }
  }

  /** フェードインで再生を開始する */
  start(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    // フェードアウト中なら後始末を取り消してフェードし直す
    if (this.cleanupTimer !== null) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.graph && this.fade) {
      this.playing = true;
      fadeParam(this.fade.gain, ctx, 1, this.fadeSeconds);
      this.persist();
      this.emit();
      return;
    }

    // 初回だけ波形を合成する（数十ミリ秒かかるので状態を通知）
    if (!this.buffer) {
      this.preparing = true;
      this.emit();
      this.buffer = createStreamBuffer(ctx);
      this.preparing = false;
    }

    const fade = ctx.createGain();
    fade.gain.value = 0;
    fade.connect(this.master);
    const graph = buildWaterGraph(ctx, this.buffer);
    graph.out.connect(fade);
    graph.start(ctx.currentTime);

    this.graph = graph;
    this.fade = fade;
    this.playing = true;
    fadeParam(fade.gain, ctx, 1, this.fadeSeconds);
    this.persist();
    this.emit();
  }

  /** フェードアウトして停止する */
  stop(): void {
    const ctx = this.ctx;
    if (!ctx || !this.graph || !this.fade || !this.playing) return;

    this.playing = false;
    const fade = this.fadeSeconds;
    fadeParam(this.fade.gain, ctx, 0, fade);

    const graph = this.graph;
    const gain = this.fade;
    this.cleanupTimer = window.setTimeout(() => {
      graph.stop(ctx.currentTime);
      try { graph.out.disconnect(); } catch { /* ignore */ }
      try { gain.disconnect(); } catch { /* ignore */ }
      if (this.graph === graph) { this.graph = null; this.fade = null; }
      this.cleanupTimer = null;
      // 停止中はオーディオを休止してバッテリーを節約
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => { /* ignore */ });
      }
      this.emit();
    }, fade * 1000 + 200);

    this.persist();
    this.emit();
  }

  toggle(): void {
    if (this.playing) this.stop();
    else this.start();
  }

  setVolume(v: number): void {
    this.ensureSettings();
    this.volume = Math.min(1, Math.max(0, v));
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch { /* ignore */ }
    }
    if (this.ctx && this.master) fadeParam(this.master.gain, this.ctx, this.volume, 0.15);
    this.emit();
  }

  setFadeSeconds(sec: number): void {
    this.ensureSettings();
    this.fadeSeconds = Math.min(12, Math.max(0.5, sec));
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(FADE_KEY, String(this.fadeSeconds)); } catch { /* ignore */ }
    }
    this.emit();
  }

  /** 音声コール中に音量を下げる（コール終了で元に戻す） */
  setDucked(on: boolean): void {
    if (this.ducked === on) return;
    this.ducked = on;
    if (this.ctx && this.duck) {
      fadeParam(this.duck.gain, this.ctx, on ? DUCK_LEVEL : 1, on ? 0.35 : 0.9);
    }
  }
}

let _engine: WaterSoundEngine | null = null;

export function getWaterSoundEngine(): WaterSoundEngine {
  if (!_engine) _engine = new WaterSoundEngine();
  return _engine;
}

export type { WaterSoundEngine };

/**
 * 自動再開のセットアップ。
 * ブラウザの自動再生制限があるため、最初のタップ/キー操作を待って再生する。
 * @returns 後始末用の関数
 */
export function setupWaterAutoResume(): () => void {
  if (typeof window === 'undefined') return () => { /* noop */ };
  if (!isWaterAutoStartEnabled()) return () => { /* noop */ };
  if (localStorage.getItem(PLAYING_KEY) !== '1') return () => { /* noop */ };

  const engine = getWaterSoundEngine();
  const handler = () => {
    cleanup();
    engine.start();
  };
  const cleanup = () => {
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
    window.removeEventListener('touchstart', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
  window.addEventListener('touchstart', handler, { once: true });
  return cleanup;
}
