"use client";

import React, { useMemo, useEffect } from "react";
import { CalculatedNode } from "@/lib/api";
import { X, Truck, Thermometer, CloudRain, Wind, Droplets } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  YAxis,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";

interface NodeSheetProps {
  node: CalculatedNode;
  chokeMultiplier: number;
  rainRate: number;
  onClose: () => void;
  onDispatch: (node: CalculatedNode) => void;
  dispatching: boolean;
}

export function NodeSheet({
  node,
  chokeMultiplier,
  rainRate,
  onClose,
  onDispatch,
  dispatching,
}: NodeSheetProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Generate 60-minute history curve ending at current node FRI
  const chartData = useMemo(() => {
    const points = [];
    const base = node.fri;
    for (let i = 59; i >= 0; i--) {
      // Small simulated volatility that converges to current FRI
      const noise = (Math.sin(i * 0.4) * 0.08) * (i / 60);
      const val = Math.max(0.05, Math.min(0.98, base - (i * 0.005) + noise));
      points.push({
        minute: `-${i}m`,
        fri: parseFloat(val.toFixed(2)),
      });
    }
    // Final point exact current fri
    points[points.length - 1].fri = parseFloat(node.fri.toFixed(2));
    return points;
  }, [node.fri]);

  const vPoolVal = Math.min(1, (node.base_vPooling || 0.25) * chokeMultiplier);
  const aImpVal = Math.min(1, (node.base_aImpedance || 0.3) * chokeMultiplier);
  const rRateVal = Math.min(1, rainRate);

  const getFriColor = (score: number) => {
    if (score >= 0.86) return "#ef4444";
    if (score >= 0.66) return "#f59e0b";
    return "#22c55e";
  };

  return (
    <div
      className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-sheet-title"
        className="w-full md:max-w-[480px] max-h-[90dvh] overflow-y-auto custom-scrollbar bg-[#141414] border border-[#262626] rounded-t-[24px] md:rounded-[24px] p-5 flex flex-col gap-3 shadow-2xl animate-in fade-in duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#262626]/60">
          <div className="min-w-0 pr-2">
            <h3 id="node-sheet-title" className="font-bold text-[16px] text-white tracking-tight truncate">
              {node.name}
            </h3>
            <span className="text-[11px] text-[#999999] truncate block">
              {node.region} · {node.drainType}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#999999] hover:text-white rounded-full bg-[#1c1c1c] shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* Primary FRI Metric */}
      <div className="flex items-center justify-between py-1 border-b border-[#1a1a1a]">
        <div>
          <span className="text-[13px] text-[#999999] block">Flood Risk Index</span>
          <span className="text-[11px] text-[#666666]">Formula: 0.55*V + 0.35*A + 0.10*R</span>
        </div>
        <span
          className="font-mono font-bold text-[22px]"
          style={{ color: getFriColor(node.fri) }}
        >
          {node.fri.toFixed(2)}
        </span>
      </div>

      {/* 60-Minute FRI Line Chart */}
      <div className="py-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] font-medium text-[#999999]">
            60-Minute FRI Trend
          </span>
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#666666]">
            <span className="text-[#22c55e]">Normal 0.36</span>
            <span className="text-[#f59e0b]">Mod 0.66</span>
            <span className="text-[#ef4444]">Crit 0.86</span>
          </div>
        </div>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <YAxis domain={[0, 1]} tick={{ fill: "#666666", fontSize: 10 }} ticks={[0, 0.36, 0.66, 0.86, 1]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#141414",
                  borderColor: "#262626",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#999999" }}
                formatter={(val: unknown) => [
                  typeof val === "number" ? `FRI: ${val.toFixed(2)}` : String(val),
                  "Risk",
                ]}
              />
              <ReferenceLine y={0.36} stroke="#22c55e" strokeDasharray="3 3" opacity={0.4} />
              <ReferenceLine y={0.66} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.4} />
              <ReferenceLine y={0.86} stroke="#ef4444" strokeDasharray="3 3" opacity={0.6} />
              <Line
                type="monotone"
                dataKey="fri"
                stroke={getFriColor(node.fri)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Component Telemetry Bars */}
      <div className="flex flex-col gap-2 py-1">
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-[#999999]">V_pooling (Visual Surface)</span>
            <span className="font-mono text-white">{vPoolVal.toFixed(2)}</span>
          </div>
          <div className="w-full bg-[#1c1c1c] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${vPoolVal * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-[#999999]">A_impedance (Acoustic Choke)</span>
            <span className="font-mono text-white">{aImpVal.toFixed(2)}</span>
          </div>
          <div className="w-full bg-[#1c1c1c] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${aImpVal * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-[#999999]">Rain Rate</span>
            <span className="font-mono text-white">{rRateVal.toFixed(2)}</span>
          </div>
          <div className="w-full bg-[#1c1c1c] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-indigo-400 transition-all duration-300"
              style={{ width: `${rRateVal * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Animated Acoustic Waveform */}
      <div className="bg-[#1c1c1c] p-2.5 rounded-[12px] border border-[#262626]/80 flex flex-col gap-1.5">
        <span className="text-[10px] text-[#999999] font-medium tracking-wide">
          Acoustic Sensor Stream (YAMNet 200Hz - 8kHz)
        </span>
        <div className="flex items-end justify-between h-7 gap-1 px-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: [
                  `${15 + Math.random() * 20}%`,
                  `${Math.min(95, (aImpVal * 70) + Math.random() * 30)}%`,
                  `${20 + Math.random() * 25}%`,
                ],
              }}
              transition={{
                repeat: Infinity,
                duration: 0.8 + (i % 5) * 0.2,
                ease: "easeInOut",
              }}
              className={`w-full rounded-t ${
                aImpVal > 0.7
                  ? "bg-[#ef4444]"
                  : aImpVal > 0.4
                  ? "bg-[#f59e0b]"
                  : "bg-[#0099ff]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Local Weather Section */}
      {node.localWeather && (
        <div className="bg-[#1c1c1c] p-3 rounded-[12px] border border-[#262626] flex items-center justify-around text-xs">
          <div className="flex items-center gap-1.5 text-white">
            <Thermometer className="w-3.5 h-3.5 text-[#0099ff]" />
            <span className="font-mono">{node.localWeather.tempC}°C</span>
          </div>
          <div className="flex items-center gap-1.5 text-white">
            <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono">{node.localWeather.rainMmH} mm/h</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#999999]">
            <Wind className="w-3.5 h-3.5" />
            <span className="font-mono">{node.localWeather.windKmh} km/h</span>
          </div>
          {typeof node.localWeather.precipProbMax === "number" && (
            <div className="flex items-center gap-1 text-[#999999]">
              <Droplets className="w-3 h-3" />
              <span className="font-mono">{node.localWeather.precipProbMax}%</span>
            </div>
          )}
        </div>
      )}

      {/* Dispatch Action Button */}
      {node.id !== "user" && (
        <button
          onClick={() => onDispatch(node)}
          disabled={dispatching}
          className="mt-1 w-full bg-[#7f1d1d] hover:bg-[#991b1b] active:scale-[0.98] border border-[#ef4444] text-[#fca5a5] font-bold py-3 px-4 rounded-full flex items-center justify-center gap-2 text-sm transition-all min-h-[44px]"
        >
          <Truck className="w-4 h-4" />
          <span>
            {dispatching ? "Dispatching..." : "Dispatch Hydro-Jet Truck"}
          </span>
        </button>
      )}
      </div>
    </div>
  );
}
