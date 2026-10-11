import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  const stats = [
    { value: "<2.5s", label: "Latency", sub: "41 Sensor Nodes" },
    { value: "14 FPS", label: "Edge Vision", sub: "88.4% Accuracy" },
    { value: "0–100", label: "Flood Risk Index", sub: "Multi-Modal Score" },
    { value: "15 min", label: "Dispatch Cooldown", sub: "Hydro-Jet Active" },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#090909] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[480px] min-h-[100dvh] bg-[#090909] flex flex-col items-center justify-center px-6 py-12 relative border-x border-[#262626]/40 shadow-2xl">
        
        {/* Logo */}
        <div className="w-16 h-16 relative mb-6">
          <Image
            src="/brand/toodle-logo-white.png"
            alt="Toodle Logo"
            width={64}
            height={64}
            priority
            className="w-16 h-16 object-contain"
          />
        </div>

        {/* Title & Tagline */}
        <h1 className="text-[30px] font-semibold text-white tracking-[-1px] text-center mb-2">
          Toodle
        </h1>
        <p className="text-[17px] text-[#999999] tracking-[-0.18px] text-center mb-10 max-w-[320px]">
          Predict floods before the street submerges.
        </p>

        {/* 2x2 Metric Cards */}
        <div className="grid grid-cols-2 gap-3 w-full mb-10">
          {stats.map((s, i) => (
            <div
              key={i}
              className="bg-[#141414] border border-[#262626] rounded-[20px] p-4 flex flex-col items-center justify-center text-center"
            >
              <span className="font-mono font-bold text-[18px] text-white tracking-tight">
                {s.value}
              </span>
              <span className="text-[12px] font-medium text-[#999999] tracking-[-0.12px] mt-1">
                {s.label}
              </span>
              <span className="text-[10px] text-[#666666] tracking-[-0.1px] mt-0.5">
                {s.sub}
              </span>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <Link
          href="/command-center"
          className="w-full bg-white text-black font-bold text-[17px] tracking-[-0.5px] rounded-full py-4 text-center hover:bg-neutral-200 transition-colors shadow-lg active:scale-[0.98] min-h-[44px] flex items-center justify-center mb-5"
        >
          Launch Command Center
        </Link>

        {/* Architecture Link */}
        <Link
          href="/about"
          className="text-[13px] text-[#999999] hover:text-white transition-colors inline-flex items-center gap-1.5"
        >
          Learn about our architecture
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
