'use client';

/**
 * 天気・ニュース取得API
 * - 天気: Open-Meteo API（無料、APIキー不要）
 * - ニュース: 外部APIは制限があるためRSS/スクレイピングの代替としてWeb検索を使用
 */

// 鳥取市気高町宝木の座標（表示・読み上げ上の地名は「鳥取市」に統一）
const HOUKI_LAT = 35.4833;
const HOUKI_LON = 134.1167;

// 天気コード→日本語
const WMO_WEATHER: Record<number, string> = {
  0: '快晴', 1: '晴れ', 2: 'やや曇り', 3: '曇り',
  45: '霧', 48: '着氷霧',
  51: '弱い霧雨', 53: '霧雨', 55: '強い霧雨',
  61: '弱い雨', 63: '雨', 65: '強い雨',
  66: '着氷性の弱い雨', 67: '着氷性の雨',
  71: '弱い雪', 73: '雪', 75: '大雪',
  77: '霧氷', 80: '弱いにわか雨', 81: 'にわか雨', 82: '強いにわか雨',
  85: '弱いにわか雪', 86: 'にわか雪',
  95: '雷雨', 96: '雷雨（ひょう）', 99: '激しい雷雨',
};

/** 1時間ごとの気温・湿度データ（推移グラフ用） */
export interface WeatherHourPoint {
  hour: number;        // 8..12
  label: string;       // "8時"
  temperature: number;
  humidity: number;
  wbgt: number;        // 暑さ指数（推定）
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  /** データの観測時刻（"HH:MM"）。取得できない場合は空文字 */
  time: string;
  weatherCode: number;
  weatherDesc: string;
  windSpeed: number;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
  /** 暑さ指数 WBGT（気温・湿度からの推定値, ℃） */
  wbgt: number;
  /** 当日 8時〜12時の推移（取得できない場合は空配列） */
  hourly: WeatherHourPoint[];
}

/**
 * 気温(℃)と相対湿度(%)から暑さ指数 WBGT を近似算出する。
 * 日本で広く使われる簡易推定式（小野・登内 2014, 屋内・日陰想定）。
 *   WBGT = 0.567×Ta + 0.393×e + 3.94   （e: 水蒸気圧 hPa）
 */
export function computeWBGT(tempC: number, humidity: number): number {
  const e = (humidity / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  const wbgt = 0.567 * tempC + 0.393 * e + 3.94;
  return Math.round(wbgt * 10) / 10;
}

/** WBGT の警戒レベル（環境省 熱中症予防指針に準拠） */
export function wbgtLevel(wbgt: number): { label: string; color: string } {
  if (wbgt >= 31) return { label: '危険', color: '#dc2626' };
  if (wbgt >= 28) return { label: '厳重警戒', color: '#f97316' };
  if (wbgt >= 25) return { label: '警戒', color: '#f59e0b' };
  if (wbgt >= 21) return { label: '注意', color: '#eab308' };
  return { label: 'ほぼ安全', color: '#22c55e' };
}

export async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${HOUKI_LAT}&longitude=${HOUKI_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Tokyo&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current;
    const daily = data.daily;

    // 当日 8〜12時の推移を抽出
    const hourly: WeatherHourPoint[] = [];
    const h = data.hourly;
    if (h && Array.isArray(h.time)) {
      for (let i = 0; i < h.time.length; i++) {
        const t: string = h.time[i]; // 例: "2026-07-23T08:00"
        const hour = parseInt(t.slice(11, 13), 10);
        if (hour >= 8 && hour <= 12) {
          const tt = Math.round(h.temperature_2m[i] * 10) / 10;
          const hh = Math.round(h.relative_humidity_2m[i]);
          hourly.push({
            hour,
            label: `${hour}時`,
            temperature: tt,
            humidity: hh,
            wbgt: computeWBGT(tt, hh),
          });
        }
      }
    }

    // 観測時刻（current.time は "2026-07-29T09:30" 形式・JST）
    const obsTime = typeof current.time === 'string' && current.time.length >= 16
      ? current.time.slice(11, 16)
      : '';

    return {
      temperature: Math.round(current.temperature_2m * 10) / 10,
      feelsLike: Math.round(current.apparent_temperature * 10) / 10,
      humidity: current.relative_humidity_2m,
      time: obsTime,
      weatherCode: current.weather_code,
      weatherDesc: WMO_WEATHER[current.weather_code] || '不明',
      windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
      maxTemp: Math.round(daily.temperature_2m_max[0] * 10) / 10,
      minTemp: Math.round(daily.temperature_2m_min[0] * 10) / 10,
      precipitationProb: daily.precipitation_probability_max[0] || 0,
      wbgt: computeWBGT(Math.round(current.temperature_2m * 10) / 10, current.relative_humidity_2m),
      hourly,
    };
  } catch {
    return null;
  }
}

