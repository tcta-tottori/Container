'use client';

/**
 * 天気・ニュース取得API
 * - 天気: 気象庁（JMA）公開JSON（鳥取県予報、東部エリア）
 * - ニュース: Google News RSS（allorigins経由）
 */

// 鳥取県の予報区コード
const TOTTORI_PREF_CODE = '310000';
// 鳥取県 東部（鳥取市を含む細分区域）
const EAST_TOTTORI_CODE = '310010';
// 気温観測点: 鳥取
const TOTTORI_TEMP_CODE = '31312';

export interface WeatherData {
  weatherDesc: string;
  maxTemp: number | null;
  minTemp: number | null;
  precipitationProb: number;
}

interface JmaArea {
  area: { name: string; code: string };
  weathers?: string[];
  weatherCodes?: string[];
  pops?: string[];
  temps?: string[];
}

interface JmaTimeSeries {
  timeDefines: string[];
  areas: JmaArea[];
}

interface JmaForecast {
  reportDatetime: string;
  timeSeries: JmaTimeSeries[];
}

export async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const url = `https://www.jma.go.jp/bosai/forecast/data/forecast/${TOTTORI_PREF_CODE}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as JmaForecast[];
    const today = data[0];
    if (!today || !today.timeSeries) return null;

    const todayDateStr = today.reportDatetime.substring(0, 10);

    // 天気概況（鳥取県東部・今日）
    const weatherSeries = today.timeSeries[0];
    const weatherArea = weatherSeries?.areas.find(a => a.area.code === EAST_TOTTORI_CODE);
    const rawDesc = weatherArea?.weathers?.[0] ?? '';
    const weatherDesc = rawDesc.replace(/[\s　]+/g, '') || '不明';

    // 降水確率（鳥取県東部・今日の最大値）
    const popSeries = today.timeSeries[1];
    const popArea = popSeries?.areas.find(a => a.area.code === EAST_TOTTORI_CODE);
    let maxPop = 0;
    popSeries?.timeDefines.forEach((t, i) => {
      if (t.substring(0, 10) !== todayDateStr) return;
      const raw = popArea?.pops?.[i] ?? '';
      const pop = parseInt(raw, 10);
      if (!isNaN(pop) && pop > maxPop) maxPop = pop;
    });

    // 気温（鳥取観測点・今日）
    const tempSeries = today.timeSeries[2];
    const tempArea = tempSeries?.areas.find(a => a.area.code === TOTTORI_TEMP_CODE);
    const todayTemps: number[] = [];
    tempSeries?.timeDefines.forEach((t, i) => {
      if (t.substring(0, 10) !== todayDateStr) return;
      const n = parseFloat(tempArea?.temps?.[i] ?? '');
      if (!isNaN(n)) todayTemps.push(n);
    });
    const maxTemp = todayTemps.length > 0 ? Math.max(...todayTemps) : null;
    const minTemp = todayTemps.length > 0 ? Math.min(...todayTemps) : null;

    return {
      weatherDesc,
      maxTemp,
      minTemp,
      precipitationProb: maxPop,
    };
  } catch {
    return null;
  }
}

function tempRangeText(w: WeatherData): string {
  if (w.maxTemp !== null && w.minTemp !== null && w.maxTemp !== w.minTemp) {
    return `最高${w.maxTemp}度、最低${w.minTemp}度。`;
  }
  if (w.maxTemp !== null) return `最高${w.maxTemp}度。`;
  if (w.minTemp !== null) return `最低${w.minTemp}度。`;
  return '';
}

export function weatherToSpeech(w: WeatherData): string {
  let text = `鳥取県東部の天気。${w.weatherDesc}。`;
  text += tempRangeText(w);
  text += `降水確率${w.precipitationProb}%。`;
  return text;
}

export function temperatureToSpeech(w: WeatherData): string {
  const range = tempRangeText(w);
  if (!range) return '鳥取の気温情報を取得できませんでした。';
  return `鳥取の気温。${range}`;
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
