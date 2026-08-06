'use client';

/**
 * 作業用 環境音BGM（水音・涼感サウンド）
 *
 * Web Audio API でノイズ・オシレーターから音をリアルタイム合成する。
 * 音源ファイルを持たないためオフライン（PWA）でも動作し、同じ音の繰り返しにならない。
 *
 * - 複数トラックを同時に鳴らせる（例: 雨 + 風鈴）
 * - 再生開始・停止はS字カーブのフェードで自然に出入りする
 * - 音声コール中は自動でダッキング（音量を下げる）
 */

export type AmbientTrackId =
  | 'stream'    // 小川のせせらぎ
  | 'waterfall' // 滝
  | 'rain'      // 雨
  | 'waves'     // 波打ち際
  | 'drip'      // 洞窟の水滴
  | 'chime'     // 風鈴
  | 'breeze';   // 木陰の風

export interface AmbientTrackDef {
  id: AmbientTrackId;
  name: string;
  emoji: string;
  desc: string;
  /** UIのアクセントカラー */
  color: string;
}

export const AMBIENT_TRACKS: AmbientTrackDef[] = [
  { id: 'stream',    emoji: '🏞️', name: '小川のせせらぎ', desc: '浅瀬を流れる水と気泡の音', color: '#38bdf8' },
  { id: 'waterfall', emoji: '💧', name: '滝',             desc: '低く安定した水流。集中向き',   color: '#22d3ee' },
  { id: 'rain',      emoji: '🌧️', name: '雨',             desc: '静かな雨音と遠くの雨脚',       color: '#60a5fa' },
  { id: 'waves',     emoji: '🌊', name: '波打ち際',        desc: 'ゆっくり寄せては返す波',       color: '#2dd4bf' },
  { id: 'drip',      emoji: '🕳️', name: '洞窟の水滴',      desc: '反響する水滴。ひんやり静か',   color: '#818cf8' },
  { id: 'chime',     emoji: '🎐', name: '風鈴',            desc: '風とときおり鳴る澄んだ音',     color: '#a78bfa' },
  { id: 'breeze',    emoji: '🍃', name: '木陰の風',        desc: '葉ずれと通り抜ける風',         color: '#34d399' },
];

/* ===== 設定の保存 ===== */

const VOLUME_KEY = 'cns_ambient_volume';
const TRACKS_KEY = 'cns_ambient_tracks';
const FADE_KEY = 'cns_ambient_fade';
const AUTOSTART_KEY = 'cns_ambient_autostart';

const DEFAULT_VOLUME = 0.35;
const DEFAULT_FADE = 3; // 秒

/** 音声コール中に下げる倍率 */
const DUCK_LEVEL = 0.18;

function readNumber(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function loadSavedTracks(): AmbientTrackId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRACKS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is AmbientTrackId => AMBIENT_TRACKS.some((t) => t.id === x));
  } catch {
    return [];
  }
}

/** アプリ起動時に前回のBGMを自動で再開するか（デフォルト: オフ） */
export function isAmbientAutoStartEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTOSTART_KEY) === '1';
}

export function setAmbientAutoStartEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTOSTART_KEY, on ? '1' : '0');
}

/* ===== ノイズ生成 ===== */

/**
 * ループ再生してもつなぎ目が分からないノイズバッファを作る。
 * 末尾に余分に生成した区間を先頭へクロスフェードして合成する。
 */
function makeNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink' | 'brown', seconds = 6): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(seconds * rate);
  const tail = Math.floor(rate * 0.08); // クロスフェード用の余剰サンプル
  const raw = new Float32Array(len + tail);

  if (type === 'white') {
    for (let i = 0; i < raw.length; i++) raw[i] = Math.random() * 2 - 1;
  } else if (type === 'pink') {
    // Paul Kellet のピンクノイズ近似フィルター
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    // ブラウンノイズ（積分＋わずかなリーク）
    let last = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last * 0.996 + w * 0.04);
      raw[i] = last * 3.2;
    }
  }

  const buf = ctx.createBuffer(1, len, rate);
  const out = buf.getChannelData(0);
  out.set(raw.subarray(0, len));
  for (let i = 0; i < tail; i++) {
    const w = i / tail;
    out[i] = raw[i] * w + raw[len + i] * (1 - w);
  }
  return buf;
}

