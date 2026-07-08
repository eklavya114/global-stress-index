"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGlobalImpact } from "@/lib/api";
import { motion } from "framer-motion";

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(0) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}

export default function ImpactBar() {
  const { data } = useQuery({
    queryKey: ["impact"],
    queryFn: fetchGlobalImpact,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  if (!data) return null;

  const total = data.total_population_tracked || 1;
  const b = data.buckets;

  const segments = [
    { label: "Critical", value: b.critical, color: "#ff3355" },
    { label: "High",     value: b.high,     color: "#ff8800" },
    { label: "Elevated", value: b.elevated, color: "#ffcc00" },
    { label: "Moderate", value: b.moderate, color: "#66bb6a" },
    { label: "Stable",   value: b.stable,   color: "#00ff88" },
  ];

  return (
    <div
      className="flex-shrink-0 flex items-center gap-4 px-4"
      style={{
        height: 36,
        background: "rgba(2,6,16,0.98)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Label */}
      <div
        className="flex-shrink-0 text-xs tracking-widest"
        style={{ color: "#3D4A5E", fontSize: "0.58rem", letterSpacing: "0.18em" }}
      >
        POPULATION AT RISK
      </div>

      {/* Stacked bar */}
      <div className="flex-1 flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100;
          if (pct < 0.1) return null;
          return (
            <motion.div
              key={seg.label}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full relative group cursor-default"
              style={{ background: seg.color, opacity: 0.85, minWidth: 2 }}
              title={`${seg.label}: ${fmt(seg.value)}`}
            />
          );
        })}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {[segments[0], segments[1]].map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
            <span className="text-xs font-mono" style={{ color: seg.color, fontSize: "0.68rem" }}>
              {fmt(seg.value)}
            </span>
            <span className="text-xs" style={{ color: "#3D4A5E", fontSize: "0.6rem" }}>
              {seg.label.toLowerCase()}
            </span>
          </div>
        ))}
        <div
          className="text-xs font-mono"
          style={{ color: "#ff3355", fontSize: "0.68rem" }}
        >
          {data.crisis_pct}%
          <span className="text-xs ml-1" style={{ color: "#3D4A5E", fontSize: "0.6rem" }}>
            in crisis
          </span>
        </div>
      </div>
    </div>
  );
}
