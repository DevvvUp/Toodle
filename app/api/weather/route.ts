export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DELHI_NODES } from "@/lib/mock-data";

export async function GET() {
  try {
    const lats = DELHI_NODES.map(n => n.lat).join(",");
    const lngs = DELHI_NODES.map(n => n.lng).join(",");

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,weather_code&hourly=precipitation_probability,precipitation&timezone=Asia/Kolkata`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Open-Meteo returned ${res.status}`);
    }

    const data = await res.json();
    const responses = Array.isArray(data) ? data : [data];

    const parsed = DELHI_NODES.map((node, i) => {
      const resp = responses[i] || responses[0];
      const current = resp.current || {};
      const hourly = resp.hourly || { precipitation: [], precipitation_probability: [] };

      // Next 6 hours
      const next6hPrecipMm = (hourly.precipitation || []).slice(0, 6);
      const next6hProb = (hourly.precipitation_probability || []).slice(0, 6);
      const precipProbMax = next6hProb.length > 0 ? Math.max(...next6hProb) : 0;

      return {
        nodeId: node.id,
        tempC: current.temperature_2m || 0,
        humidity: current.relative_humidity_2m || 0,
        rainMmH: current.rain || current.precipitation || 0,
        windKmh: current.wind_speed_10m || 0,
        weatherCode: current.weather_code || 0,
        next6hPrecipMm,
        precipProbMax,
      };
    });

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Weather fetch failed" }, { status: 502 });
  }
}
