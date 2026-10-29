"use client";

import React from "react";
import { usePathname } from "next/navigation";

/** Contour lines for the stream transition. Built once, drawn as one SVG. */
const CONTOURS = Array.from({ length: 18 }, (_, i) => {
  const y = 20 + i * 46;
  const amp = 14 + (i % 4) * 7;
  const phase = (i % 3) * 120;
  let d = `M-100 ${y}`;
  for (let x = -100; x < 1400; x += 150) {
    const dir = ((x + phase) / 150) % 2 < 1 ? -1 : 1;
    d += ` Q ${x + 75} ${y + dir * amp} ${x + 150} ${y}`;
  }
  return d;
});

function StreamTransition({ runId }: { runId: number }) {
  return (
    <div className="fx-stream" key={runId} aria-hidden="true">
      <div className="fx-stream-depth" />
      <svg
        className="fx-stream-contours"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
        height="100%"
      >
        {CONTOURS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={i % 3 === 0 ? "rgba(134,230,221,0.45)" : "rgba(58,169,255,0.38)"}
            strokeWidth={i % 3 === 0 ? 1.4 : 1}
          />
        ))}
      </svg>
      <div className="fx-stream-grating" />
    </div>
  );
}

const BUBBLES = [
  { left: "12%", size: 14, dur: 22, delay: 0 },
  { left: "34%", size: 9, dur: 28, delay: 6 },
  { left: "58%", size: 18, dur: 25, delay: 3 },
  { left: "77%", size: 11, dur: 31, delay: 11 },
  { left: "90%", size: 7, dur: 26, delay: 8 },
];

/**
 * Background liquid morph + per-navigation topographic stream.
 * Mounted once in the root layout; purely decorative, never interactive.
 */
export function FxLayer() {
  const pathname = usePathname();
  const [runId, setRunId] = React.useState(0);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setRunId((n) => n + 1);
  }, [pathname]);

  // Pause every effect while the tab is hidden.
  React.useEffect(() => {
    const sync = () =>
      document.documentElement.classList.toggle("fx-paused", document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <>
      <div className="fx-layer -z-10" aria-hidden="true">
        <div
          className="fx-blob"
          style={{
            top: "-18vh",
            left: "-22vw",
            width: "78vw",
            height: "58vh",
            background:
              "radial-gradient(circle at 40% 40%, var(--foil-500), transparent 70%)",
            animation: "fx-morph-a 44s ease-in-out infinite",
          }}
        />
        <div
          className="fx-blob"
          style={{
            bottom: "-24vh",
            right: "-26vw",
            width: "86vw",
            height: "62vh",
            background:
              "radial-gradient(circle at 55% 45%, var(--foil-700), transparent 72%)",
            animation: "fx-morph-b 58s ease-in-out infinite",
          }}
        />
        <div
          className="fx-blob"
          style={{
            top: "32vh",
            left: "28vw",
            width: "54vw",
            height: "40vh",
            opacity: 0.28,
            background:
              "radial-gradient(circle at 50% 50%, var(--foil-300), transparent 70%)",
            animation: "fx-morph-a 72s ease-in-out infinite reverse",
          }}
        />
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="fx-bubble"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              animation: `fx-bubble ${b.dur}s linear ${b.delay}s infinite`,
            }}
          />
        ))}
      </div>
      {runId > 0 && <StreamTransition runId={runId} />}
    </>
  );
}
