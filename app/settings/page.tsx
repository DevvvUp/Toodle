"use client";

import React, { useState, useEffect } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { Settings as SettingsIcon, Info, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [diagResults, setDiagResults] = useState({
    health: "",
    nodes: "",
    weather: "",
    analyze: "",
    alert: "",
  });
  const [running, setRunning] = useState(false);
  const [hostName, setHostName] = useState("");
  const [lensOcclusion, setLensOcclusion] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [alertSending, setAlertSending] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHostName(window.location.host);
    }
  }, []);

  useEffect(() => {
    if (!showConfirmModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowConfirmModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmModal]);

  const runChecks = async () => {
    setRunning(true);
    const check = async (path: string, options?: RequestInit) => {
      try {
        const res = await fetch(path, options);
        const contentType = res.headers.get("content-type");
        if (contentType?.includes("text/html")) {
          return "FAIL: " + res.status + " HTML returned";
        }
        if (!res.ok) {
          let msg = "Failed";
          try {
            const body = await res.json();
            msg = body.error || msg;
          } catch {}
          return "FAIL: " + res.status + " " + msg;
        }
        return "PASS";
      } catch (err: unknown) {
        return "FAIL: " + (err instanceof Error ? err.message : "Network error");
      }
    };

    setDiagResults((prev) => ({
      ...prev,
      health: "Testing...",
      nodes: "Testing...",
      weather: "Testing...",
      analyze: "Testing...",
    }));

    const h = await check("/api/health");
    const n = await check("/api/nodes");
    const w = await check("/api/weather");
    const b64 =
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const a = await check("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: b64 }),
    });

    setDiagResults((prev) => ({
      ...prev,
      health: h,
      nodes: n,
      weather: w,
      analyze: a,
    }));
    setRunning(false);
    toast.success("Diagnostic checks completed");
  };

  const handleSendTestAlert = async () => {
    setShowConfirmModal(false);
    setAlertSending(true);
    setDiagResults((prev) => ({ ...prev, alert: "Sending..." }));

    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: 4,
          nodeName: "Test Node",
          fri: 0.95,
          action: "Dispatch maintenance",
          drainStatus: "App Dispatch",
        }),
      });

      if (res.headers.get("content-type")?.includes("text/html")) {
        setDiagResults((prev) => ({
          ...prev,
          alert: "FAIL: " + res.status + " HTML returned",
        }));
        toast.error("Failed: HTML returned");
        return;
      }

      if (res.status === 429) {
        const b = await res.json();
        const msg = `Cooldown active. ${b.remainingSeconds}s left`;
        setDiagResults((prev) => ({ ...prev, alert: msg }));
        toast.warning(msg);
      } else if (!res.ok) {
        setDiagResults((prev) => ({ ...prev, alert: "FAIL: " + res.status }));
        toast.error("Dispatch failed: HTTP " + res.status);
      } else {
        const b = await res.json();
        const msg = "PASS: " + (b.messageId || "Success");
        setDiagResults((prev) => ({ ...prev, alert: msg }));
        toast.success("Test alert sent successfully");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      setDiagResults((prev) => ({
        ...prev,
        alert: "FAIL: " + msg,
      }));
      toast.error(msg);
    } finally {
      setAlertSending(false);
    }
  };

  const renderBadge = (status: string) => {
    if (!status) return <span className="text-[#666666] font-mono">-</span>;
    if (status === "Testing..." || status === "Sending...")
      return <span className="text-[#0099ff] font-mono animate-pulse">{status}</span>;
    if (status.startsWith("PASS"))
      return <span className="text-[#22c55e] font-mono font-bold">{status}</span>;
    if (status.startsWith("Cooldown"))
      return <span className="text-[#f59e0b] font-mono text-xs">{status}</span>;
    return <span className="text-[#ef4444] font-mono text-xs">{status}</span>;
  };

  return (
    <MobileShell>
      <div className="flex flex-col flex-1 p-4 pb-8">
        {/* Header */}
        <header className="flex items-center gap-2 pb-4 mb-4 border-b border-[#262626]">
          <SettingsIcon className="w-5 h-5 text-white" />
          <h1 className="text-[18px] font-bold text-white tracking-[-0.5px]">
            Settings & Info
          </h1>
        </header>

        {/* Section 1: Connection Diagnostics */}
        <section className="mb-6">
          <h2 className="text-[16px] font-bold text-white tracking-[-0.5px] mb-2">
            Connection diagnostics
          </h2>
          <div className="bg-[#141414] border border-[#262626] rounded-[20px] p-4 flex flex-col gap-2">
            <span className="text-[11px] font-mono text-[#999999]">
              Host: {hostName || "localhost"}
            </span>
            <span className="text-[11px] font-mono text-[#999999] mb-1">
              App Version: 1.0.0
            </span>

            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a] text-sm">
              <span className="text-[#999999]">Health</span>
              {renderBadge(diagResults.health)}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a] text-sm">
              <span className="text-[#999999]">Nodes</span>
              {renderBadge(diagResults.nodes)}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a] text-sm">
              <span className="text-[#999999]">Weather</span>
              {renderBadge(diagResults.weather)}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a] text-sm">
              <span className="text-[#999999]">Analyze</span>
              {renderBadge(diagResults.analyze)}
            </div>

            <button
              onClick={runChecks}
              disabled={running}
              className="mt-3 w-full bg-[#1c1c1c] hover:bg-[#262626] active:scale-[0.98] border border-[#262626] text-white py-3 rounded-full text-xs font-semibold transition min-h-[44px] flex items-center justify-center gap-2"
            >
              {running && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{running ? "Running checks..." : "Run checks"}</span>
            </button>
          </div>
        </section>

        {/* Section 2: SNS Alert Diagnostics */}
        <section className="mb-6">
          <div className="bg-[#141414] border border-[#262626] rounded-[20px] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#999999]">SNS Alert</span>
              {renderBadge(diagResults.alert)}
            </div>
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={alertSending}
              className="w-full bg-[#7f1d1d] hover:bg-[#991b1b] active:scale-[0.98] border border-[#ef4444] text-[#fca5a5] py-3 rounded-full text-xs font-bold transition min-h-[44px]"
            >
              {alertSending ? "Sending..." : "Send test alert"}
            </button>
          </div>
        </section>

        {/* Section 3: KPIs & Thresholds */}
        <section className="mb-6">
          <h2 className="text-[16px] font-bold text-white tracking-[-0.5px] mb-2">
            KPIs & Thresholds
          </h2>
          <div className="bg-[#141414] border border-[#262626] rounded-[20px] p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a] text-sm">
              <span className="text-[#999999]">Critical FRI Threshold</span>
              <span className="font-mono text-white">0.86</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a] text-sm">
              <span className="text-[#999999]">Dispatch Cooldown</span>
              <span className="font-mono text-white">15 min</span>
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-[#999999]">Polling Frequency</span>
              <span className="font-mono text-white">10s</span>
            </div>
          </div>
        </section>

        {/* Section 4: Simulations */}
        <section className="mb-6">
          <h2 className="text-[16px] font-bold text-white tracking-[-0.5px] mb-2">
            Simulations
          </h2>
          <div className="bg-[#141414] border border-[#262626] rounded-[20px] p-4 flex items-center justify-between">
            <div className="pr-4">
              <h3 className="text-sm font-semibold text-white">
                Lens Occlusion Fallback
              </h3>
              <p className="text-[11px] text-[#999999] mt-0.5">
                Raises acoustic weight dynamically if camera is obstructed.
              </p>
            </div>
            <input
              type="checkbox"
              checked={lensOcclusion}
              onChange={(e) => setLensOcclusion(e.target.checked)}
              className="w-5 h-5 accent-[#0099ff] cursor-pointer"
            />
          </div>
        </section>

        {/* Section 5: About App Architecture */}
        <section>
          <h2 className="text-[16px] font-bold text-white tracking-[-0.5px] mb-2">
            About App Architecture
          </h2>
          <div className="bg-[#141414] border border-[#262626] rounded-[20px] p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-[#999999] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                Live Integration
              </h3>
              <p className="text-[12px] text-[#999999] leading-relaxed">
                Rekognition, SNS and DynamoDB are live; Kinesis ingestion and SageMaker acoustic scoring are simulated in this prototype.
              </p>
            </div>
          </div>
        </section>

        {/* Confirm Modal */}
        {showConfirmModal && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowConfirmModal(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full sm:max-w-[380px] max-h-[90dvh] overflow-y-auto custom-scrollbar bg-[#141414] border border-[#262626] rounded-t-[20px] sm:rounded-[20px] p-5 shadow-2xl flex flex-col gap-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center gap-2 text-[#ef4444]">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-[16px] text-white">
                  Send Test Alert
                </h3>
              </div>
              <p className="text-[13px] text-[#999999] leading-relaxed break-words">
                This will trigger a real SNS dispatch test to registered subscribers. Proceed?
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 rounded-full bg-[#1c1c1c] text-white text-xs font-semibold border border-[#262626] hover:bg-[#262626] min-h-[44px] flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendTestAlert}
                  disabled={alertSending}
                  className="flex-1 py-3 rounded-full bg-[#7f1d1d] text-[#fca5a5] border border-[#ef4444] text-xs font-bold hover:bg-[#991b1b] min-h-[44px] flex items-center justify-center"
                >
                  {alertSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
