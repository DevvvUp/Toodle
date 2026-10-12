"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { MobileShell } from "@/components/mobile-shell";
import { useSimulatorStore } from "@/store/simulator-store";
import { fetchNodes, normalizeNodes, CalculatedNode, FloodNode } from "@/lib/api";
import { fetchLiveWeather, getWeatherAt, WeatherData, UserWeatherData } from "@/lib/weather";
import { calculateFRI } from "@/lib/fri";
import { NodeSheet } from "@/components/node-sheet";
import { SmsPreviewModal } from "@/components/sms-preview-modal";
import { AnimatedNumber } from "@/components/animated-number";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CloudRain,
  Droplets,
  Wind,
  Thermometer,
  Layers,
  MapPin,
  AlertTriangle,
  Play,
  Pause,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// Dynamic import of Leaflet map to prevent SSR issues
const ToodleMap = dynamic(() => import("@/components/toodle-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#141414] flex flex-col items-center justify-center text-[#999999] border border-[#262626] rounded-[20px]">
      <Loader2 className="w-6 h-6 animate-spin mb-2" />
      <span className="text-xs">Loading map...</span>
    </div>
  ),
});

function getDistanceAndBearing(
  userLat: number,
  userLng: number,
  nodeLat: number,
  nodeLng: number
): { distanceKm: number; bearing: string } {
  const R = 6371;
  const dLat = ((nodeLat - userLat) * Math.PI) / 180;
  const dLon = ((nodeLng - userLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((userLat * Math.PI) / 180) *
      Math.cos((nodeLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;

  const phi1 = (userLat * Math.PI) / 180;
  const phi2 = (nodeLat * Math.PI) / 180;
  const deltaLambda = ((nodeLng - userLng) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  deg = (deg + 360) % 360;
  const sectors = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const bearing = sectors[Math.round(deg / 45) % 8];

  return { distanceKm: Math.round(dist * 10) / 10, bearing };
}

const PRESETS = ["Clear", "Moderate", "Choke", "Storm"] as const;

export default function CommandCenterPage() {
  const {
    liveMode,
    rainMmH,
    setRainMmH,
    chokeMultiplier,
    setChokeMultiplier,
    liveWeatherMode,
    setLiveWeatherMode,
    fieldReports,
  } = useSimulatorStore();

  const [nodes, setNodes] = useState<FloodNode[]>(() => normalizeNodes([]));
  const [isSatellite, setIsSatellite] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [radarUrl, setRadarUrl] = useState<string | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CalculatedNode | null>(null);
  const [smsModalNode, setSmsModalNode] = useState<CalculatedNode | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(null);
  const [userWeather, setUserWeather] = useState<UserWeatherData | null>(null);
  const [userPlaceName, setUserPlaceName] = useState<string>("");
  const [locationError, setLocationError] = useState<string>("");

  // Play Storm Sequence state
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<string>("Clear");
  const sequenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadNodes();
    loadRadar();
    requestUserLocation();
  }, []);

  useEffect(() => {
    if (liveWeatherMode) {
      setWeatherLoading(true);
      fetchLiveWeather(nodes.length > 0 ? nodes : undefined)
        .then((data) => {
          if (data) {
            setWeatherData(data);
          } else {
            setLiveWeatherMode(false);
            toast.error("Could not fetch live weather; reverted to simulation");
          }
        })
        .finally(() => setWeatherLoading(false));
    }
  }, [liveWeatherMode, nodes, setLiveWeatherMode]);

  const applySimulator = useCallback(
    (type: string) => {
      setCurrentPreset(type);
      if (type === "Clear") {
        setRainMmH(0);
        setChokeMultiplier(1.0);
      } else if (type === "Moderate") {
        setRainMmH(15);
        setChokeMultiplier(1.2);
      } else if (type === "Choke") {
        setRainMmH(25);
        setChokeMultiplier(2.0);
      } else if (type === "Storm") {
        setRainMmH(45);
        setChokeMultiplier(2.5);
      }
    },
    [setRainMmH, setChokeMultiplier]
  );

  // Storm Sequence Auto-tick loop
  useEffect(() => {
    if (isPlayingSequence && !liveWeatherMode) {
      sequenceTimerRef.current = setInterval(() => {
        setCurrentPreset((prev) => {
          const idx = PRESETS.indexOf(prev as (typeof PRESETS)[number]);
          const next = PRESETS[(idx + 1) % PRESETS.length];
          applySimulator(next);
          return next;
        });
      }, 3500);
    } else {
      if (sequenceTimerRef.current) clearInterval(sequenceTimerRef.current);
    }
    return () => {
      if (sequenceTimerRef.current) clearInterval(sequenceTimerRef.current);
    };
  }, [isPlayingSequence, liveWeatherMode, applySimulator]);

  const requestUserLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        setUserLocation({ lat, lng, accuracy });
        setUserPlaceName(`${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`);

        const weather = await getWeatherAt(lat, lng);
        if (!("error" in weather)) {
          setUserWeather(weather);
        }
      },
      (err) => {
        console.warn("Location error:", err);
        setLocationError("Location permission denied. Showing Delhi NCR center.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const loadNodes = async () => {
    try {
      const { data } = await fetchNodes();
      setNodes(Array.isArray(data) && data.length > 0 ? data : normalizeNodes([]));
    } catch {
      setNodes(normalizeNodes([]));
    }
  };

  const loadRadar = async () => {
    try {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      const data = await res.json();
      if (data && data.host && data.radar?.past?.length > 0) {
        const path = data.radar.past[data.radar.past.length - 1].path;
        setRadarUrl(`${data.host}${path}/256/{z}/{x}/{y}/2/1_1.png`);
      }
    } catch {
      // quiet fallback
    }
  };

  const getRRateFromWeather = (rain: number) => {
    if (rain === 0) return 0.0;
    if (rain <= 2.5) return (rain / 2.5) * 0.35;
    if (rain <= 7.5) return 0.35 + ((rain - 2.5) / 5) * 0.3;
    if (rain <= 15) return 0.65 + ((rain - 7.5) / 7.5) * 0.2;
    if (rain <= 30) return 0.85 + ((rain - 15) / 15) * 0.15;
    return 1.0;
  };

  const nearestNodeId = useMemo(() => {
    if (!userLocation || nodes.length === 0) return null;
    let nearest = nodes[0];
    let minDist = Infinity;
    for (const n of nodes) {
      const dist = Math.hypot(n.lat - userLocation.lat, n.lng - userLocation.lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = n;
      }
    }
    return nearest.id;
  }, [userLocation, nodes]);

  const calculatedNodes: CalculatedNode[] = useMemo(() => {
    return nodes
      .map((n) => {
        let distanceKm: number | undefined;
        let bearing: string | undefined;
        if (userLocation) {
          const db = getDistanceAndBearing(
            userLocation.lat,
            userLocation.lng,
            n.lat,
            n.lng
          );
          distanceKm = db.distanceKm;
          bearing = db.bearing;
        }

        if (liveMode) {
          return {
            ...n,
            distanceKm,
            bearing,
            fri: typeof n.fri === "number" ? n.fri : 0.2,
          };
        }

        let currentRRate = 0;
        let nodeWeather: Partial<WeatherData & UserWeatherData> | null = null;

        if (liveWeatherMode && weatherData.length > 0) {
          const matchedWeather = weatherData.find((w) => String(w.nodeId) === String(n.id));
          nodeWeather = matchedWeather ? { ...matchedWeather } : null;
          if (userWeather && String(n.id) === String(nearestNodeId)) {
            currentRRate = userWeather.rRate ?? getRRateFromWeather(userWeather.effectiveRainMmH ?? userWeather.rainMmH);
            nodeWeather = {
              ...(nodeWeather || {}),
              ...userWeather,
            };
          } else {
            currentRRate = nodeWeather?.rRate ?? getRRateFromWeather(Number(nodeWeather?.effectiveRainMmH ?? nodeWeather?.rainMmH) || 0);
          }
        } else {
          currentRRate = rainMmH > 30 ? 1.0 : rainMmH / 30;
        }

        const vPool =
          typeof n.base_vPooling === "number" ? n.base_vPooling : 0.25;
        const aImp =
          typeof n.base_aImpedance === "number" ? n.base_aImpedance : 0.3;
        const result = calculateFRI(
          vPool * chokeMultiplier,
          aImp * chokeMultiplier,
          currentRRate
        );

        return {
          ...n,
          distanceKm,
          bearing,
          fri: result.score,
          localWeather: nodeWeather,
        };
      })
      .sort((a, b) => b.fri - a.fri);
  }, [
    nodes,
    userLocation,
    liveMode,
    liveWeatherMode,
    weatherData,
    userWeather,
    nearestNodeId,
    rainMmH,
    chokeMultiplier,
  ]);

  const topNodeWeather = calculatedNodes[0]?.localWeather as
    | { tempC?: number; rainMmH?: number; windKmh?: number; precipProbMax?: number }
    | undefined;

  const weatherBadge = liveWeatherMode
    ? `LIVE · Open-Meteo${userPlaceName ? " · " + userPlaceName : ""}`
    : "SIMULATION";

  // Critical banner detection: find first node crossing FRI >= 0.86
  const criticalNode = useMemo(() => {
    return calculatedNodes.find((n) => n.fri >= 0.86) || null;
  }, [calculatedNodes]);

  return (
    <MobileShell wideContainer={true}>
      <div className="flex flex-col flex-1 pb-6 w-full">
        {/* Full-Width Critical Banner */}
        <AnimatePresence>
          {criticalNode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full bg-[#7f1d1d] border-b border-[#ef4444] px-4 py-2.5 flex items-center justify-between text-white z-40"
            >
              <div className="flex items-center gap-2 min-w-0 mr-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-ping shrink-0" />
                <span className="text-[11px] sm:text-[12px] font-bold tracking-tight truncate">
                  CRITICAL ALERT: {criticalNode.name} (FRI:{" "}
                  <AnimatedNumber value={criticalNode.fri} className="font-mono tabular-nums" />)
                </span>
              </div>
              <button
                onClick={() => setSmsModalNode(criticalNode)}
                className="bg-[#ef4444] hover:bg-[#dc2626] text-white text-[10px] sm:text-[11px] font-bold px-3 py-1.5 rounded-full shrink-0 flex items-center gap-1 transition min-h-[36px]"
              >
                <span>View Alert</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Responsive Layout Grid (1-column on mobile/tablet, 2-column on desktop) */}
        <div className="w-full flex flex-col lg:grid lg:grid-cols-[420px_1fr] lg:gap-6 lg:items-start p-3 sm:p-4 lg:p-6 pb-6">
          {/* Column A / Top Mobile: Header, Mode Toggle, Simulation Presets */}
          <div className="order-1 lg:col-start-1 lg:row-start-1 flex flex-col gap-3 sm:gap-4 w-full">
            {/* Header */}
            <header className="flex items-center justify-between px-3 sm:px-4 py-3 border border-[#262626] rounded-[16px] sm:rounded-[20px] bg-[#090909] min-w-0 w-full shadow-sm">
              <div className="flex items-center gap-2 min-w-0 mr-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0" />
                <h1 className="text-[14px] sm:text-[16px] font-bold text-white tracking-[-0.5px] truncate">
                  Command Center
                </h1>
              </div>
              <div className="text-[10px] sm:text-[11px] font-mono text-[#999999] tracking-[-0.1px] shrink-0 whitespace-nowrap bg-[#141414] border border-[#262626] px-2.5 py-1 rounded-full">
                {weatherBadge}
              </div>
            </header>

            {/* Mode Toggle Row */}
            <div className="w-full">
              <div className="flex p-1 bg-[#141414] border border-[#262626] rounded-full">
                <button
                  onClick={() => {
                    setLiveWeatherMode(false);
                    setIsPlayingSequence(false);
                  }}
                  className={`flex-1 py-2 text-[12px] font-medium tracking-[-0.12px] rounded-full transition-colors min-h-[44px] flex items-center justify-center ${
                    !liveWeatherMode
                      ? "bg-[#1c1c1c] text-white shadow"
                      : "text-[#999999] hover:text-white"
                  }`}
                >
                  Simulation
                </button>
                <button
                  onClick={() => {
                    setLiveWeatherMode(true);
                    setIsPlayingSequence(false);
                  }}
                  className={`flex-1 py-2 text-[12px] font-medium tracking-[-0.12px] rounded-full transition-colors min-h-[44px] flex items-center justify-center ${
                    liveWeatherMode
                      ? "bg-[#1c1c1c] text-white shadow"
                      : "text-[#999999] hover:text-white"
                  }`}
                >
                  Live Weather
                </button>
              </div>
            </div>

            {/* Simulation Preset Buttons with Play Sequence */}
            {!liveWeatherMode && (
              <div className="bg-[#141414] border border-[#262626] rounded-[20px] p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-3 min-w-0">
                  <h2 className="text-[13px] sm:text-[14px] font-bold text-white tracking-[-0.3px] truncate mr-2">
                    Simulate Rain Event
                  </h2>
                  <button
                    onClick={() => setIsPlayingSequence(!isPlayingSequence)}
                    className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-full border transition-colors shrink-0 min-h-[36px] ${
                      isPlayingSequence
                        ? "bg-[#0099ff] border-[#0099ff] text-white"
                        : "bg-[#1c1c1c] border-[#262626] text-[#999999] hover:text-white"
                    }`}
                  >
                    {isPlayingSequence ? (
                      <>
                        <Pause className="w-3 h-3 fill-white" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-[#999999]" />
                        <span>Play Sequence</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {PRESETS.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setIsPlayingSequence(false);
                        applySimulator(type);
                      }}
                      className={`text-[11px] sm:text-[12px] font-medium py-2 sm:py-2.5 px-1 rounded-full border transition-all min-h-[44px] flex items-center justify-center truncate ${
                        currentPreset === type
                          ? "bg-[#1c1c1c] border-white text-white font-bold"
                          : "bg-[#1c1c1c] hover:bg-[#262626] active:scale-95 border-[#262626] text-[#999999]"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Weather Status Alert */}
            {liveWeatherMode && locationError && (
              <div className="bg-[#141414] border border-[#ef4444]/40 rounded-[20px] p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[#ef4444] text-[13px]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="break-words">{locationError}</span>
                </div>
                <button
                  onClick={requestUserLocation}
                  className="text-left text-[#0099ff] text-[12px] hover:underline min-h-[44px] flex items-center"
                >
                  Retry GPS
                </button>
              </div>
            )}

            {liveWeatherMode && weatherLoading && (
              <div className="bg-[#141414] border border-[#262626] rounded-[20px] p-4 flex items-center justify-center gap-2 text-[#999999] text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Fetching Open-Meteo live weather data...</span>
              </div>
            )}
          </div>

          {/* Column B / Middle Mobile: Map & Controls (Sticky Full-Height on Desktop) */}
          <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] flex flex-col gap-3 w-full my-3 lg:my-0">
            {/* Map Controls */}
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => setIsSatellite(!isSatellite)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full border text-[12px] font-medium transition-colors min-h-[44px] ${
                  isSatellite
                    ? "bg-[#1c1c1c] border-white text-white"
                    : "bg-[#141414] border-[#262626] text-[#999999] hover:text-white"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{isSatellite ? "Dark Street" : "Satellite"}</span>
              </button>

              {radarUrl && (
                <button
                  onClick={() => setShowRadar(!showRadar)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full border text-[12px] font-medium transition-colors min-h-[44px] ${
                    showRadar
                      ? "bg-[#1c1c1c] border-[#0099ff] text-[#0099ff]"
                      : "bg-[#141414] border-[#262626] text-[#999999] hover:text-white"
                  }`}
                >
                  <CloudRain className="w-4 h-4" />
                  <span>Radar</span>
                </button>
              )}

              {userLocation && (
                <button
                  onClick={() => {
                    const nearest = calculatedNodes.find((n) => n.id === nearestNodeId);
                    const mockFri = calculateFRI(
                      nearest?.base_vPooling || 0.5,
                      nearest?.base_aImpedance || 0.5,
                      userWeather ? (userWeather.rRate ?? getRRateFromWeather(userWeather.effectiveRainMmH ?? userWeather.rainMmH)) : 0
                    ).score;

                    setSelectedNode({
                      id: "user",
                      name: "My Location",
                      fri: mockFri,
                      base_vPooling: nearest?.base_vPooling || 0.5,
                      base_aImpedance: nearest?.base_aImpedance || 0.5,
                      lat: userLocation.lat,
                      lng: userLocation.lng,
                      region: "Current Location",
                      drainType: "User Device GPS",
                      localWeather: userWeather ? { ...userWeather } : null,
                    });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full border border-[#262626] bg-[#141414] text-[#0099ff] hover:text-white transition-colors text-[12px] font-medium min-h-[44px]"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Me</span>
                </button>
              )}
            </div>

            {/* Map Container */}
            <div className="h-[clamp(280px,45dvh,560px)] sm:h-[clamp(360px,50dvh,600px)] lg:h-full lg:flex-1 min-h-[280px] w-full rounded-[20px] overflow-hidden border border-[#262626] relative bg-[#090909]">
              <ToodleMap
                nodes={calculatedNodes}
                selectedNodeId={selectedNode?.id}
                onSelectNode={(id) => {
                  const target = calculatedNodes.find(
                    (n) => String(n.id) === String(id)
                  );
                  if (target) setSelectedNode(target);
                }}
                isSatellite={isSatellite}
                showRadar={showRadar}
                radarUrl={radarUrl}
                userLocation={userLocation}
                fieldReports={fieldReports}
              />

              {/* Weather Overlay Card */}
              {liveWeatherMode && (
                (userWeather || topNodeWeather) ? (() => {
                  const activeW = (userWeather || topNodeWeather) as Partial<WeatherData & UserWeatherData> | undefined;
                  const rainNow = Number(activeW?.rainMmH) || 0;
                  const last24h = Number(activeW?.last24hMm) || 0;
                  return (
                    <div className="absolute top-3 left-3 bg-[#141414]/90 backdrop-blur-md rounded-[10px] p-2.5 border border-[#262626] z-[400] text-xs pointer-events-none shadow-lg max-w-[240px]">
                      <span className="text-[10px] text-[#999999] block mb-1">
                        {userWeather ? "Your location" : "Delhi NCR Default"}
                      </span>
                      {rainNow === 0 && last24h >= 1 ? (
                        <div className="text-[10px] text-cyan-300 font-medium mb-1">
                          Clear now, rain in the last 24h: {last24h} mm
                        </div>
                      ) : rainNow === 0 ? (
                        <div className="text-[10px] text-[#999999] mb-1">Clear</div>
                      ) : null}
                      <div className="flex items-center gap-1.5 text-white mb-0.5">
                        <Thermometer className="w-3 h-3 text-[#0099ff]" />
                        <span className="font-mono text-[11px]">
                          {activeW?.tempC ?? 28}°C
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white mb-0.5">
                        <CloudRain className="w-3 h-3 text-cyan-400" />
                        <span className="font-mono text-[11px]">
                          Rain now: {rainNow} mm/h
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[#999999] mb-0.5 text-[10px]">
                        <span>Last 3h: <span className="text-white font-mono">{activeW?.last3hMm ?? 0} mm</span></span>
                        <span>Last 24h: <span className="text-white font-mono">{activeW?.last24hMm ?? 0} mm</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#999999] mb-0.5">
                        <Wind className="w-3 h-3" />
                        <span className="font-mono text-[10px]">
                          {activeW?.windKmh ?? 10} km/h
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#999999]">
                        <Droplets className="w-3 h-3" />
                        <span className="font-mono text-[10px]">
                          {activeW?.precipProbMax ?? 0}% prob
                        </span>
                      </div>
                    </div>
                  );
                })() : !weatherLoading ? (
                  <div className="absolute top-3 left-3 bg-[#141414]/90 backdrop-blur-md rounded-[10px] p-2 border border-[#262626] z-[400] text-xs pointer-events-none shadow-lg">
                    <span className="text-[#666666] text-[11px] italic">Weather unavailable</span>
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* Column C / Bottom Mobile: Priority Queue & Recent Field Reports */}
          <div className="order-3 lg:col-start-1 lg:row-start-2 flex flex-col gap-4 w-full">
            {/* Priority Queue Section */}
            <section className="flex flex-col gap-2 w-full">
              <div className="mb-1">
                <h2 className="text-[15px] sm:text-[16px] font-bold text-white tracking-[-0.5px]">
                  Priority Queue
                </h2>
                <p className="text-[11px] sm:text-[12px] text-[#999999]">
                  Delhi NCR monitoring nodes sorted by risk
                </p>
              </div>

              <div className="flex flex-col gap-2 w-full">
                {calculatedNodes.slice(0, 8).map((node, index) => (
                  <motion.div
                    layout
                    transition={{ type: "spring", damping: 25, stiffness: 220 }}
                    key={String(node.id)}
                  >
                    <button
                      onClick={() => setSelectedNode(node)}
                      className="w-full bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] rounded-[16px] p-3.5 text-left transition-all active:scale-[0.99] flex flex-col justify-between min-h-[56px]"
                    >
                      <div className="flex items-center justify-between w-full mb-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <span className="font-mono text-xs text-[#999999] shrink-0">#{index + 1}</span>
                          <span className="font-bold text-[13px] sm:text-[14px] text-white truncate">
                            {node.name}
                          </span>
                        </div>
                        {node.distanceKm !== undefined && node.bearing ? (
                          <span className="text-[10px] sm:text-[11px] text-[#999999] font-mono shrink-0 whitespace-nowrap">
                            {node.distanceKm} km {node.bearing}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between w-full text-[11px]">
                        <span className="text-[#666666] truncate pr-2">
                          {node.drainType} · {node.region}
                        </span>
                        <span
                          className={`font-mono text-[11px] sm:text-[12px] font-semibold shrink-0 whitespace-nowrap tabular-nums ${
                            node.fri >= 0.86
                              ? "text-[#ef4444]"
                              : node.fri >= 0.66
                              ? "text-[#f59e0b]"
                              : "text-[#22c55e]"
                          }`}
                        >
                          FRI: <AnimatedNumber value={node.fri} />
                        </span>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Recent Field Reports */}
            {fieldReports.length > 0 && (
              <section className="flex flex-col gap-2 w-full mt-2">
                <h2 className="text-[15px] sm:text-[16px] font-bold text-white tracking-[-0.5px]">
                  Recent Field Reports
                </h2>
                <div className="flex flex-col gap-2 w-full">
                  {fieldReports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-[#141414] border border-[#262626] rounded-[15px] p-3.5 flex items-center justify-between min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <MapPin
                          className={`w-4 h-4 shrink-0 ${
                            report.floodDetected ? "text-[#ef4444]" : "text-[#22c55e]"
                          }`}
                        />
                        <span className="text-[13px] font-medium text-white truncate">
                          {report.verdict}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] sm:text-[11px] text-[#999999] shrink-0 whitespace-nowrap">
                        VP: {report.vPooling.toFixed(2)} ·{" "}
                        {new Date(report.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Selected Node Details Sheet Overlay */}
        {selectedNode && (
          <NodeSheet
            node={selectedNode}
            chokeMultiplier={chokeMultiplier}
            rainRate={liveWeatherMode ? (((selectedNode.localWeather as Partial<WeatherData & UserWeatherData>)?.rRate) ?? getRRateFromWeather(Number((selectedNode.localWeather as Partial<WeatherData & UserWeatherData>)?.effectiveRainMmH ?? (selectedNode.localWeather as Partial<WeatherData & UserWeatherData>)?.rainMmH) || 0)) : (rainMmH > 30 ? 1.0 : rainMmH / 30)}
            liveWeatherMode={liveWeatherMode}
            onClose={() => setSelectedNode(null)}
            onDispatch={(n) => setSmsModalNode(n)}
            dispatching={false}
          />
        )}

        {/* SMS Preview Emergency Modal */}
        {smsModalNode && (
          <SmsPreviewModal
            node={smsModalNode}
            onClose={() => setSmsModalNode(null)}
          />
        )}
      </div>
    </MobileShell>
  );
}
