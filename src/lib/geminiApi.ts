/**
 * Google Gemini API (Vision) クライアント
 *
 * 画像から構造化データ（コンテナ日程の品目リスト）を抽出する。
 * API キーは localStorage に保存。無料枠（gemini-3.6-flash など）あり。
 *
 * ※ 旧モデル（gemini-2.0-flash / gemini-2.5-flash / gemini-2.5-pro）は
 *   Google 側で提供終了・新規ユーザー利用不可となったため、Gemini 3 系へ移行。
 */

const API_KEY_STORAGE = 'cns_gemini_api_key';
const MODEL_STORAGE = 'cns_gemini_model';

/** デフォルトモデル（最新の高速・高精度モデル。無料枠あり） */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

/** 選択可能なモデル一覧 */
export const GEMINI_MODELS: { id: string; label: string; note: string }[] = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', note: '最新・高速・高精度（推奨）' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', note: '無料枠・軽量・低コスト' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', note: '最高精度・有料' },
];

/**
 * 提供終了した旧モデル ID → 現行モデル ID への移行マップ。
 * localStorage に古いモデルが保存されている端末を自動的に救済する。
 */
const DEPRECATED_MODEL_MIGRATION: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.5-flash': 'gemini-3.6-flash',
  'gemini-2.5-pro': 'gemini-3.1-pro',
  'gemini-1.5-flash': 'gemini-3.6-flash',
  'gemini-1.5-pro': 'gemini-3.1-pro',
};

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

/** File を base64 (data URL のデータ部分) に変換 */
export function fileToBase64(file: File): Promise<string> {
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
3. 数値はカンマ区切り（1,160 など）を取り除いて純粋な数値にすること
4. 品名や代表機種の長音「ー」や中黒「・」などもそのまま保持
5. ヘッダー左上の「4月15日 26K0308」のような情報があれば date (MM-DD) / containerNo として抽出
6. 行数が不明な場合も、表に見える全ての品目行を漏れなく抽出すること

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

  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

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
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API エラー (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  // Gemini のレスポンスから text 部分を抽出
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.output ??
    '';
  if (!text) {
    throw new Error('Gemini のレスポンスが空です');
  }

  let parsed: GeminiResult;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Gemini のレスポンスを JSON としてパースできません: ${(e as Error).message}`);
  }

  // フィールド正規化
  return {
    date: String(parsed.date || ''),
    containerNo: String(parsed.containerNo || ''),
    items: Array.isArray(parsed.items)
      ? parsed.items.map((it) => ({
          partNumber: String(it.partNumber || '').trim(),
          itemName: String(it.itemName || '').trim(),
          representModel: String(it.representModel || '').trim(),
          totalQty: Number(it.totalQty) || 0,
          caseCount: Number(it.caseCount) || 0,
          palletCount: Number(it.palletCount) || 0,
          fraction: Number(it.fraction) || 0,
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