/* ===== 共通ヘルパー ===== */

/** S字カーブで音量をなめらかに変化させる（自然なフェードイン/アウト） */
function fadeParam(param: AudioParam, ctx: AudioContext, to: number, seconds: number): void {
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

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** トラック1本ぶんのノードとタイマー */
interface ActiveTrack {
  id: AmbientTrackId;
  gain: GainNode;
  /** ループし続ける音源（停止時に stop する） */
  sources: AudioScheduledSourceNode[];
  timers: Set<number>;
  stopping: boolean;
  /** フェードアウト完了時の後始末タイマー */
  cleanupTimer: number | null;
}

interface BuildCtx {
  ctx: AudioContext;
  out: GainNode;
  track: ActiveTrack;
  /** ループ再生する常時ノイズ源 */
  noise: (type: 'white' | 'pink' | 'brown') => AudioBufferSourceNode;
  /** 単発で鳴らすノイズ源（再生後に自動で破棄される） */
  burstSource: (type: 'white' | 'pink' | 'brown') => AudioBufferSourceNode;
  /** ランダム間隔で繰り返す（停止時に自動でキャンセルされる） */
  every: (minMs: number, maxMs: number, fn: () => void) => void;
  /** 1回だけ遅らせて実行する（停止時に自動でキャンセルされる） */
  after: (ms: number, fn: () => void) => void;
}

/* ===== 各トラックの音作り ===== */

/** 定常的なノイズ源（フィルター付き）を組み立てる */
function noiseLayer(
  b: BuildCtx,
  type: 'white' | 'pink' | 'brown',
  filter: { kind: BiquadFilterType; freq: number; q?: number },
  level: number,
): { gain: GainNode; filter: BiquadFilterNode } {
  const src = b.noise(type);
  const flt = b.ctx.createBiquadFilter();
  flt.type = filter.kind;
  flt.frequency.value = filter.freq;
  if (filter.q !== undefined) flt.Q.value = filter.q;
  const g = b.ctx.createGain();
  g.gain.value = level;
  src.connect(flt).connect(g).connect(b.out);
  return { gain: g, filter: flt };
}

/** ゆっくりした揺らぎ（LFO）を AudioParam に加える */
function lfo(b: BuildCtx, hz: number, depth: number, target: AudioParam): void {
  const osc = b.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = hz;
  const amp = b.ctx.createGain();
  amp.gain.value = depth;
  osc.connect(amp).connect(target);
  osc.start(b.ctx.currentTime + rand(0, 2)); // トラックごとに位相をずらす
  b.track.sources.push(osc);
}

/** 短い減衰音（気泡・水滴・鈴）を鳴らす */
function pluck(
  b: BuildCtx,
  opts: { from: number; to: number; peak: number; decay: number; type?: OscillatorType; dest?: AudioNode },
): void {
  const now = b.ctx.currentTime;
  const osc = b.ctx.createOscillator();
  osc.type = opts.type || 'sine';
  osc.frequency.setValueAtTime(opts.from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), now + opts.decay);
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(opts.peak, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.decay);
  osc.connect(g).connect(opts.dest || b.out);
  osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch { /* ignore */ } };
  osc.start(now);
  osc.stop(now + opts.decay + 0.05);
}

