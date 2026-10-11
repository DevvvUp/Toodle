"use client";
import React, { useState, useRef } from "react";
import Link from "next/link";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { toast } from "sonner";

interface AnalysisResult {
  error?: string;
  labels: { Name: string; Confidence: number; Instances?: { BoundingBox: { Left: number, Top: number, Width: number, Height: number } }[] }[];
  vPooling: number;
  floodDetected?: boolean;
  reason?: string;
  roadVerified?: boolean;
  screenDetected?: boolean;
}

export default function DemoPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<null | AnalysisResult>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAllLabels, setShowAllLabels] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const priorityLabels = ["Flood", "Flash Flood", "Water", "Puddle", "Road", "Street", "Asphalt", "Car", "Vehicle"];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const MAX_SIZE = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setImageSrc(dataUrl);

          try {
            const res = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageBase64: dataUrl.split(",")[1] }),
            });
            const data = await res.json();
            
            if (!res.ok) {
              toast.error(data.error || "Analysis failed");
              setResult({ error: data.error || "Analysis failed", labels: [], vPooling: 0, floodDetected: false });
            } else {
              const sortedLabels = (data.labels || []).sort((a: { Name: string, Confidence: number }, b: { Name: string, Confidence: number }) => {
                const aPrio = priorityLabels.includes(a.Name);
                const bPrio = priorityLabels.includes(b.Name);
                if (aPrio && !bPrio) return -1;
                if (!aPrio && bPrio) return 1;
                return b.Confidence - a.Confidence;
              });
              setResult({
                labels: sortedLabels,
                vPooling: data.v_pooling,
                floodDetected: data.flood_detected,
                reason: data.reason,
                roadVerified: data.roadVerified,
                screenDetected: data.screenDetected
              });
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Network error analyzing image";
            toast.error(errMsg);
            setResult({ error: errMsg, labels: [], vPooling: 0, floodDetected: false });
          } finally {
            setAnalyzing(false);
          }
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDispatch = async () => {
    if (result?.screenDetected) {
      toast.error("Image detected as a screen. Dispatch is disabled.");
      return;
    }
    setDispatching(true);
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nodeId: 4, 
          nodeName: "DTU Main Gate", 
          fri: 0.92, 
          drainStatus: "Simulated Choke", 
          action: "Dispatch Response Unit",
          screenDetected: result?.screenDetected
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          <div className="flex flex-col space-y-1">
            <b>📱 SMS Sent!</b>
            <span className="text-xs">Message ID: {data.messageId}</span>
          </div>,
          { duration: 5000 }
        );
      } else if (res.status === 429) {
        toast.error(`Cooldown active. Please wait ${data.remainingSeconds} seconds before dispatching again.`);
      } else {
        toast.error(data.error || "Dispatch failed");
      }
    } catch {
      toast.error("Network error during dispatch");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-neutral-950 flex flex-col items-center justify-center p-4 py-16 pt-safe pb-safe pl-safe pr-safe">
      <Link href="/" className="absolute top-8 left-8 text-neutral-500 hover:text-white pt-safe pl-safe">
        &larr; Back to Home
      </Link>
      
      <div className="max-w-xl w-full">
        <h1 className="text-3xl font-bold mb-2 text-center">Live Rekognition Test</h1>
        <p className="text-neutral-400 text-center mb-8">
          Upload a CCTV frame to test the Visual Perception Engine.
        </p>

        <div className="bg-neutral-900 border border-white/10 rounded-2xl p-8 mb-8 flex flex-col items-center justify-center text-center">
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          
          <div 
            ref={dropzoneRef}
            className="w-full aspect-video relative bg-neutral-800 rounded-lg border-2 border-dashed border-neutral-700 flex items-center justify-center mb-6 cursor-pointer hover:border-neutral-500 transition-colors overflow-hidden" 
            onClick={() => fileInputRef.current?.click()}
          >
            {imageSrc ? (
              <>
                <img src={imageSrc} alt="Uploaded" className="object-cover w-full h-full opacity-50" />
                {analyzing && (
                  <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 text-cyan-400">
                    <UploadCloud className="w-8 h-8 mb-2 animate-bounce" />
                    <span className="font-bold animate-pulse text-sm">Analyzing with Amazon Rekognition...</span>
                  </div>
                )}
                {result?.labels.flatMap(l => l.Instances?.map((inst, i) => {
                  const box = inst.BoundingBox;
                  if (!box) return null;
                  
                  const isPriority = priorityLabels.includes(l.Name);
                  if (!showAllLabels && !isPriority) return null;

                  const dropzoneWidth = dropzoneRef.current?.clientWidth || 500;
                  const isTooSmall = (box.Width * dropzoneWidth) < 40;
                  const nearTop = box.Top < 0.1;

                  return (
                    <div 
                      key={`${l.Name}-${i}`}
                      className="absolute border-2 border-cyan-500 bg-cyan-500/20"
                      style={{
                        left: `${box.Left * 100}%`,
                        top: `${box.Top * 100}%`,
                        width: `${box.Width * 100}%`,
                        height: `${box.Height * 100}%`
                      }}
                    >
                      {!isTooSmall && (
                        <span 
                          className={`absolute left-0 bg-cyan-500 text-black text-[10px] font-bold px-1 whitespace-nowrap ${nearTop ? 'top-0' : '-top-5'}`}
                        >
                          {l.Name}
                        </span>
                      )}
                    </div>
                  );
                }))}
              </>
            ) : (
              <div className="flex flex-col items-center">
                <UploadCloud className="w-8 h-8 text-neutral-500 mb-2" />
                <span className="text-sm text-neutral-400">Click to upload image</span>
              </div>
            )}
          </div>
          
          {result && result.error && (
            <div className="w-full mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex flex-col items-center gap-3">
              <span className="text-red-400 font-bold">{result.error}</span>
              <button 
                onClick={() => { setImageSrc(null); setResult(null); }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-md transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {result && !result.error && (
            <div className="w-full text-left space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Analysis Complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-400 flex items-center gap-1 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={showAllLabels} 
                      onChange={e => setShowAllLabels(e.target.checked)}
                      className="accent-cyan-500"
                    />
                    Show all bounding boxes
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {result.labels.map((l, i) => {
                  const isPriority = priorityLabels.includes(l.Name);
                  return (
                    <div key={i} className="flex flex-col bg-neutral-950 p-3 rounded border border-white/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={isPriority ? "text-cyan-400 font-bold" : "text-neutral-300"}>{l.Name}</span>
                        <span className="font-mono text-sm">{l.Confidence.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full ${isPriority ? "bg-cyan-500" : "bg-neutral-600"}`} style={{ width: `${l.Confidence}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-orange-500">Calculated V_pooling:</span>
                  <span className="font-mono text-xl font-bold text-orange-400">{result.vPooling}</span>
                </div>
                <div className="text-xs text-orange-500/80 mt-1">
                  Reason: {result.reason || (result.floodDetected ? "Water/Flood keyword detected" : "No water/flood keywords detected")}
                </div>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex justify-between items-center">
                <span className="text-blue-500">Flood Verdict:</span>
                <span className="font-bold text-blue-400">{result.vPooling > 0.5 ? "FLOOD DETECTED" : "CLEAR"}</span>
              </div>
              {result.screenDetected && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  ⚠️ Image detected as a screen or device. Alert dispatch is disabled.
                </div>
              )}
            </div>
          )}
        </div>

        {result && !result.error && (
           <HoverBorderGradient
           containerClassName="w-full rounded-xl"
           as="button"
           className={`w-full text-white flex justify-center py-4 ${result.screenDetected ? "bg-neutral-900/50 opacity-50 cursor-not-allowed" : "bg-neutral-900"}`}
           onClick={dispatching || result.screenDetected ? undefined : handleDispatch}
         >
           <span className="flex items-center gap-2">
             <AlertCircle className="w-5 h-5" /> {dispatching ? "Sending..." : "Send Test SMS via SNS"}
           </span>
         </HoverBorderGradient>
        )}
      </div>
    </div>
  );
}
