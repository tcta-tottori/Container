'use client';

/**
 * 作った音声のしまい場所（IndexedDB）。
 *
 * コールの文言は「お願いします！」「長谷川さん！」のように毎回おなじものが多い。
 * 毎回 API に作らせると、そのたびに待たされるうえ、通信が切れていると鳴らない。
 * そこで一度作った音声を端末に取っておき、次からはそれをそのまま鳴らす。
 *
 * - 鍵は「モデル・話者・話し方・読み上げる文」の組み合わせ。
 *   どれかが変われば別の音声なので、作り直しになる。
 * - 音声そのもの（`speech`）と、大きさ・最後に使った時刻（`meta`）を分けて持つ。
 *   数や大きさを見るとき・捨てるときに、音声そのものを読み込まずに済ませるため。
 * - 数が上限を超えたら、使っていないものから順に捨てる。
 * - IndexedDB が使えない・壊れているときは、何も取っておかずにそのまま通す
 *   （キャッシュが理由でコールが鳴らなくなることはない）。
 */

const DB_NAME = 'cns-speech';
const DB_VERSION = 1;
/** 音声そのもの（鍵 → Blob） */
const STORE_AUDIO = 'speech';
/** 大きさ・最後に使った時刻など（鍵 → SpeechMeta） */
const STORE_META = 'meta';

/** 取っておく数の上限。これを超えたら使っていないものから捨てる */
const MAX_ENTRIES = 300;

/** 音声 1 つぶんの覚え書き */
interface SpeechMeta {
  key: string;
  /** 何を読み上げたもの */
  text: string;
  bytes: number;
  createdAt: number;
  /** 最後に鳴らした時刻。捨てる順番を決めるのに使う */
  usedAt: number;
}

/** しまってある音声の数と大きさ */
export interface SpeechCacheStats {
  count: number;
  bytes: number;
}

let _db: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (_db) return _db;
  _db = new Promise<IDBDatabase | null>((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) db.createObjectStore(STORE_AUDIO);
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' }).createIndex('usedAt', 'usedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return _db;
}

/** 1 つの読み書きを Promise にする。使えないときは null を返すだけで投げない */
function run<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then((db) => {
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      let req: IDBRequest<T>;
      try {
        req = fn(db.transaction(stores, mode));
      } catch {
        resolve(null);
        return;
      }
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  });
}

/**
 * 音声の作り方の版。作り方を変えたら上げる（前の作り方で取っておいた音声を使わないため）。
 * 2: 指示文と読む文を分けて送り、末尾の雑音を削るようにした
 * 3: 末尾のザーッという雑音・小さな雑音も削るようにした。声の高さは指示文で頼まなくした
 */
const SPEECH_FORMAT_VERSION = 3;

/**
 * 音声を見分ける鍵。
 * モデル・話者・話し方・文・作り方の版 のどれかが変われば別の音声になる。
 */
export function speechCacheKey(parts: {
  model: string;
  voice: string;
  style: string;
  text: string;
}): string {
  return [SPEECH_FORMAT_VERSION, parts.model, parts.voice, parts.style, parts.text].join('\u0001');
}

/** しまってある音声を取り出す。無ければ null */
export async function getCachedSpeech(key: string): Promise<Blob | null> {
  const blob = await run<Blob | undefined>(
    STORE_AUDIO, 'readonly', (tx) => tx.objectStore(STORE_AUDIO).get(key) as IDBRequest<Blob | undefined>,
  );
  if (!blob) return null;
  // 最後に使った時刻を更新する（捨てる順番のため）。書けなくても鳴らすほうを優先する
  void touch(key);
  return blob;
}

/**
 * 最後に使った時刻を今にする。
 *
 * 読んでから書くまでを 1 つの取引（トランザクション）の中で済ませる。
 * 分けてしまうと、間に「ぜんぶ捨てる」が入ったときに覚え書きだけが書き戻り、
 * 音声が無いのに件数だけ残ってしまう。
 */
function touch(key: string): Promise<void> {
  return openDb().then((db) => {
    if (!db) return;
    return new Promise<void>((resolve) => {
      let req: IDBRequest<IDBCursorWithValue | null>;
      try {
        req = db.transaction(STORE_META, 'readwrite').objectStore(STORE_META).openCursor(key);
      } catch {
        resolve();
        return;
      }
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          const meta = cur.value as SpeechMeta;
          try { cur.update({ ...meta, usedAt: Date.now() }); } catch { /* 書けなくても鳴らすほうを優先 */ }
        }
        resolve();
      };
      req.onerror = () => resolve();
    });
  });
}

/** 作った音声をしまう。数が上限を超えたら使っていないものから捨てる */
export async function putCachedSpeech(key: string, blob: Blob, text: string): Promise<void> {
  const now = Date.now();
  const meta: SpeechMeta = { key, text, bytes: blob.size, createdAt: now, usedAt: now };
  await run([STORE_AUDIO, STORE_META], 'readwrite', (tx) => {
    tx.objectStore(STORE_META).put(meta);
    return tx.objectStore(STORE_AUDIO).put(blob, key);
  });
  await evictIfNeeded();
}

/**
 * 最後に使ったのが古い順に、鍵だけを [n] 個集める。
 * 音声そのものは読み込まないので、たくさん入っていても重くならない。
 */
function oldestKeys(n: number): Promise<string[]> {
  return openDb().then((db) => {
    if (!db || n <= 0) return [];
    return new Promise<string[]>((resolve) => {
      const out: string[] = [];
      let req: IDBRequest<IDBCursor | null>;
      try {
        req = db.transaction(STORE_META, 'readonly').objectStore(STORE_META).index('usedAt').openKeyCursor();
      } catch {
        resolve(out);
        return;
      }
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur || out.length >= n) { resolve(out); return; }
        out.push(String(cur.primaryKey));
        cur.continue();
      };
      req.onerror = () => resolve(out);
    });
  });
}

/** 上限を超えていたら、使っていないものから順に捨てる */
async function evictIfNeeded(): Promise<void> {
  const count = await run<number>(STORE_META, 'readonly', (tx) => tx.objectStore(STORE_META).count());
  if (count === null || count <= MAX_ENTRIES) return;

  const keys = await oldestKeys(count - MAX_ENTRIES);
  for (const key of keys) {
    await run([STORE_AUDIO, STORE_META], 'readwrite', (tx) => {
      tx.objectStore(STORE_META).delete(key);
      return tx.objectStore(STORE_AUDIO).delete(key);
    });
  }
}

/** しまってある音声の数と大きさ（音声そのものは読み込まない） */
export async function speechCacheStats(): Promise<SpeechCacheStats> {
  const all = await run<SpeechMeta[]>(
    STORE_META, 'readonly', (tx) => tx.objectStore(STORE_META).getAll() as IDBRequest<SpeechMeta[]>,
  );
  if (!all) return { count: 0, bytes: 0 };
  return { count: all.length, bytes: all.reduce((sum, m) => sum + (m.bytes || 0), 0) };
}

/** しまってある音声をぜんぶ捨てる */
export async function clearSpeechCache(): Promise<void> {
  await run([STORE_AUDIO, STORE_META], 'readwrite', (tx) => {
    tx.objectStore(STORE_META).clear();
    return tx.objectStore(STORE_AUDIO).clear();
  });
}

/** 大きさを「1.7 MB」の形にする */
export function formatCacheBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
