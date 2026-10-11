import { DELHI_NODES } from './mock-data';

export interface WeatherData {
  nodeId: string | number;
  tempC: number;
  humidity: number;
  rainMmH: number;
  windKmh: number;
  weatherCode: number;
  next6hPrecipMm: number;
  precipProbMax: number;
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,weather_code&hourly=precipitation_probability,precipitation&timezone=auto`;
    
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
      
      const next6hPrecip = Array.isArray(hourly.precipitation)
        ? hourly.precipitation.slice(0, 6).reduce((a: number, b: number) => a + b, 0)
        : 0;
      const precipProbMax = Array.isArray(hourly.precipitation_probability) && hourly.precipitation_probability.length > 0
        ? Math.max(...hourly.precipitation_probability.slice(0, 6))
        : 0;

      return {
        nodeId: node.id,
        tempC: current.temperature_2m ?? 28,
        humidity: current.relative_humidity_2m ?? 60,
        rainMmH: current.rain || current.precipitation || 0,
        windKmh: current.wind_speed_10m ?? 10,
        weatherCode: current.weather_code ?? 0,
        next6hPrecipMm: next6hPrecip,
        precipProbMax: precipProbMax
      };
    });

    batchWeatherCache.set(cacheKey, { timestamp: Date.now(), data });
    return data;
  } catch (error) {
    console.error('Live weather failed:', error);
    return null;
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
}

const userWeatherCache = new Map<string, { timestamp: number; data: UserWeatherData | { error: string } }>();

export async function getWeatherAt(lat: number, lon: number): Promise<UserWeatherData | { error: string }> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = userWeatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,wind_speed_10m,weather_code&hourly=precipitation_probability,precipitation&timezone=auto`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);

    if (!res.ok) return { error: `HTTP ${res.status}` };
    const json = await res.json();
    const current = json.current || {};
    const hourly = json.hourly || {};

    const precipProbMax = Array.isArray(hourly.precipitation_probability) && hourly.precipitation_probability.length > 0
      ? Math.max(...hourly.precipitation_probability.slice(0, 6))
      : 0;

    const data: UserWeatherData = {
      tempC: current.temperature_2m ?? 28,
      feelsLikeC: current.apparent_temperature ?? current.temperature_2m ?? 28,
      humidity: current.relative_humidity_2m ?? 60,
      rainMmH: current.rain || current.precipitation || 0,
      windKmh: current.wind_speed_10m ?? 10,
      weatherCode: current.weather_code ?? 0,
      precipProbMax
    };

    userWeatherCache.set(key, { timestamp: Date.now(), data });
    return data;
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}
