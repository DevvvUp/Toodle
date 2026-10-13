import { DELHI_NODES } from './mock-data';

export const RECENT_RAIN_WINDOW_HOURS = 3;
export const RECENT_RAIN_24H_DIVISOR = 6;

export function getRRateFromWeather(rainMmH: number): number {
  if (rainMmH <= 0) return 0.0;
  if (rainMmH <= 2.5) return (rainMmH / 2.5) * 0.35;
  if (rainMmH <= 7.5) return 0.35 + ((rainMmH - 2.5) / 5) * 0.3;
  if (rainMmH <= 15) return 0.65 + ((rainMmH - 7.5) / 7.5) * 0.2;
  if (rainMmH <= 30) return 0.85 + ((rainMmH - 15) / 15) * 0.15;
  return 1.0;
}

export interface WeatherData {
  nodeId: string | number;
  tempC: number;
  humidity: number;
  rainMmH: number;
  windKmh: number;
  weatherCode: number;
  next6hPrecipMm: number;
  precipProbMax: number;
  last1hMm: number;
  last3hMm: number;
  last6hMm: number;
  last24hMm: number;
  peakLast6hMmH: number;
  peakLast3hMmH: number;
  effectiveRainMmH: number;
  rRate: number;
}

export function computeRainMetrics(current: any, hourly: any) {
  const curTime = current?.time;
  const times: string[] = Array.isArray(hourly?.time) ? hourly.time : [];
  const precip: number[] = Array.isArray(hourly?.precipitation) ? hourly.precipitation : [];
  const prob: number[] = Array.isArray(hourly?.precipitation_probability) ? hourly.precipitation_probability : [];

  let curIdx = times.findIndex(t => t === curTime);
  if (curIdx === -1) {
    curIdx = Math.max(0, times.length - 6);
  }

  const getSlice = (hoursBack: number) => {
    const start = Math.max(0, curIdx - (hoursBack - 1));
    const end = curIdx + 1;
    return precip.slice(start, end).map(v => (typeof v === 'number' && !isNaN(v)) ? v : 0);
  };

  const slice1h = getSlice(1);
  const slice3h = getSlice(3);
  const slice6h = getSlice(6);
  const slice24h = getSlice(24);

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const max = (arr: number[]) => (arr.length > 0 ? Math.max(...arr) : 0);

  const last1hMm = Number(sum(slice1h).toFixed(2));
  const last3hMm = Number(sum(slice3h).toFixed(2));
  const last6hMm = Number(sum(slice6h).toFixed(2));
  const last24hMm = Number(sum(slice24h).toFixed(2));

  const peakLast3hMmH = Number(max(slice3h).toFixed(2));
  const peakLast6hMmH = Number(max(slice6h).toFixed(2));

  // Next 6 hours
  const nextSlicePrecip = precip.slice(curIdx + 1, curIdx + 7).map(v => (typeof v === 'number' && !isNaN(v)) ? v : 0);
  const nextSliceProb = prob.slice(curIdx + 1, curIdx + 7).map(v => (typeof v === 'number' && !isNaN(v)) ? v : 0);

  const next6hPrecipMm = Number(sum(nextSlicePrecip).toFixed(2));
  const precipProbMax = nextSliceProb.length > 0 ? Math.max(...nextSliceProb) : 0;

  const currentRain = typeof current?.rain === 'number'
    ? current.rain
    : typeof current?.precipitation === 'number'
      ? current.precipitation
      : 0;

  const effectiveRainMmH = Number(Math.max(
    currentRain,
    peakLast3hMmH,
    last24hMm / RECENT_RAIN_24H_DIVISOR
  ).toFixed(2));

  const rRate = getRRateFromWeather(effectiveRainMmH);

  return {
    last1hMm,
    last3hMm,
    last6hMm,
    last24hMm,
    peakLast3hMmH,
    peakLast6hMmH,
    next6hPrecipMm,
    precipProbMax,
    effectiveRainMmH,
    rRate
  };
}

const batchWeatherCache = new Map<string, { timestamp: number; data: WeatherData[] }>();

