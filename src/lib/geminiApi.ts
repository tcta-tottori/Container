/**
 * Google Gemini API (Vision) クライアント
 *
 * 画像から構造化データ（コンテナ日程の品目リスト）を抽出する。
 * API キーは localStorage に保存。無料枠（gemini-3.8-flash など）あり。
 *
 * ※ 旧モデル（gemini-2.x / gemini-3.5-flash / gemini-3.7-flash）は提供終了・置き換え済み。
 *   保存済みの古いモデルは自動で現行モデルへ移し、モデルが見つからない・混雑のときは
 *   別のモデルで自動的にやり直す。
 */

import { prepareImageForVision } from './imagePrep';

const API_KEY_STORAGE = 'cns_gemini_api_key';
const MODEL_STORAGE = 'cns_gemini_model';

/** デフォルトモデル（最新の高速・高精度モデル。無料枠あり） */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/** 選択可能なモデル一覧 */
export const GEMINI_MODELS: { id: string; label: string; note: string }[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', note: '最新・高速・高精度（推奨）' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', note: '無料枠・軽量・低コスト' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', note: '最高精度・有料' },
];

/**
 * 提供終了した旧モデル ID → 現行モデル ID への移行マップ。
 * localStorage に古いモデルが保存されている端末を自動的に救済する。
 */
const DEPRECATED_MODEL_MIGRATION: Record<string, string> = {
  'gemini-2.0-flash': DEFAULT_GEMINI_MODEL,
  'gemini-2.5-flash': DEFAULT_GEMINI_MODEL,
  'gemini-2.5-pro': 'gemini-3.1-pro-preview',
  'gemini-1.5-flash': DEFAULT_GEMINI_MODEL,
  'gemini-1.5-pro': 'gemini-3.1-pro-preview',
  'gemini-3.5-flash': DEFAULT_GEMINI_MODEL,
  'gemini-3.6-flash': DEFAULT_GEMINI_MODEL,
  'gemini-3.7-flash': DEFAULT_GEMINI_MODEL,
  'gemini-3.1-pro': 'gemini-3.1-pro-preview',
};

/** 指定モデルが使えないときに順に試すモデル */
const FALLBACK_MODELS = [DEFAULT_GEMINI_MODEL, 'gemini-3.5-flash-lite'];

export function getGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

export function clearGeminiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(API_KEY_STORAGE);
}

export function getGeminiModel(): string {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_MODEL;
  const stored = localStorage.getItem(MODEL_STORAGE);
  if (!stored) return DEFAULT_GEMINI_MODEL;
  // 提供終了した旧モデルが保存されていれば現行モデルへ移行して保存し直す
  const migrated = DEPRECATED_MODEL_MIGRATION[stored];
  if (migrated) {
    localStorage.setItem(MODEL_STORAGE, migrated);
    return migrated;
  }
  return stored;
}

export function setGeminiModel(model: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODEL_STORAGE, model);
}

/** File / Blob を base64 (data URL のデータ部分) に変換 */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader result is not a string'));
        return;
      }
      // "data:image/jpeg;base64,XXXX" → "XXXX"
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** コンテナ日程表から抽出する JSON スキーマ */
const CONTAINER_SCHEMA = {
  type: 'object',
  properties: {
    date: {
      type: 'string',
      description: '画像上部の日付（MM-DD 形式、例: "04-15"）。見つからなければ空文字。',
    },
    containerNo: {
      type: 'string',
      description: 'コンテナ番号（例: "26K0308"）。見つからなければ空文字。',
    },
    items: {
      type: 'array',
      description: '表の各行から抽出した品目リスト。表ヘッダー行は除く。',
      items: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: '品番（例: "3TG394A10121"）。英数字のみ。',
          },
          itemName: {
            type: 'string',
            description: '品名（例: "JRI-G180KKBポリカバー"）。',
          },
          representModel: {
            type: 'string',
            description: '代表機種（例: "JRI-G180KKB"）。',
          },
          totalQty: {
            type: 'number',
            description: '入荷数量（数値）。空欄は 0。',
          },
          caseCount: {
            type: 'number',
            description: 'ケース数（数値）。空欄は 0。',
          },
          palletCount: {
            type: 'number',
            description: 'パレット枚数（数値）。空欄や「-」は 0。',
          },
          fraction: {
            type: 'number',
            description: '端数（数値）。空欄は 0。',
          },
        },
        required: ['partNumber', 'itemName', 'representModel', 'totalQty', 'caseCount', 'palletCount', 'fraction'],
      },
    },
  },
  required: ['date', 'containerNo', 'items'],
};

const PROMPT = `この画像はコンテナ日程の一覧表です。表の各行から以下を正確に抽出してください。

【抽出する列】
- 品番（例: 3TG394A10121）— A列・英数字
- 品名（例: JRI-G180KKBポリカバー）— B列
- 代表機種（例: JRI-G180KKB）— C列
- 入荷数量 — 数値
- ケース数 — 数値
- パレット枚数 — 数値（空欄・ハイフン・空白は 0）
- 端数 — 数値

【注意事項】
1. 表ヘッダー行（「品番」「品名」等の文字がある行）は **含めないこと**
2. 画像の光沢・影・磁石などで一部が見えなくても、表構造を文脈理解で補完すること
   （写真が斜め・横向き・逆さまでも、表として読み取ること）
3. 数値はカンマ区切り（1,160 など）を取り除いて純粋な数値にすること
4. 品名や代表機種の長音「ー」や中黒「・」などもそのまま保持
5. ヘッダー左上の「4月15日 26K0308」のような情報があれば date (MM-DD) / containerNo として抽出
6. 行数が不明な場合も、表に見える全ての品目行を漏れなく抽出すること
7. 品番は英大文字と数字のみ。O と 0、I と 1、S と 5、B と 8 の取り違えに注意すること
8. 合計行・空行・手書きのメモ書きは品目に含めないこと

指定された JSON スキーマに厳密に従って出力してください。`;

