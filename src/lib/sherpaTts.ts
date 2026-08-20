'use client';

/**
 * sherpa-onnx（Next-gen Kaldi）による端末内 TTS。
 *
 * WebAssembly 版の sherpa-onnx を読み込んで、通信なしで音声を合成する。
 * VITS / Piper / Kokoro などの ONNX モデルを、モデルごとに用意された
 * WebAssembly 一式（4ファイル）として置いておき、それをここから読み込む。
 *
 *   sherpa-onnx-wasm-main-tts.js    … Emscripten のグルーコード
 *   sherpa-onnx-wasm-main-tts.wasm  … WebAssembly 本体
 *   sherpa-onnx-wasm-main-tts.data  … モデル（ONNX）と辞書をまとめたもの
 *   sherpa-onnx-tts.js              … createOfflineTts を定義するヘルパー
 *
 * 置き場所は設定ページの「音声」タブで変えられる（既定は `public/sherpa/`）。
 * 一度読み込んだファイルは Cache Storage に残すので、2回目以降は圏外でも鳴る。
 *
 * ライセンス: sherpa-onnx は Apache-2.0。商用・個人利用ともに無料。
 */

import { float32ToWavBlob, normalizeJapaneseForTts } from './ttsAudio';
import { getVoiceSettings } from './voiceSettings';

/** WebAssembly 一式のファイル名（sherpa-onnx の wasm/tts ビルドの既定名） */
const FILES = {
  glue: 'sherpa-onnx-wasm-main-tts.js',
  helper: 'sherpa-onnx-tts.js',
  wasm: 'sherpa-onnx-wasm-main-tts.wasm',
  data: 'sherpa-onnx-wasm-main-tts.data',
} as const;

/** ダウンロード済みファイルを残しておく Cache Storage の名前 */
const CACHE_NAME = 'sherpa-onnx-tts-v1';

export type SherpaStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SherpaState {
  status: SherpaStatus;
  /** 0〜1。読み込みの進み具合（分からないときは 0） */
  progress: number;
  /** 画面に出す一言（「モデルを読み込み中」など） */
  message: string;
  /** 失敗したときの理由 */
  error: string | null;
  /** 読み込んだモデルが持つ話者の数（1 なら話者切り替えなし） */
  numSpeakers: number;
}

let _state: SherpaState = {
  status: 'idle', progress: 0, message: '', error: null, numSpeakers: 1,
};
const _listeners = new Set<(s: SherpaState) => void>();

function setState(patch: Partial<SherpaState>): void {
  _state = { ..._state, ...patch };
  _listeners.forEach((fn) => fn(_state));
}

export function getSherpaState(): SherpaState {
  return _state;
}

export function subscribeSherpaState(fn: (s: SherpaState) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/** 設定のアセット置き場を、絶対 URL（末尾スラッシュ付き）に直す */
export function resolveBaseUrl(raw?: string): string {
  const base = (raw ?? getVoiceSettings().sherpa.baseUrl).trim() || 'sherpa/';
  const withSlash = base.endsWith('/') ? base : `${base}/`;
  if (typeof document === 'undefined') return withSlash;
  try {
    return new URL(withSlash, document.baseURI).href;
  } catch {
    return withSlash;
  }
}

/* ===== ダウンロード（Cache Storage 付き） ===== */

async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  try { return await caches.open(CACHE_NAME); } catch { return null; }
}

/**
 * URL を取得する。Cache Storage にあればそれを使い、無ければ取ってきて残す。
 * onProgress には 0〜1 を渡す（サーバーが長さを返さないときは進捗を出さない）。
 */
async function fetchWithCache(
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<Response> {
  const cache = await openCache();
  const hit = cache ? await cache.match(url) : undefined;
  if (hit) { onProgress?.(1); return hit; }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url.split('/').pop()} が読み込めません (HTTP ${res.status})`);

  const total = Number(res.headers.get('content-length') || 0);
  let body: Response = res;
  if (total > 0 && res.body && onProgress) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); loaded += value.byteLength; onProgress(Math.min(1, loaded / total)); }
    }
    const merged = new Uint8Array(loaded);
    let at = 0;
    for (const c of chunks) { merged.set(c, at); at += c.byteLength; }
    body = new Response(merged, { headers: res.headers });
  } else {
    onProgress?.(1);
  }

  if (cache) {
    try { await cache.put(url, body.clone()); } catch { /* 容量不足などは無視 */ }
  }
  return body;
}

/** ダウンロード済みのファイルを消す（モデルを入れ替えたいときなど） */
export async function clearSherpaCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try { await caches.delete(CACHE_NAME); } catch { /* ignore */ }
  _tts = null;
  _loading = null;
  _loadedBase = '';
  setState({ status: 'idle', progress: 0, message: '', error: null, numSpeakers: 1 });
}

/* ===== WebAssembly の読み込み ===== */

/** Emscripten のグルーコードは「グローバルの Module」を見るため any で扱う */
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

interface OfflineTts {
  generate(opts: { text: string; sid: number; speed: number }): { samples: Float32Array; sampleRate: number };
  numSpeakers?: number;
  sampleRate?: number;
}

let _tts: OfflineTts | null = null;
let _loading: Promise<OfflineTts> | null = null;
/** いま読み込んであるアセットの置き場。設定で変わったら読み込み直す */
let _loadedBase = '';

/** JavaScript をグローバルスコープで実行する（Emscripten の Module 受け渡しに必要） */
function runScript(code: string, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('script');
    el.src = url;
    el.onload = () => { URL.revokeObjectURL(url); resolve(); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${name} の読み込みに失敗しました`)); };
    document.head.appendChild(el);
  });
}