/** ノイズを短く切り出したバースト（葉ずれ・雨粒の当たる音） */
function noiseBurst(
  b: BuildCtx,
  opts: { freq: number; q: number; peak: number; attack: number; decay: number },
): void {
  const now = b.ctx.currentTime;
  const src = b.burstSource('white');
  const flt = b.ctx.createBiquadFilter();
  flt.type = 'bandpass';
  flt.frequency.value = opts.freq;
  flt.Q.value = opts.q;
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(opts.peak, now + opts.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.attack + opts.decay);
  src.connect(flt).connect(g).connect(b.out);
  src.onended = () => { try { src.disconnect(); flt.disconnect(); g.disconnect(); } catch { /* ignore */ } };
  src.start(now, Math.random() * 4);
  src.stop(now + opts.attack + opts.decay + 0.05);
}

const BUILDERS: Record<AmbientTrackId, (b: BuildCtx) => void> = {
  /** 小川のせせらぎ: 帯域を揺らした水流 + ときおり弾ける気泡 */
  stream: (b) => {
    const body = noiseLayer(b, 'pink', { kind: 'bandpass', freq: 900, q: 0.8 }, 0.45);
    lfo(b, 0.08, 260, body.filter.frequency);
    lfo(b, 0.21, 0.12, body.gain.gain);

    const sizzle = noiseLayer(b, 'white', { kind: 'highpass', freq: 2600 }, 0.1);
    lfo(b, 0.13, 0.05, sizzle.gain.gain);

    noiseLayer(b, 'brown', { kind: 'lowpass', freq: 320 }, 0.16);

    b.every(120, 700, () => {
      const f = rand(700, 1900);
      pluck(b, { from: f, to: f * rand(1.4, 2.2), peak: rand(0.012, 0.05), decay: rand(0.05, 0.12) });
    });
  },

  /** 滝: 太く安定した水流。集中しやすい定常音 */
  waterfall: (b) => {
    const low = noiseLayer(b, 'brown', { kind: 'lowpass', freq: 800 }, 0.3);
    lfo(b, 0.05, 0.07, low.gain.gain);

    const mid = noiseLayer(b, 'pink', { kind: 'bandpass', freq: 1200, q: 0.6 }, 0.18);
    lfo(b, 0.09, 180, mid.filter.frequency);

    const spray = noiseLayer(b, 'white', { kind: 'highpass', freq: 3500 }, 0.05);
    lfo(b, 0.17, 0.03, spray.gain.gain);
  },

  /** 雨: 細かい雨音 + 遠くの雨脚 + 軒先のしずく */
  rain: (b) => {
    const hiss = noiseLayer(b, 'white', { kind: 'bandpass', freq: 2200, q: 0.5 }, 0.3);
    lfo(b, 0.06, 0.06, hiss.gain.gain);

    noiseLayer(b, 'pink', { kind: 'lowpass', freq: 900 }, 0.28);
    const rumble = noiseLayer(b, 'brown', { kind: 'lowpass', freq: 200 }, 0.2);
    lfo(b, 0.03, 0.06, rumble.gain.gain);

    b.every(200, 900, () => {
      noiseBurst(b, { freq: rand(1800, 4200), q: 3, peak: rand(0.02, 0.06), attack: 0.004, decay: rand(0.03, 0.09) });
    });
  },

  /** 波打ち際: ゆっくり寄せて返すうねりと泡 */
  waves: (b) => {
    const swell = noiseLayer(b, 'brown', { kind: 'lowpass', freq: 600 }, 0.2);
    lfo(b, 0.075, 0.17, swell.gain.gain);

    const foam = noiseLayer(b, 'white', { kind: 'highpass', freq: 1800 }, 0.06);
    lfo(b, 0.075, 0.09, foam.gain.gain);
    lfo(b, 0.11, 0.04, foam.gain.gain);

    const mid = noiseLayer(b, 'pink', { kind: 'bandpass', freq: 700, q: 0.7 }, 0.12);
    lfo(b, 0.037, 240, mid.filter.frequency);
  },

  /** 洞窟の水滴: 反響する滴りと静かな地下水の気配 */
  drip: (b) => {
    noiseLayer(b, 'pink', { kind: 'lowpass', freq: 420 }, 0.18);

    // 洞窟の反響（ディレイ + フィードバック）
    const delay = b.ctx.createDelay(1.5);
    delay.delayTime.value = 0.29;
    const fb = b.ctx.createGain();
    fb.gain.value = 0.34;
    const damp = b.ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1800;
    const echoOut = b.ctx.createGain();
    echoOut.gain.value = 0.6;
    delay.connect(damp).connect(fb).connect(delay);
    delay.connect(echoOut).connect(b.out);

    const send = b.ctx.createGain();
    send.gain.value = 1;
    send.connect(b.out);
    send.connect(delay);

    b.every(900, 3800, () => {
      const f = rand(700, 1500);
      pluck(b, { from: f * 2.1, to: f * 0.7, peak: rand(0.14, 0.3), decay: rand(0.16, 0.3), dest: send });
    });
  },

  /** 風鈴: 風の音にときおり澄んだ鈴の音が重なる */
  chime: (b) => {
    const wind = noiseLayer(b, 'pink', { kind: 'bandpass', freq: 480, q: 1.1 }, 0.36);
    lfo(b, 0.05, 220, wind.filter.frequency);
    lfo(b, 0.07, 0.16, wind.gain.gain);
    noiseLayer(b, 'brown', { kind: 'lowpass', freq: 260 }, 0.16);

    // 涼しげな五音音階
    const SCALE = [1046.5, 1174.7, 1396.9, 1568.0, 1864.7];
    const strike = () => {
      const base = SCALE[Math.floor(Math.random() * SCALE.length)];
      const level = rand(0.07, 0.14);
      // 金属的な倍音構成（非整数倍）
      [[1, 1], [2.76, 0.42], [5.4, 0.16]].forEach(([mul, amp]) => {
        pluck(b, { from: base * mul, to: base * mul * 0.995, peak: level * amp, decay: rand(2.2, 3.6) });
      });
    };
    b.every(2500, 9000, () => {
      strike();
      // 風にあおられて続けて鳴ることがある
      if (Math.random() < 0.45) b.after(rand(180, 500), strike);
    });
  },

  /** 木陰の風: 抜ける風と葉ずれ */
  breeze: (b) => {
    const air = noiseLayer(b, 'pink', { kind: 'lowpass', freq: 700 }, 0.52);
    lfo(b, 0.04, 420, air.filter.frequency);
    lfo(b, 0.06, 0.22, air.gain.gain);

    const hiss = noiseLayer(b, 'white', { kind: 'bandpass', freq: 3200, q: 0.7 }, 0.07);
    lfo(b, 0.055, 0.045, hiss.gain.gain);

    b.every(3000, 9000, () => {
      noiseBurst(b, { freq: rand(2600, 5200), q: 1.2, peak: rand(0.03, 0.08), attack: rand(0.6, 1.4), decay: rand(1.0, 2.2) });
    });
  },
};

