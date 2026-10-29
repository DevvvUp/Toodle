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
    <div className="fx-fade min-h-[100dvh] flex flex-col items-center justify-center px-md py-xl pt-safe pb-safe overflow-x-clip">
      <div className="w-full max-w-[480px] sm:max-w-[600px] lg:max-w-[720px] flex flex-col items-center justify-center">

        {/* Logo */}
        <div className="w-16 h-16 relative mb-lg">
          <Image
            src="/brand/toodle-logo-white.png"
            alt="Toodle Logo"
            width={64}
            height={64}
            priority
            className="w-16 h-16 object-contain"
          />
        </div>

        {/* Title & tagline */}
        <h1 className="t-hero text-center text-white mb-xs">Toodle</h1>
        <p className="t-body sm:t-lead-airy text-center text-inkMuted mb-xl max-w-[360px]">
          Predict floods before the street submerges.
        </p>

        {/* 2x2 metric cards */}
        <div className="grid grid-cols-2 gap-sm sm:gap-md w-full mb-xl max-w-[560px]">
          {stats.map((s) => (
            <div
              key={s.label}
              className="glass rounded-lg px-sm py-md flex flex-col items-center justify-center text-center"
            >
              <span className="font-mono font-semibold text-[17px] leading-[1.24] tracking-[-0.374px] text-white tabular-nums">
                {s.value}
              </span>
              <span className="t-caption-strong text-inkMuted mt-xxs">
                {s.label}
              </span>
              <span className="t-micro text-inkFaint mt-xxs">{s.sub}</span>
            </div>
          ))}
        </div>

        {/* Primary action */}
        <Link
          href="/command-center"
          className="w-full max-w-[560px] rounded-pill min-h-[52px] px-xl flex items-center justify-center text-center text-accentInk font-semibold text-[18px] leading-none border border-foil-100/50 bg-gradient-to-r from-accent via-foil-200 to-foil-100 hover:brightness-110 transition-[filter] active:scale-[0.99] mb-sm"
        >
          Launch Command Center
        </Link>

        {/* Secondary action */}
        <Link
          href="/about"
          className="t-caption text-inkMuted hover:text-white transition-colors inline-flex items-center gap-xs min-h-[44px] px-sm"
        >
          Learn about our architecture
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
