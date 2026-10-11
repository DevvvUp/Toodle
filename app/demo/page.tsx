"use client";

import React, { useState, useRef, useEffect } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { analyzeImage, dispatchUnit } from "@/lib/api";
import { validateRoadImage, RoadValidationResult } from "@/lib/imageValidation";
import { useSimulatorStore } from "@/store/simulator-store";
import {
  Camera,
  AlertTriangle,
  CheckCircle,
  Activity,
  MapPin,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const SHOW_DEBUG_LABELS = true;
const MAX_LABELS_SHOWN = 4;

const FLOOD_PRIORITY_LABELS = [
  "flood",
  "flash flood",
  "water",
  "puddle",
  "road",
  "street",
  "asphalt",
  "tarmac",
  "intersection",
  "highway",
  "pavement",
  "vehicle",
  "car",
  "motorcycle",
];

const FLOOD_PRIORITY_SET = new Set(FLOOD_PRIORITY_LABELS.map((s) => s.toLowerCase()));

interface LabelInstance {
  BoundingBox?: {
    Top: number;
    Left: number;
    Width: number;
    Height: number;
  };
}

interface LabelItem {
  Name?: string;
  name?: string;
  Confidence?: number;
  confidence?: number;
  Instances?: LabelInstance[];
}

interface GeotagData {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  altitude: number | null;
  capturedAt: string;
  mocked: boolean;
}

interface AnalysisResultData {
  labels?: LabelItem[];
  v_pooling?: number;
  flood_detected?: boolean;
  reason?: string;
  error?: string;
  dispatchError?: string;
}

function getTopDisplayLabels(labels: LabelItem[] = []): LabelItem[] {
  const safeLabels = Array.isArray(labels) ? labels : [];

  const sorted = [...safeLabels].sort((a, b) => {
    const aName = ((a.Name || a.name || "") as string).toLowerCase().trim();
    const bName = ((b.Name || b.name || "") as string).toLowerCase().trim();
    const aConf = typeof a.Confidence === "number" ? a.Confidence : typeof a.confidence === "number" ? a.confidence : 0;
    const bConf = typeof b.Confidence === "number" ? b.Confidence : typeof b.confidence === "number" ? b.confidence : 0;

    const aPrio = FLOOD_PRIORITY_SET.has(aName);
    const bPrio = FLOOD_PRIORITY_SET.has(bName);

    if (aPrio && !bPrio) return -1;
    if (!aPrio && bPrio) return 1;
    return bConf - aConf;
  });

  const seen = new Set<string>();
  const top: LabelItem[] = [];
  for (const item of sorted) {
    const key = ((item.Name || item.name || "") as string).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    top.push(item);
    if (top.length >= MAX_LABELS_SHOWN) break;
  }

  return top;
}

export default function DemoPage() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResultData | null>(null);
  const [validation, setValidation] = useState<RoadValidationResult | null>(null);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [smsPreview, setSmsPreview] = useState("");
  const [geotag, setGeotag] = useState<GeotagData | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const addFieldReport = useSimulatorStore((state) => state.addFieldReport);

  // Initialize camera
  useEffect(() => {
    let active = true;

    async function startCamera() {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API is not supported in this browser");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to access camera";
        setCameraError(msg);
      }
    }

    if (!imageUri) {
      startCamera();
    }

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [imageUri]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const getAlertEligibility = (): { canSend: boolean; reason: string } => {
    if (!validation || !validation.valid) {
      return { canSend: false, reason: validation?.reason || "Image not verified as a real road" };
    }
    if (!result?.flood_detected) {
      return { canSend: false, reason: "No flood detected in image" };
    }
    if ((result?.v_pooling || 0) < 0.70) {
      return { canSend: false, reason: "Flood risk (V_pooling) below critical threshold (0.70)" };
    }
    if (!geotag) {
      return { canSend: false, reason: "GPS location required" };
    }
    if (geotag.mocked === true) {
      return { canSend: false, reason: "Mocked GPS locations are not allowed for alerts" };
    }
    const capturedTimestamp = new Date(geotag.capturedAt).getTime();
    const ageMs = Date.now() - capturedTimestamp;
    if (ageMs > 2 * 60 * 1000 || ageMs < -60000) {
      return { canSend: false, reason: "Geotag expired (must be captured within 2 minutes)" };
    }
    return { canSend: true, reason: "" };
  };

  const capturePhoto = async () => {
    setLocationError(null);

    // 1. Mandatory high-accuracy GPS with 10s timeout
    let loc: GeolocationPosition;
    try {
      loc = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation not supported"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        });
      });
    } catch {
      setLocationError("Failed to get location fix within 10s. Please ensure GPS is active.");
      return;
    }

    const gTag: GeotagData = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracyMeters: loc.coords.accuracy,
      altitude: loc.coords.altitude,
      capturedAt: new Date().toISOString(),
      mocked: false,
    };
    setGeotag(gTag);

    // 2. Capture frame from video element
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, vw, vh);

    const initialDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    processImage(initialDataUrl, gTag);
  };

  const processImage = async (dataUrl: string, currentGeotag: GeotagData) => {
    setImageUri(dataUrl);
    setAnalyzing(true);
    setResult(null);
    setValidation(null);
    setSmsPreview("");

    try {
      // 3. Resize to max 1280px and keep under 2MB
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => {
        img.onload = res;
      });

      const MAX_SIZE = 1280;
      let w = img.width;
      let h = img.height;
      if (w > h && w > MAX_SIZE) {
        h = (h * MAX_SIZE) / w;
        w = MAX_SIZE;
      } else if (h > w && h > MAX_SIZE) {
        w = (w * MAX_SIZE) / h;
        h = MAX_SIZE;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.drawImage(img, 0, 0, w, h);

      let quality = 0.7;
      let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);

      // Ensure base64 string is < 2MB (2 * 1024 * 1024 chars)
      while (compressedDataUrl.length > 2 * 1024 * 1024 && quality > 0.15) {
        quality -= 0.15;
        w *= 0.85;
        h *= 0.85;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      }

      setImageUri(compressedDataUrl);

      // Strip prefix for API
      const base64Payload = compressedDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
      const data = await analyzeImage(base64Payload) as AnalysisResultData;

      const rawLabels = (data.labels || []) as LabelItem[];
      const sortedLabels = rawLabels.sort((a, b) => {
        const aPrio = FLOOD_PRIORITY_SET.has((a.Name || a.name || "").toLowerCase().trim());
        const bPrio = FLOOD_PRIORITY_SET.has((b.Name || b.name || "").toLowerCase().trim());
        if (aPrio && !bPrio) return -1;
        if (!aPrio && bPrio) return 1;
        return (b.Confidence ?? b.confidence ?? 0) - (a.Confidence ?? a.confidence ?? 0);
      });

      const roadVal = validateRoadImage(sortedLabels);
      setValidation(roadVal);
      setResult({ ...data, labels: sortedLabels });

      // Only save report globally when image is a valid road scene
      if (roadVal.valid) {
        addFieldReport({
          id: Math.random().toString(36).substring(2, 9),
          uri: compressedDataUrl,
          lat: currentGeotag.latitude,
          lng: currentGeotag.longitude,
          verdict: data.flood_detected ? "Flood Detected" : "No Flood",
          vPooling: data.v_pooling || 0,
          timestamp: currentGeotag.capturedAt,
          floodDetected: data.flood_detected || false,
          accuracy: currentGeotag.accuracyMeters,
          mocked: currentGeotag.mocked,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setResult({ error: msg });
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDispatch = async () => {
    const eligibility = getAlertEligibility();
    if (!eligibility.canSend) {
      setResult((prev) => ({ ...(prev || {}), dispatchError: eligibility.reason }));
      return;
    }

    setDispatching(true);
    try {
      const shouldIncludeCoords = result?.flood_detected && (result?.v_pooling || 0) >= 0.70;
      const coordsString = shouldIncludeCoords && geotag
        ? ` [GPS: ${geotag.latitude.toFixed(6)}, ${geotag.longitude.toFixed(6)}]`
        : "";
      const mapLink = shouldIncludeCoords && geotag
        ? `\nMap: https://www.openstreetmap.org/?mlat=${geotag.latitude}&mlon=${geotag.longitude}`
        : "";

      await dispatchUnit(
        4,
        "DTU Main Gate",
        result?.v_pooling || 0.92,
        "Dispatch Hydro-Jet" + coordsString,
        { roadVerified: true, screenDetected: false }
      );

      setSmsPreview(
        `[CRITICAL ALERT - FLOODGUARD AI]\nNode: #4 (DTU Main Gate Intersection)\nRisk Score: ${(
          result?.v_pooling || 0.92
        ).toFixed(2)} | Drain Status: App Dispatch\nRec. Action: Dispatch Hydro-Jet Truck to Clear Ingress Grate.${mapLink}`
      );
      toast.success("Alert dispatched via SNS");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to dispatch alert";
      setResult((prev) => ({ ...(prev || {}), dispatchError: msg }));
      toast.error(msg);
    } finally {
      setDispatching(false);
    }
  };

  const openMap = () => {
    if (geotag) {
      window.open(
        `https://www.openstreetmap.org/?mlat=${geotag.latitude}&mlon=${geotag.longitude}#map=18/${geotag.latitude}/${geotag.longitude}`,
        "_blank"
      );
    }
  };

  return (
    <MobileShell>
      <div className="flex flex-col flex-1 p-4 pb-8">
        <h1 className="text-[24px] font-semibold text-white tracking-[-0.8px] mb-1">
          Live Field Capture
        </h1>
        <p className="text-[14px] text-[#999999] tracking-[-0.15px] mb-5">
          Capture a geotagged photo to analyze flood risk via Amazon Rekognition.
        </p>

        {/* Location or Camera Error Card */}
        {locationError && (
          <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-[20px] p-4 flex flex-col items-center text-center mb-4">
            <AlertTriangle className="w-6 h-6 text-[#ef4444] mb-2" />
            <p className="text-[#f87171] font-medium text-xs mb-3">{locationError}</p>
            <button
              onClick={() => setLocationError(null)}
              className="w-full bg-[#1c1c1c] text-white py-2.5 rounded-full text-xs font-semibold hover:bg-[#262626] transition"
            >
              Try again
            </button>
          </div>
        )}

        {/* Viewfinder when capturing */}
        {!imageUri && (
          <div className="flex flex-col gap-4">
            <div className="w-full aspect-[3/4] bg-[#141414] rounded-[20px] border border-[#262626] overflow-hidden relative flex flex-col items-center justify-center shadow-lg">
              {cameraError ? (
                <div className="p-4 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#ef4444] mx-auto mb-2" />
                  <p className="text-xs text-[#999999] mb-3">{cameraError}</p>
                  <button
                    onClick={() => setImageUri(null)}
                    className="px-4 py-2 bg-[#1c1c1c] text-white rounded-full text-xs border border-[#262626]"
                  >
                    Retry Camera
                  </button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <button
              onClick={capturePhoto}
              className="w-full bg-white text-black rounded-full py-4 px-6 flex flex-col items-center justify-center hover:bg-neutral-200 transition-all active:scale-[0.98] min-h-[72px] shadow-lg"
            >
              <div className="flex items-center gap-2 font-bold text-[17px] tracking-[-0.5px]">
                <Camera className="w-5 h-5 text-black" />
                <span>Capture Field Image</span>
              </div>
              <span className="text-[11px] text-[#404040] mt-0.5">
                High-accuracy GPS required
              </span>
            </button>
          </div>
        )}

        {/* Display Captured Image & Overlays */}
        {imageUri && (
          <div className="w-full aspect-[3/4] bg-[#141414] rounded-[20px] border border-[#262626] overflow-hidden relative mb-5 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUri}
              alt="Field capture"
              className="w-full h-full object-cover"
            />

            {analyzing && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                <span className="text-white font-bold text-xs">
                  Analyzing with Amazon Rekognition...
                </span>
              </div>
            )}

            {/* Bounding Boxes */}
            {result?.labels?.map((l, i) => {
              if (!l.Instances) return null;
              const isPriority = FLOOD_PRIORITY_SET.has(
                (l.Name || l.name || "").toLowerCase().trim()
              );
              if (!showAllLabels && !isPriority) return null;

              return l.Instances.map((inst, idx) => {
                const box = inst.BoundingBox;
                if (!box) return null;
                const top = Math.max(0, box.Top * 100);
                const left = Math.max(0, box.Left * 100);
                const width = Math.min(100 - left, box.Width * 100);
                const height = Math.min(100 - top, box.Height * 100);

                return (
                  <div
                    key={`${i}-${idx}`}
                    className="absolute border-2 border-[#0099ff] bg-[#0099ff]/20 z-10 pointer-events-none"
                    style={{
                      top: `${top}%`,
                      left: `${left}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 bg-[#0099ff] text-white text-[10px] font-bold px-1 whitespace-nowrap">
                      {l.Name || l.name}
                    </span>
                  </div>
                );
              });
            })}
          </div>
        )}

        {/* Analysis Results View */}
        {result && !result.error && geotag && (() => {
          const alertEligibility = getAlertEligibility();
          const isDispatchDisabled = dispatching || !alertEligibility.canSend;

          return (
            <div className="flex flex-col gap-3">
              {/* Invalid Card */}
              {validation && !validation.valid && (
                <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-[20px] p-4 flex flex-col items-center text-center">
                  <AlertTriangle className="w-6 h-6 text-[#ef4444] mb-1" />
                  <h3 className="font-bold text-[15px] text-[#ef4444] mb-1">
                    Image Rejected
                  </h3>
                  <p className="text-[12px] text-[#fca5a5] leading-relaxed mb-3">
                    {validation.reason}
                  </p>
                  {SHOW_DEBUG_LABELS && result?.labels && result.labels.length > 0 && (
                    <p className="text-[11px] text-[#999999] mb-3">
                      Detected:{" "}
                      {getTopDisplayLabels(result.labels)
                        .map(
                          (l) =>
                            `${l.Name ?? l.name} ${Math.round(
                              l.Confidence ?? l.confidence ?? 0
                            )}%`
                        )
                        .join(", ")}
                    </p>
                  )}
                  <button
                    onClick={() => setImageUri(null)}
                    className="w-full bg-[#ef4444] text-white py-2.5 rounded-full font-bold text-xs"
                  >
                    Retake photo
                  </button>
                </div>
              )}

              {/* Status Header */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-[#22c55e]" />
                  <span className="text-[13px] text-white font-medium">
                    Analysis Complete
                  </span>
                  {validation?.valid && (
                    <span className="bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#4ade80] text-[11px] font-bold px-2 py-0.5 rounded-full">
                      Road verified ({validation.roadConfidence}%)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowAllLabels(!showAllLabels)}
                  className="text-[12px] text-[#999999] hover:text-white"
                >
                  Toggle all boxes
                </button>
              </div>

              {/* Geotag Card */}
              <div className="bg-[#141414] border border-[#262626] rounded-[20px] p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-5 h-5 text-[#999999] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[11px] text-[#999999] block">
                        Browser GPS Location
                      </span>
                      <span className="font-mono text-[14px] text-white block mt-0.5">
                        {geotag.latitude.toFixed(6)}, {geotag.longitude.toFixed(6)}
                      </span>
                      <span className="text-[10px] text-[#999999] block mt-0.5">
                        Accuracy: {Math.round(geotag.accuracyMeters)}m ·{" "}
                        {new Date(geotag.capturedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <span className="bg-[#22c55e]/15 text-[#4ade80] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Verified
                  </span>
                </div>
                <button
                  onClick={openMap}
                  className="text-left text-[#0099ff] text-[11px] font-bold hover:underline mt-1"
                >
                  View on OpenStreetMap →
                </button>
              </div>

              {/* Top 4 Display Labels */}
              <div className="flex flex-col gap-2">
                {getTopDisplayLabels(result.labels).map((l, i) => {
                  const name = l.Name || l.name || "";
                  const conf =
                    typeof l.Confidence === "number"
                      ? l.Confidence
                      : typeof l.confidence === "number"
                      ? l.confidence
                      : 0;
                  const isPriority = FLOOD_PRIORITY_SET.has(name.toLowerCase().trim());

                  return (
                    <div
                      key={i}
                      className="bg-[#141414] border border-[#262626] rounded-[15px] p-3 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[13px] ${
                            isPriority ? "font-bold text-white" : "text-[#999999]"
                          }`}
                        >
                          {name}
                        </span>
                        <span className="font-mono text-[13px] text-[#999999]">
                          {Number(conf).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-[#1c1c1c] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            isPriority ? "bg-white" : "bg-[#999999]"
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(0, conf))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* V_pooling Score Card */}
              {validation?.valid && (
                <div className="bg-[#141414] border border-[#262626] rounded-[20px] p-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#fb923c] font-medium">
                      Calculated V_pooling:
                    </span>
                    <span className="font-mono font-bold text-[20px] text-[#fb923c]">
                      {result.v_pooling || 0}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#999999] leading-tight">
                    Reason:{" "}
                    {result.reason ||
                      (result.flood_detected
                        ? "Water/Flood keyword detected"
                        : "No water/flood keywords detected")}
                  </span>
                </div>
              )}

              {/* Send Test Alert Button */}
              <button
                onClick={handleDispatch}
                disabled={isDispatchDisabled}
                className={`w-full py-3.5 px-4 rounded-full flex items-center justify-center gap-2 font-bold text-sm transition-all min-h-[44px] ${
                  isDispatchDisabled
                    ? "bg-[#141414] border border-[#262626] text-[#666666] opacity-60 cursor-not-allowed"
                    : "bg-[#7f1d1d] border border-[#ef4444] text-[#fca5a5] hover:bg-[#991b1b] active:scale-[0.98]"
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>
                  {dispatching ? "Sending..." : "Send Test Alert via SNS"}
                </span>
              </button>

              {!alertEligibility.canSend && (
                <p className="text-[11px] text-[#999999] text-center px-4">
                  {alertEligibility.reason}
                </p>
              )}

              {/* SMS Preview Card */}
              {smsPreview && (
                <div className="bg-[#141414] border border-[#262626] rounded-[15px] p-4 text-[12px] font-mono text-white whitespace-pre-wrap">
                  {smsPreview}
                </div>
              )}

              {/* Retake Button */}
              <button
                onClick={() => setImageUri(null)}
                className="w-full bg-[#1c1c1c] text-white py-3 rounded-full text-xs font-semibold hover:bg-[#262626] transition min-h-[44px] mt-2"
              >
                Capture Another Image
              </button>
            </div>
          );
        })()}
      </div>
    </MobileShell>
  );
}