/* ===== エンジン本体 ===== */

type Listener = () => void;

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private active = new Map<AmbientTrackId, ActiveTrack>();
  private listeners = new Set<Listener>();
  private ducked = false;

  private volume = DEFAULT_VOLUME;
  private fadeSeconds = DEFAULT_FADE;
  private loaded = false;

  /** localStorage から設定を読み込む（クライアント側で1回だけ） */
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

  private getNoise(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer {
    let buf = this.buffers.get(type);
    if (!buf) {
      buf = makeNoiseBuffer(ctx, type);
      this.buffers.set(type, buf);
    }
    return buf;
  }

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  isPlaying(id: AmbientTrackId): boolean {
    const t = this.active.get(id);
    return !!t && !t.stopping;
  }

  getActiveIds(): AmbientTrackId[] {
    return AMBIENT_TRACKS.map((t) => t.id).filter((id) => this.isPlaying(id));
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

  private persistTracks(): void {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(TRACKS_KEY, JSON.stringify(this.getActiveIds())); } catch { /* ignore */ }
  }

  /** トラックを1本フェードインで再生する */
  start(id: AmbientTrackId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    // フェードアウト中だった場合は後始末を取り消してフェードインし直す
    const existing = this.active.get(id);
    if (existing) {
      if (existing.cleanupTimer !== null) {
        clearTimeout(existing.cleanupTimer);
        existing.cleanupTimer = null;
      }
      existing.stopping = false;
      fadeParam(existing.gain.gain, ctx, 1, this.fadeSeconds);
      this.persistTracks();
      this.emit();
      return;
    }

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);

    const track: ActiveTrack = { id, gain, sources: [], timers: new Set(), stopping: false, cleanupTimer: null };

    const b: BuildCtx = {
      ctx,
      out: gain,
      track,
      noise: (type) => {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoise(ctx, type);
        src.loop = true;
        // 同じ波形が重ならないよう再生位置をずらす
        src.start(ctx.currentTime, Math.random() * (src.buffer?.duration || 1));
        track.sources.push(src);
        return src;
      },
      burstSource: (type) => {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoise(ctx, type);
        return src;
      },
      every: (minMs, maxMs, fn) => {
        let current = 0;
        const arm = () => {
          track.timers.delete(current);
          current = window.setTimeout(() => {
            if (track.stopping) return;
            try { fn(); } catch { /* ignore */ }
            arm();
          }, rand(minMs, maxMs));
          track.timers.add(current);
        };
        arm();
      },
      after: (ms, fn) => {
        const t = window.setTimeout(() => {
          track.timers.delete(t);
          if (track.stopping) return;
          try { fn(); } catch { /* ignore */ }
        }, ms);
        track.timers.add(t);
      },
    };

    BUILDERS[id](b);
    this.active.set(id, track);
    fadeParam(gain.gain, ctx, 1, this.fadeSeconds);
    this.persistTracks();
    this.emit();
  }

  /** トラックをフェードアウトして停止する */
  stop(id: AmbientTrackId): void {
    const track = this.active.get(id);
    if (!track || track.stopping) return;
    const ctx = this.ctx;
    if (!ctx) return;

    track.stopping = true;
    const fade = this.fadeSeconds;
    fadeParam(track.gain.gain, ctx, 0, fade);

    track.cleanupTimer = window.setTimeout(() => {
      track.timers.forEach((t) => clearTimeout(t));
      track.timers.clear();
      track.sources.forEach((s) => {
        try { s.stop(); } catch { /* ignore */ }
        try { s.disconnect(); } catch { /* ignore */ }
      });
      track.sources = [];
      try { track.gain.disconnect(); } catch { /* ignore */ }
      this.active.delete(id);
      // 全部止まったらオーディオを休止してバッテリーを節約
      if (this.active.size === 0 && this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => { /* ignore */ });
      }
      this.emit();
    }, fade * 1000 + 200);

    this.persistTracks();
    this.emit();
  }

  toggle(id: AmbientTrackId): void {
    if (this.isPlaying(id)) this.stop(id);
    else this.start(id);
  }

  stopAll(): void {
    this.getActiveIds().forEach((id) => this.stop(id));
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

  /** 保存済みのトラックを復元して再生（自動再開用） */
  restoreSaved(): boolean {
    const saved = loadSavedTracks();
    if (saved.length === 0) return false;
    saved.forEach((id) => this.start(id));
    return true;
  }
}

let _engine: AmbientEngine | null = null;

export function getAmbientEngine(): AmbientEngine {
  if (!_engine) _engine = new AmbientEngine();
  return _engine;
}

export type { AmbientEngine };

/**
 * 自動再開のセットアップ。
 * ブラウザの自動再生制限があるため、最初のタップ/キー操作を待って再生する。
 * @returns 後始末用の関数
 */
export function setupAmbientAutoResume(): () => void {
  if (typeof window === 'undefined') return () => { /* noop */ };
  if (!isAmbientAutoStartEnabled()) return () => { /* noop */ };
  if (loadSavedTracks().length === 0) return () => { /* noop */ };

  const engine = getAmbientEngine();
  const handler = () => {
    cleanup();
    engine.restoreSaved();
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