export async function fetchLiveWeather(
  nodes?: { id: string | number; lat: number; lng: number }[]
): Promise<WeatherData[] | null> {
  const targetNodes = nodes && nodes.length > 0 ? nodes : DELHI_NODES;
  const cacheKey = targetNodes.map(n => `${n.id}:${Number(n.lat).toFixed(2)},${Number(n.lng).toFixed(2)}`).join(';');
  const cached = batchWeatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.data;
  }

  try {
    const lats = targetNodes.map(n => Number(n.lat).toFixed(4)).join(',');
    const lngs = targetNodes.map(n => Number(n.lng).toFixed(4)).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&past_hours=24&forecast_hours=6&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,wind_speed_10m,weather_code&hourly=precipitation,precipitation_probability&timezone=auto`;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    
    if (!res.ok) throw new Error('Weather API error');
    const json = await res.json();
    
    const isArray = Array.isArray(json);
    const results = isArray ? json : [json];
    
    const data: WeatherData[] = targetNodes.map((node, i) => {
      const nodeWeather = results[i] || results[0] || {};
      const current = nodeWeather.current || {};
      const hourly = nodeWeather.hourly || {};
      
      const metrics = computeRainMetrics(current, hourly);

      return {
        nodeId: node.id,
        tempC: current.temperature_2m ?? 28,
        humidity: current.relative_humidity_2m ?? 60,
        rainMmH: current.rain || current.precipitation || 0,
        windKmh: current.wind_speed_10m ?? 10,
        weatherCode: current.weather_code ?? 0,
        next6hPrecipMm: metrics.next6hPrecipMm,
        precipProbMax: metrics.precipProbMax,
        last1hMm: metrics.last1hMm,
        last3hMm: metrics.last3hMm,
        last6hMm: metrics.last6hMm,
        last24hMm: metrics.last24hMm,
        peakLast6hMmH: metrics.peakLast6hMmH,
        peakLast3hMmH: metrics.peakLast3hMmH,
        effectiveRainMmH: metrics.effectiveRainMmH,
        rRate: metrics.rRate,
      };
    });

    batchWeatherCache.set(cacheKey, { timestamp: Date.now(), data });
    return data;
  } catch (error) {
    console.error('Live weather failed:', error);
    return null; // Return null on failure so UI keeps simulator
  }
}

export interface UserWeatherData {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  rainMmH: number;
  windKmh: number;
  weatherCode: number;
  precipProbMax: number;
  next6hPrecipMm: number;
  last1hMm: number;
  last3hMm: number;
  last6hMm: number;
  last24hMm: number;
  peakLast6hMmH: number;
  peakLast3hMmH: number;
  effectiveRainMmH: number;
  rRate: number;
  source: string;
}

const userWeatherCache = new Map<string, { timestamp: number, data: UserWeatherData | { error: string } }>();

export async function getWeatherAt(lat: number, lon: number): Promise<UserWeatherData | { error: string }> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = userWeatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.data;
  }

  try {
    const bestUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&past_hours=24&forecast_hours=6&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,wind_speed_10m,weather_code&hourly=precipitation,precipitation_probability&timezone=auto`;
    const gfsUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&past_hours=24&forecast_hours=6&models=gfs_seamless&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,wind_speed_10m,weather_code&hourly=precipitation,precipitation_probability&timezone=auto`;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);

    const [bestRes, gfsRes] = await Promise.allSettled([
      fetch(bestUrl, { signal: controller.signal }),
      fetch(gfsUrl, { signal: controller.signal })
    ]);
    clearTimeout(id);

    let bestJson: any = null;
    let gfsJson: any = null;

    if (bestRes.status === 'fulfilled' && bestRes.value.ok) {
      bestJson = await bestRes.value.json();
    }
    if (gfsRes.status === 'fulfilled' && gfsRes.value.ok) {
      gfsJson = await gfsRes.value.json();
    }

    if (!bestJson && !gfsJson) {
      return { error: 'Weather API error' };
    }

    const primaryJson = bestJson || gfsJson;
    const current = primaryJson.current || {};
    const bestMetrics = bestJson ? computeRainMetrics(bestJson.current, bestJson.hourly) : null;
    const gfsMetrics = gfsJson ? computeRainMetrics(gfsJson.current, gfsJson.hourly) : null;

    const last1hMm = Number(Math.max(bestMetrics?.last1hMm ?? 0, gfsMetrics?.last1hMm ?? 0).toFixed(2));
    const last3hMm = Number(Math.max(bestMetrics?.last3hMm ?? 0, gfsMetrics?.last3hMm ?? 0).toFixed(2));
    const last6hMm = Number(Math.max(bestMetrics?.last6hMm ?? 0, gfsMetrics?.last6hMm ?? 0).toFixed(2));
    const last24hMm = Number(Math.max(bestMetrics?.last24hMm ?? 0, gfsMetrics?.last24hMm ?? 0).toFixed(2));
    const peakLast3hMmH = Number(Math.max(bestMetrics?.peakLast3hMmH ?? 0, gfsMetrics?.peakLast3hMmH ?? 0).toFixed(2));
    const peakLast6hMmH = Number(Math.max(bestMetrics?.peakLast6hMmH ?? 0, gfsMetrics?.peakLast6hMmH ?? 0).toFixed(2));
    const next6hPrecipMm = Number(Math.max(bestMetrics?.next6hPrecipMm ?? 0, gfsMetrics?.next6hPrecipMm ?? 0).toFixed(2));
    const precipProbMax = Math.max(bestMetrics?.precipProbMax ?? 0, gfsMetrics?.precipProbMax ?? 0);

    const bestRain = typeof bestJson?.current?.rain === 'number'
      ? bestJson.current.rain
      : typeof bestJson?.current?.precipitation === 'number'
        ? bestJson.current.precipitation
        : 0;
    const gfsRain = typeof gfsJson?.current?.rain === 'number'
      ? gfsJson.current.rain
      : typeof gfsJson?.current?.precipitation === 'number'
        ? gfsJson.current.precipitation
        : 0;

    const rainMmH = Number(Math.max(bestRain, gfsRain).toFixed(2));

    const effectiveRainMmH = Number(Math.max(
      rainMmH,
      peakLast3hMmH,
      last24hMm / RECENT_RAIN_24H_DIVISOR
    ).toFixed(2));

    const rRate = getRRateFromWeather(effectiveRainMmH);

    const data: UserWeatherData = {
      tempC: current.temperature_2m ?? 28,
      feelsLikeC: current.apparent_temperature ?? current.temperature_2m ?? 28,
      humidity: current.relative_humidity_2m ?? 60,
      rainMmH,
      windKmh: current.wind_speed_10m ?? 10,
      weatherCode: current.weather_code ?? 0,
      precipProbMax,
      next6hPrecipMm,
      last1hMm,
      last3hMm,
      last6hMm,
      last24hMm,
      peakLast6hMmH,
      peakLast3hMmH,
      effectiveRainMmH,
      rRate,
      source: 'Open-Meteo (best match + GFS)'
    };

    userWeatherCache.set(key, { timestamp: Date.now(), data });
    return data;
  } catch (error: any) {
    return { error: error?.message || 'Network error' };
  }
}

