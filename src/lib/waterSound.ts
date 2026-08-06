'use client';

/**
 * 作業用BGM「水の流れる音」
 *
 * 実録音（`public/sounds/water-loop.mp3`）を Web Audio で途切れなくループ再生する。
 * 音源は30秒のシームレスループ素材で、末尾2秒を先頭へ等パワークロスフェード済み。
 * そのため継ぎ目でクリックノイズが出ない。
 *
 * - 再生開始・停止はS字カーブのフェードで自然に出入りする
 * - 音声コール中は自動でダッキング（音量を下げる）
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

/** 音源ファイルのループ長（秒）。素材の実長と一致させること */
const LOOP_SECONDS = 30;

/** 無音とみなす振幅。デコーダーが先頭に付ける無音を読み飛ばすために使う */
const SILENCE_THRESHOLD = 0.0015;

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

/** 音源の候補URL（basePath 付き配信・開発サーバーの両方に対応） */
function soundUrls(): string[] {
  const file = 'sounds/water-loop.mp3';
  if (typeof window === 'undefined') return [`/${file}`];
  const dir = window.location.pathname.replace(/\/[^/]*$/, '');
  return [
    `${dir}/${file}`,
    `${window.location.origin}/Container/${file}`,
    `${window.location.origin}/${file}`,
  ];
}

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

/**
 * デコード結果の先頭に無音が付いている場合の位置を返す。
 * MP3/AAC は仕様上デコード時に先頭へ無音（エンコーダー遅延）が入ることがあり、
 * これをループ区間に含めると1周ごとに無音が挟まってしまう。
 */
function findContentStart(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 0.5));
  for (let i = 0; i < limit; i++) {
    if (Math.abs(data[i]) > SILENCE_THRESHOLD) return i / buffer.sampleRate;
  }
  return 0;
}

/* ===== エンジン ===== */

type Listener = () => void;

class WaterSoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<AudioBuffer | null> | null = null;
  private source: AudioBufferSourceNode | null = null;
  private fadeGain: GainNode | null = null;
  private cleanupTimer: number | null = null;
  private listeners = new Set<Listener>();

  private playing = false;
  private loadingFlag = false;
  private error: string | null = null;
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

  /** 音源を読み込んでデコードする（1回だけ） */
  private load(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.buffer) return Promise.resolve(this.buffer);
    if (this.loading) return this.loading;

    this.loadingFlag = true;
    this.error = null;
    this.emit();

    this.loading = (async () => {
      let lastError = '';
      for (const url of soundUrls()) {
        try {
          const res = await fetch(url);
          if (!res.ok) { lastError = `HTTP ${res.status}`; continue; }
          const bytes = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(bytes);
          this.buffer = decoded;
          return decoded;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
      this.error = `水の音を読み込めませんでした（${lastError}）`;
      return null;
    })().finally(() => {
      this.loadingFlag = false;
      this.loading = null;
      this.emit();
    });

    return this.loading;
  }

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** 音源の読み込み中は true */
  isLoading(): boolean {
    return this.loadingFlag;
  }

  getError(): string | null {
    return this.error;
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
    if (this.source && this.fadeGain) {
      this.playing = true;
      fadeParam(this.fadeGain.gain, ctx, 1, this.fadeSeconds);
      this.persist();
      this.emit();
      return;
    }

    this.playing = true;
    this.persist();
    this.emit();

    void this.load(ctx).then((buffer) => {
      // 読み込み中に停止された場合は再生しない
      if (!buffer || !this.playing || this.source || !this.master || !this.ctx) return;
      const c = this.ctx;
      if (c.state === 'suspended') c.resume().catch(() => { /* ignore */ });

      const fadeGain = c.createGain();
      fadeGain.gain.value = 0;
      fadeGain.connect(this.master);

      const src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      // デコーダーが付ける先頭の無音を避けてループ区間を指定する
      const contentStart = findContentStart(buffer);
      src.loopStart = contentStart;
      src.loopEnd = Math.min(buffer.duration, contentStart + LOOP_SECONDS);
      src.connect(fadeGain);
      // 毎回同じ位置から始まると単調なので、ループ区間内のランダムな位置から鳴らす
      const span = src.loopEnd - src.loopStart;
      src.start(c.currentTime, src.loopStart + Math.random() * span);

      this.source = src;
      this.fadeGain = fadeGain;
      fadeParam(fadeGain.gain, c, 1, this.fadeSeconds);
      this.emit();
    });
  }

  /** フェードアウトして停止する */
  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    this.persist();

    const ctx = this.ctx;
    const src = this.source;
    const gain = this.fadeGain;
    // まだ読み込み中なら鳴らさずに終わり（start 側で playing を見て中断する）
    if (!ctx || !src || !gain) {
      this.emit();
      return;
    }

    const fade = this.fadeSeconds;
    fadeParam(gain.gain, ctx, 0, fade);
    this.source = null;
    this.fadeGain = null;

    this.cleanupTimer = window.setTimeout(() => {
      try { src.stop(); } catch { /* ignore */ }
      try { src.disconnect(); } catch { /* ignore */ }
      try { gain.disconnect(); } catch { /* ignore */ }
      this.cleanupTimer = null;
      // 停止中はオーディオを休止してバッテリーを節約
      if (this.ctx && !this.playing && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => { /* ignore */ });
      }
      this.emit();
    }, fade * 1000 + 200);

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
