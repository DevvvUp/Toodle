"use client";
import React from "react";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { TracingBeam } from "@/components/ui/tracing-beam";
import { Clock, Activity, Target, Zap, Server, Phone, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AboutPage() {
  const navItems = [
    { name: "Features", link: "#features" },
    { name: "How it Works", link: "#how-it-works" },
    { name: "Impact", link: "#impact" },
    { name: "App", link: "/command-center" },
  ];

  return (
    <main className="min-h-screen bg-[#000000] text-neutral-300 relative w-full flex flex-col overflow-x-clip">
      <FloatingNav navItems={navItems} />

      {/* HERO WRAPPER */}
      <section className="relative min-h-[100svh] flex flex-col overflow-x-clip pt-16">
        <div className="absolute inset-0 w-full h-full bg-[#000] z-0 [mask-image:radial-gradient(transparent,black)] pointer-events-none" />
        <div className="absolute inset-0 z-0 opacity-40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.08),transparent_40%)] pointer-events-none" />
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        </div>

        <div className="flex-1 flex flex-col max-w-7xl mx-auto px-6 lg:px-8 w-full z-10 relative">
          
          {/* MAIN HERO ROW */}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-12 xl:gap-16 items-center flex-1 py-16 lg:py-20">
            
            {/* LEFT COLUMN */}
            <div className="flex flex-col items-start text-left">
              <Link href="/command-center" className="h-8 px-3 rounded-full border border-white/10 bg-white/5 flex items-center gap-2 text-sm text-neutral-200 hover:bg-white/10 transition-colors mb-6 group">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live storm simulator</span>
                <span className="w-px h-4 bg-white/10 mx-1" />
                <span>Try it now</span>
                <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:text-white transition-colors" />
              </Link>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold text-white tracking-[-0.035em] leading-[1.05] text-balance max-w-[14ch]">
                Predict floods before the street <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">submerges.</span>
              </h1>
              
              <p className="mt-6 text-lg lg:text-xl leading-8 font-normal text-neutral-300 max-w-[34rem]">
                A proactive multi-modal pipeline that fuses CCTV vision and storm-drain acoustics to alert municipal teams before <span className="text-white font-medium">gridlock</span>.
              </p>
              
              <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <Link 
                  href="/command-center"
                  className="w-full sm:w-auto h-12 px-6 rounded-xl bg-white text-neutral-950 text-base font-medium inline-flex items-center justify-center gap-2 transition-all hover:bg-neutral-100 hover:-translate-y-px active:scale-[0.98] ring-1 ring-white/40 ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-cyan-400 group"
                >
                  Launch Command Center
                  <Activity className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link 
                  href="/demo" 
                  className="w-full sm:w-auto h-12 px-6 rounded-xl bg-black text-white border border-white/20 text-base font-medium inline-flex items-center justify-center transition-all hover:bg-white/5 hover:border-white/30 hover:-translate-y-px active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-cyan-400 ring-offset-2 ring-offset-black"
                >
                  Try Live Demo
                </Link>
              </div>
              
              <Link href="/command-center" className="mt-6 text-sm text-neutral-300 hover:text-white transition-colors underline underline-offset-4 group inline-flex items-center gap-1">
                Watch the storm simulate in 10 seconds 
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* RIGHT COLUMN: PREVIEW MASONRY */}
            <div className="relative w-full lg:w-[115%] h-[360px] sm:h-[400px] lg:h-[620px] pointer-events-none select-none aria-hidden" style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 22%), linear-gradient(to top, transparent 0%, black 15%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 22%), linear-gradient(to top, transparent 0%, black 15%)', WebkitMaskComposite: 'source-in', maskComposite: 'intersect' }}>
              <div className="absolute inset-0 grid grid-cols-1 lg:grid-cols-2 gap-4 motion-reduce:transform-none">
                {/* Column 1 */}
                <motion.div 
                  initial={{ opacity: 0, y: 12 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-4 motion-safe:animate-slideUp group-hover:[animation-play-state:paused]"
                >
                  {[1,2].map(key => (
                  <React.Fragment key={key}>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-400 font-mono">Live map</span>
                    <div className="h-48 rounded-2xl border border-white/10 bg-neutral-950 p-2 relative overflow-hidden flex items-center justify-center">
                      <div className="absolute w-64 h-64 bg-cyan-900/20 rounded-full blur-2xl" />
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse ring-4 ring-red-500/20" />
                      <div className="w-3 h-3 bg-amber-500 rounded-full absolute top-10 left-10" />
                      <div className="w-3 h-3 bg-green-500 rounded-full absolute bottom-10 right-10" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-400 font-mono">Dispatch queue</span>
                    <div className="h-32 rounded-2xl border border-white/10 bg-neutral-950 p-4 flex flex-col justify-between">
                       <div className="flex justify-between">
                         <div className="w-24 h-4 bg-white/10 rounded" />
                         <div className="w-8 h-8 rounded-full border-2 border-red-500" />
                       </div>
                       <div className="w-full h-8 bg-blue-600 rounded mt-2" />
                    </div>
                  </div>
                   <div className="flex flex-col gap-1 hidden lg:flex">
                    <span className="text-xs text-neutral-400 font-mono">System Telemetry</span>
                    <div className="h-40 rounded-2xl border border-white/10 bg-neutral-950 p-4">
                       <div className="w-full h-2 bg-white/5 rounded mb-2" />
                       <div className="w-3/4 h-2 bg-white/5 rounded mb-2" />
                       <div className="w-5/6 h-2 bg-white/5 rounded" />
                    </div>
                  </div>
                  </React.Fragment>
                  ))}
                </motion.div>
                
                {/* Column 2 */}
                <motion.div 
                  initial={{ opacity: 0, y: 60 }} 
                  animate={{ opacity: 1, y: 48 }} 
                  transition={{ duration: 0.4, delay: 0.08 }}
                  className="hidden lg:flex flex-col gap-4 motion-safe:animate-slideDown"
                >
                  {[1,2].map(key => (
                  <React.Fragment key={key}>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-400 font-mono">CCTV · Rekognition</span>
                    <div className="h-40 rounded-2xl border border-white/10 bg-neutral-950 p-2 relative">
                      <div className="w-full h-full bg-neutral-900 rounded-xl relative overflow-hidden">
                        <div className="absolute inset-x-4 top-1/3 bottom-4 border border-cyan-400 bg-cyan-400/10"></div>
                        <span className="absolute top-[35%] left-5 bg-cyan-400 text-black text-[10px] px-1 rounded-sm font-bold">Water 94%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-400 font-mono">Acoustic stream</span>
                    <div className="h-32 rounded-2xl border border-white/10 bg-neutral-950 p-4 flex items-end gap-1 opacity-70">
                       {Array.from({length: 12}).map((_, i) => (
                          <div key={i} className="w-3 bg-blue-500 rounded-t" style={{ height: `${Math.random() * 60 + 20}%` }} />
                       ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-400 font-mono">FRI gauge</span>
                    <div className="h-48 rounded-2xl border border-white/10 bg-neutral-950 flex items-center justify-center p-4">
                       <svg className="w-32 h-32" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                          <circle cx="50" cy="50" r="40" stroke="#f97316" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset="60" strokeLinecap="round" transform="rotate(-90 50 50)" />
                       </svg>
                    </div>
                  </div>
                  </React.Fragment>
                  ))}
                </motion.div>
              </div>
            </div>
          </div>

          {/* STATS STRIP */}
          <div className="mt-auto border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 w-full">
            {[
              { label: "Ingestion latency", value: "<2.5s", icon: <Clock className="w-[18px] h-[18px] text-blue-400 opacity-100" /> },
              { label: "Pre-submersion accuracy", value: "88.4%", icon: <Target className="w-[18px] h-[18px] text-cyan-400 opacity-100" /> },
              { label: "Cost per node/hour", value: "$0.003", icon: <Zap className="w-[18px] h-[18px] text-violet-400 opacity-100" /> },
              { label: "Serverless", value: "100%", icon: <Server className="w-[18px] h-[18px] text-emerald-400 opacity-100" /> },
            ].map((stat, i) => (
              <div key={i} className={cn("py-6 lg:py-8 px-4 lg:px-6 flex flex-col gap-2 lg:gap-3", i % 2 !== 0 && "border-l border-white/10", i > 1 && "border-t border-white/10 lg:border-t-0", i > 0 && "lg:border-l lg:border-white/10", i === 0 && "lg:pl-0")}>
                <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  {stat.icon}
                </div>
                <div className="font-mono text-2xl sm:text-3xl lg:text-4xl font-semibold tabular-nums text-white tracking-tight">
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.1em] sm:tracking-[0.14em] font-medium text-neutral-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          
        </div>
      </section>

      {/* SECTIONS DIVIDER */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* FEATURES */}
      <section id="features" className="py-24 md:py-32 px-6 lg:px-8 max-w-7xl mx-auto w-full scroll-mt-24">
        <div className="mb-12 md:mb-16">
           <h3 className="text-xs uppercase tracking-[0.18em] font-medium text-cyan-400 mb-4">Core Technology</h3>
           <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.03em] leading-[1.1] text-white text-balance max-w-3xl">
             Intelligence at the Edge
           </h2>
           <p className="mt-5 text-lg leading-8 text-neutral-300 max-w-2xl">
             Every street corner becomes a proactive sensor. Toodle reuses existing hardware to deliver millisecond-level telemetry.
           </p>
        </div>
        
        <BentoGrid>
          <BentoGridItem 
            title="Visual Perception Engine"
            description="Amazon Rekognition instantly detects surface pooling and calculates the V_pooling index."
            className="md:col-span-2 p-6 md:p-8"
            icon={<Target className="w-6 h-6 text-cyan-400 mb-2" />}
            header={
              <div className="flex flex-1 w-full h-full min-h-[10rem] rounded-2xl bg-neutral-900 border border-white/10 items-center justify-center relative overflow-hidden mb-6">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80')] opacity-30 bg-cover bg-center" />
                <div className="absolute top-4 left-4 border border-cyan-500 bg-cyan-500/20 px-2 py-1 text-xs text-cyan-400 font-mono rounded">
                  Water 94%
                </div>
              </div>
            }
          />
          <BentoGridItem 
            title="Acoustic Drain Intelligence"
            description="SageMaker YAMNet detects gurgles and siltation frequencies to compute A_impedance."
            className="md:col-span-1 p-6 md:p-8"
            icon={<Activity className="w-6 h-6 text-blue-400 mb-2" />}
            header={
              <div className="flex flex-1 w-full h-full min-h-[10rem] rounded-2xl bg-neutral-900 border border-white/10 items-center justify-center overflow-hidden p-4 mb-6">
                <div className="flex gap-1 items-end h-16 w-full opacity-70">
                  {Array.from({length: 20}).map((_, i) => (
                    <motion.div key={i} animate={{ height: [10, Math.random() * 50 + 10, 10] }} transition={{ repeat: Infinity, duration: 1 + Math.random() }} className="w-2 bg-blue-500 rounded-t" />
                  ))}
                </div>
              </div>
            }
          />
          <BentoGridItem 
            title="Instant SMS Dispatch"
            description="Critical alerts via SNS directly to field units."
            className="md:col-span-1 p-6 md:p-8"
            icon={<Phone className="w-6 h-6 text-violet-400 mb-2" />}
          />
          <BentoGridItem 
            title="Multi-Modal Correlation"
            description="Lambda fuses vision and audio into the Flood Risk Index (FRI)."
            className="md:col-span-1 p-6 md:p-8"
            icon={<Zap className="w-6 h-6 text-orange-400 mb-2" />}
          />
          <BentoGridItem 
            title="Zero New Hardware"
            description="Taps into existing municipal CCTV streams without expensive retrofits."
            className="md:col-span-1 p-6 md:p-8"
            icon={<Server className="w-6 h-6 text-green-400 mb-2" />}
          />
        </BentoGrid>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* HOW IT WORKS / TRACING BEAM */}
      <section id="how-it-works" className="py-24 md:py-32 px-6 lg:px-8 w-full scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12 md:mb-16 text-center">
             <h3 className="text-xs uppercase tracking-[0.18em] font-medium text-cyan-400 mb-4">Architecture</h3>
             <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.03em] leading-[1.1] text-white text-balance mx-auto">
               Pipeline Mechanics
             </h2>
          </div>
          <TracingBeam className="px-6">
            <div className="space-y-16">
              {[
                { title: "1. Ingest (Kinesis)", desc: "Existing municipal CCTVs push raw streams and audio to AWS Kinesis Video Streams." },
                { title: "2. Perceive (Rekognition)", desc: "Frames are extracted every 3s. Rekognition identifies 'Water', 'Road', yielding the Pooling ratio (V)." },
                { title: "3. Listen (SageMaker)", desc: "YAMNet model analyzes audio spectrograms. A clear drain sounds like 2.5-8 kHz rushing water. A choked drain gurgles at 200-900 Hz, increasing Impedance (A)." },
                { title: "4. Correlate (Lambda)", desc: "FRI = 0.55*V + 0.35*A + 0.10*R. The score determines the risk tier dynamically." },
                { title: "5. Alert (SNS)", desc: "If FRI > 0.86, SNS pushes a priority SMS to the nearest hydro-jet truck, logged in DynamoDB." }
              ].map((step, i) => (
                <div key={i} className="mb-8">
                  <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">{step.title}</h3>
                  <p className="text-[15px] leading-7 text-neutral-300 max-w-2xl">{step.desc}</p>
                </div>
              ))}
            </div>
          </TracingBeam>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* CTA */}
      <section className="py-24 md:py-32 px-6 lg:px-8 w-full text-center flex flex-col items-center justify-center">
         <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.03em] text-white mb-8">Ready to clear the streets?</h2>
         <Link 
            href="/command-center"
            className="h-12 px-8 rounded-xl bg-white text-neutral-950 text-base font-medium inline-flex items-center justify-center gap-2 transition-all hover:bg-neutral-100 hover:-translate-y-px active:scale-[0.98] ring-1 ring-white/40 ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-cyan-400 group"
          >
            Launch Command Center
            <Activity className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
      </section>
      
      <footer className="py-8 text-center text-[13px] text-neutral-400 border-t border-white/10 bg-[#000]">
        Built at DTU Environmental Hacks 2026
      </footer>
    </main>
  );
}