async function loadTts(): Promise<OfflineTts> {
  const base = resolveBaseUrl();
  if (_tts && _loadedBase === base) return _tts;
  if (_loading && _loadedBase === base) return _loading;

  _loadedBase = base;
  _tts = null;

  _loading = (async (): Promise<OfflineTts> => {
    setState({ status: 'loading', progress: 0, message: 'モデルを読み込んでいます', error: null });

    // 大きい2ファイル（wasm と data）の進捗を合わせて表示する
    let wasmRatio = 0;
    let dataRatio = 0;
    const report = () => setState({ progress: (wasmRatio * 0.25 + dataRatio * 0.75) });

    const [glueRes, helperRes, wasmRes, dataRes] = await Promise.all([
      fetchWithCache(base + FILES.glue),
      fetchWithCache(base + FILES.helper),
      fetchWithCache(base + FILES.wasm, (r) => { wasmRatio = r; report(); }),
      fetchWithCache(base + FILES.data, (r) => { dataRatio = r; report(); }),
    ]);

    const [glueCode, helperCode, wasmBinary, dataBuf] = await Promise.all([
      glueRes.text(), helperRes.text(), wasmRes.arrayBuffer(), dataRes.arrayBuffer(),
    ]);

    setState({ progress: 1, message: '音声エンジンを準備しています' });

    const g = globalThis as AnyRecord;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('音声エンジンの初期化がタイムアウトしました')), 120000);
      g.Module = {
        // 取得済みのバイナリを直接渡す（もう一度ネットワークに出さない）
        wasmBinary,
        // .data（モデル一式）も取得済みのものを使う
        getPreloadedPackage: () => dataBuf,
        locateFile: (path: string) => base + path,
        print: () => { /* 出力は捨てる */ },
        printErr: (msg: string) => { console.warn('[sherpa-onnx]', msg); },
        onRuntimeInitialized: () => { clearTimeout(timer); resolve(); },
        onAbort: (msg: unknown) => { clearTimeout(timer); reject(new Error(`sherpa-onnx: ${String(msg)}`)); },
      } as AnyRecord;
      // グルーコード → ヘルパーの順に、グローバルスコープで実行する
      void runScript(glueCode, FILES.glue)
        .then(() => runScript(helperCode, FILES.helper))
        .catch((e) => { clearTimeout(timer); reject(e); });
    });

    const create = (globalThis as AnyRecord).createOfflineTts;
    if (typeof create !== 'function') {
      throw new Error(`${FILES.helper} に createOfflineTts がありません`);
    }
    const tts = create((globalThis as AnyRecord).Module) as OfflineTts;
    _tts = tts;
    setState({
      status: 'ready', progress: 1, message: '使えます', error: null,
      numSpeakers: Math.max(1, Number(tts.numSpeakers) || 1),
    });
    return tts;
  })();

  try {
    return await _loading;
  } catch (e) {
    _loading = null;
    _loadedBase = '';
    const msg = e instanceof Error ? e.message : String(e);
    setState({ status: 'error', progress: 0, message: '', error: msg });
    throw e;
  }
}

/** 読み込み済みで、すぐ鳴らせる状態か */
export function isSherpaReady(): boolean {
  return _tts !== null && _loadedBase === resolveBaseUrl();
}

/** 先に読み込んでおく（設定ページの「準備する」ボタン・アプリ起動時に使う） */
export async function prepareSherpaTts(): Promise<void> {
  await loadTts();
}

/**
 * sherpa-onnx で音声を作る。
 * @param sid   話者番号（複数話者モデルのとき）
 * @param speed 話す速さ（1.0 が標準）
 */
export async function sherpaGenerateSpeech(
  text: string,
  options?: { sid?: number; speed?: number; signal?: AbortSignal },
): Promise<Blob> {
  const tts = await loadTts();
  if (options?.signal?.aborted) throw new DOMException('aborted', 'AbortError');

  const speed = Math.min(2, Math.max(0.5, options?.speed ?? 1));
  const sid = Math.max(0, Math.floor(options?.sid ?? 0));
  // 句読点でしっかり間を取る（Gemini TTS と同じ前処理）
  const normalized = normalizeJapaneseForTts(text);

  const out = tts.generate({ text: normalized, sid, speed });
  if (!out || !out.samples || out.samples.length === 0) {
    throw new Error('sherpa-onnx が音声を返しませんでした');
  }
  return float32ToWavBlob(out.samples, out.sampleRate);
}