/** 気温・湿度・暑さ指数の観測値（気象庁データ / SwitchBot 実測 共通） */
export interface ClimateReading {
  temperature: number;
  humidity: number;
  wbgt: number;
}

/**
 * 気温・湿度・暑さ指数＋警戒レベル（危険/厳重警戒/警戒/注意）のコール文。
 * 「休憩してください」等のアドバイスは読み上げない（数値と警戒レベルのみ）。
 * @param fromSwitchBot SwitchBot の実測値の場合は true（読み上げで実測と区別する）
 */
export function climateToSpeech(r: ClimateReading, fromSwitchBot = false): string {
  const lv = wbgtLevel(r.wbgt).label;
  const head = fromSwitchBot ? '実測の気温' : '現在の気温';
  return `${head}${r.temperature}度、湿度${Math.round(r.humidity)}%、暑さ指数${r.wbgt}、${lv}です。`;
}

/** 本日の予報（最高気温・1日を通した降水確率）のコール文 */
export function forecastToSpeech(w: WeatherData): string {
  return `今日の最高気温は${w.maxTemp}度、降水確率は${w.precipitationProb}%です。`;
}

/**
 * 天気ボタン用コール：現在の気温・湿度・暑さ指数（SwitchBot 接続中は実測値）に加え、
 * その日の最高気温と1日を通した降水確率を読み上げる。
 */
export function weatherToSpeech(w: WeatherData, sb?: ClimateReading | null): string {
  return `${climateToSpeech(sb || w, !!sb)}${forecastToSpeech(w)}`;
}

/** 定期コール等の先頭に付ける気温・湿度・暑さ指数フレーズ（SwitchBot 接続中は実測値） */
export function currentTempToSpeech(w: WeatherData | null, sb?: ClimateReading | null): string {
  const r = sb || w;
  if (!r) return '';
  return climateToSpeech(r, !!sb);
}

/** 気温コール：現地の気温・湿度・暑さ指数＋警戒レベルと予報（SwitchBot 接続中は実測値） */
export function temperatureToSpeech(w: WeatherData, sb?: ClimateReading | null): string {
  const head = sb ? '' : '鳥取市の、';
  return `${head}${climateToSpeech(sb || w, !!sb)}体感${w.feelsLike}度。今日の最高気温は${w.maxTemp}度、最低${w.minTemp}度、降水確率は${w.precipitationProb}%です。`;
}

// ニュース取得（Google News RSS経由）
export interface NewsItem {
  title: string;
  source: string;
}

async function fetchRssNews(query: string, maxItems: number): Promise<NewsItem[]> {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
    // CORSプロキシを使用（allorigins）
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const text = await res.text();

    // 簡易XMLパース
    const items: NewsItem[] = [];
    const itemRegex = /<item>[\s\S]*?<\/item>/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null && items.length < maxItems) {
      const titleMatch = match[0].match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
      const sourceMatch = match[0].match(/<source[^>]*>(.*?)<\/source>/);
      const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
      const source = (sourceMatch?.[1] || '').trim();
      if (title) {
        items.push({ title, source });
      }
    }
    return items;
  } catch {
    return [];
  }
}

export async function fetchTottoriNews(): Promise<string> {
  const items = await fetchRssNews('鳥取市 OR 鳥取県', 5);
  if (items.length === 0) return '鳥取のニュースを取得できませんでした。';

  let text = '鳥取のニュース。';
  for (const item of items.slice(0, 3)) {
    // 30秒以内に収めるため3件に制限、各見出しを短縮
    const shortTitle = item.title.length > 40 ? item.title.substring(0, 40) + '。' : item.title + '。';
    text += shortTitle;
  }
  return text;
}

export async function fetchFinanceNews(): Promise<string> {
  const items = await fetchRssNews('日経平均 OR 株価 OR 為替 OR S&P500', 5);
  if (items.length === 0) return '金融ニュースを取得できませんでした。';

  let text = '金融ニュース。';
  for (const item of items.slice(0, 3)) {
    const shortTitle = item.title.length > 40 ? item.title.substring(0, 40) + '。' : item.title + '。';
    text += shortTitle;
  }
  return text;
}