export interface GeminiItem {
  partNumber: string;
  itemName: string;
  representModel: string;
  totalQty: number;
  caseCount: number;
  palletCount: number;
  fraction: number;
}

export interface GeminiResult {
  date: string;
  containerNo: string;
  items: GeminiItem[];
}

/** Gemini のレスポンスから本文テキストを取り出す（思考パートは除外し、全パートを連結） */
function extractResponseText(data: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cand = (data as any)?.candidates?.[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = Array.isArray(cand?.content?.parts) ? cand.content.parts : [];
  const text = parts
    .filter((p) => typeof p?.text === 'string' && !p.thought)
    .map((p) => p.text as string)
    .join('');
  return text || (typeof cand?.output === 'string' ? cand.output : '');
}

/** ```json ... ``` で囲まれていたり前後に説明文が付いていても JSON を取り出してパースする */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try { return JSON.parse(fenced[1]); } catch { /* 次へ */ }
    }
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
    throw new Error('JSON が見つかりません');
  }
}

/** "1,160" や "-" などを数値に */
function toNumber(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s]/g, '');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

/** 品番の正規化: 全角→半角、大文字、空白・記号除去 */
function normalizePartNumber(v: unknown): string {
  return String(v ?? '')
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

class GeminiHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  base64: string,
  mimeType: string,
  signal?: AbortSignal,
  highRes = true,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: CONTAINER_SCHEMA,
      // 表の細かい文字を読むため高解像度で解析させる
      ...(highRes ? { mediaResolution: 'MEDIA_RESOLUTION_HIGH' } : {}),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new GeminiHttpError(res.status, `Gemini API エラー (${model} / ${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = extractResponseText(data);
  if (!text) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reason = (data as any)?.candidates?.[0]?.finishReason || (data as any)?.promptFeedback?.blockReason || '';
    throw new Error(`Gemini のレスポンスが空です${reason ? ` (${reason})` : ''}`);
  }
  return text;
}

/** 別のモデルでやり直す価値があるエラーか（モデルなし・混雑・一時障害） */
function isRetryableWithOtherModel(e: unknown): boolean {
  if (!(e instanceof GeminiHttpError)) return false;
  if (e.status === 404 || e.status === 429 || e.status >= 500) return true;
  // 400 でもモデル名が原因のもの
  return e.status === 400 && /model|not found|not supported/i.test(e.message);
}

/**
 * 画像を Gemini に送信して構造化データを取得する
 */
export async function geminiExtractContainer(
  file: File,
  options?: { apiKey?: string; model?: string; signal?: AbortSignal },
): Promise<GeminiResult> {
  const apiKey = options?.apiKey || getGeminiKey();
  if (!apiKey) throw new Error('Gemini API キーが設定されていません');

  const model = options?.model || getGeminiModel();

  // 大きすぎる写真・回転した写真を整えてから送る（HEIC 等で変換できなければ原本）
  const prepared = await prepareImageForVision(file);
  const base64 = await fileToBase64(prepared);
  const mimeType = prepared.type || file.type || 'image/jpeg';

  const models = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let text = '';
  let lastError: unknown = null;
  for (const m of models) {
    try {
      try {
        text = await callGemini(apiKey, m, base64, mimeType, options?.signal);
      } catch (e) {
        // 高解像度指定に未対応のモデルなら指定なしでやり直す
        if (e instanceof GeminiHttpError && e.status === 400 && /media_?resolution/i.test(e.message)) {
          text = await callGemini(apiKey, m, base64, mimeType, options?.signal, false);
        } else {
          throw e;
        }
      }
      break;
    } catch (e) {
      lastError = e;
      if (options?.signal?.aborted || !isRetryableWithOtherModel(e)) throw e;
    }
  }
  if (!text) throw lastError instanceof Error ? lastError : new Error(String(lastError));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = parseJsonLoose(text);
  } catch (e) {
    throw new Error(`Gemini のレスポンスを JSON としてパースできません: ${(e as Error).message}`);
  }

  // フィールド正規化
  return {
    date: String(parsed?.date || ''),
    containerNo: String(parsed?.containerNo || '').trim(),
    items: Array.isArray(parsed?.items)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed.items.map((it: any) => ({
          partNumber: normalizePartNumber(it?.partNumber),
          itemName: String(it?.itemName || '').trim(),
          representModel: String(it?.representModel || '').trim(),
          totalQty: toNumber(it?.totalQty),
          caseCount: toNumber(it?.caseCount),
          palletCount: toNumber(it?.palletCount),
          fraction: toNumber(it?.fraction),
        }))
      : [],
  };
}

/** API キーが有効かを軽く検証（軽量なテキスト生成） */
export async function verifyGeminiKey(apiKey: string, model = DEFAULT_GEMINI_MODEL): Promise<boolean> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 5, temperature: 0 },
    }),
  });
  return res.ok;
}
