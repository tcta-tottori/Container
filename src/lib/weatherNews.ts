'use client';

/**
 * 天気・ニュース取得API
 * - 天気: Open-Meteo API（無料、APIキー不要）
 * - ニュース: 外部APIは制限があるためRSS/スクレイピングの代替としてWeb検索を使用
 */

// 鳥取市気高町宝木の座標
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

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  weatherCode: number;
  weatherDesc: string;
  windSpeed: number;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
}

export async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${HOUKI_LAT}&longitude=${HOUKI_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Tokyo&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current;
    const daily = data.daily;
    return {
      temperature: Math.round(current.temperature_2m * 10) / 10,
      feelsLike: Math.round(current.apparent_temperature * 10) / 10,
      humidity: current.relative_humidity_2m,
      weatherCode: current.weather_code,
      weatherDesc: WMO_WEATHER[current.weather_code] || '不明',
      windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
      maxTemp: Math.round(daily.temperature_2m_max[0] * 10) / 10,
      minTemp: Math.round(daily.temperature_2m_min[0] * 10) / 10,
      precipitationProb: daily.precipitation_probability_max[0] || 0,
    };
  } catch {
    return null;
  }
}

export function weatherToSpeech(w: WeatherData): string {
  let text = `気高町の天気。気温${w.temperature}度、湿度${w.humidity}%、`;
  text += `降水確率${w.precipitationProb}%、風速${w.windSpeed}メートル。`;
  return text;
}

export function temperatureToSpeech(w: WeatherData): string {
  return `宝木の気温。現在${w.temperature}度、体感${w.feelsLike}度。最高${w.maxTemp}度、最低${w.minTemp}度。`;
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
