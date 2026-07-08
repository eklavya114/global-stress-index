"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGlobalStats, fetchGlobalImpact, triggerScrapers } from "@/lib/api";
import { RefreshCw, Activity } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setTime(
        `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

interface ThreatConfig {
  label: string;
  color: string;
  bg: string;
  level: number;
  description: string;
}

function getThreat(avg: number): ThreatConfig {
  if (avg < 20) return { label: "MINIMAL",  color: "#00ff88", bg: "#00ff8808", level: 1, description: "Global systems stable" };
  if (avg < 35) return { label: "LOW",       color: "#66ff66", bg: "#66ff6608", level: 2, description: "Minor localized tensions" };
  if (avg < 50) return { label: "MODERATE",  color: "#ffcc00", bg: "#ffcc0010", level: 3, description: "Multiple stress clusters" };
  if (avg < 65) return { label: "ELEVATED",  color: "#ff8800", bg: "#ff880012", level: 4, description: "Active regional crises" };
  if (avg < 80) return { label: "HIGH",      color: "#ff3355", bg: "#ff335515", level: 5, description: "Severe multi-region stress" };
  return         { label: "CRITICAL",  color: "#dc2626", bg: "#dc262618", level: 6, description: "Global crisis conditions" };
}

// Animated number that counts up
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const startRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const start = startRef.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (end - start) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(update);
      else startRef.current = end;
    };

    frameRef.current = requestAnimationFrame(update);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value]);

  return <>{displayed.toFixed(decimals)}</>;
}

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(0) + "M";
  return String(n);
}

export default function Header() {
  const clock = useClock();
  const [refreshing, setRefreshing] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["global-stats"],
    queryFn: fetchGlobalStats,
    refetchInterval: 60000,
  });

  const { data: impact } = useQuery({
    queryKey: ["impact"],
    queryFn: fetchGlobalImpact,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const avg = stats?.avg_pulse_score ?? 0;
  const threat = getThreat(avg);

  const handleRefresh = async () => {
    setRefreshing(true);
    await triggerScrapers();
    setTimeout(() => setRefreshing(false), 3000);
  };

  return (
    <motion.header
      initial={{ y: -52, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="flex items-center justify-between px-4 flex-shrink-0 relative overflow-hidden"
      style={{
        background: "rgba(2, 5, 14, 0.99)",
        borderBottom: "1px solid rgba(0, 180, 255, 0.1)",
        minHeight: 52,
      }}
    >
      {/* Subtle scan line */}
      <motion.div
        className="absolute inset-x-0 h-px pointer-events-none"
        style={{ background: "rgba(0,212,255,0.08)", top: "100%" }}
      />

      {/* ── Logo ── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.35, 0.2] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            style={{ background: "radial-gradient(circle, #00d4ff55, transparent 70%)" }}
          />
          <svg viewBox="0 0 24 24" className="w-5 h-5 relative" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#00d4ff" strokeWidth="1.4" />
            <ellipse cx="12" cy="12" rx="4" ry="10" stroke="#00d4ff" strokeWidth="0.9" opacity="0.45" />
            <line x1="2" y1="12" x2="22" y2="12" stroke="#00d4ff" strokeWidth="0.9" opacity="0.45" />
            <circle cx="12" cy="12" r="2" fill="#00d4ff" opacity="0.7" />
          </svg>
        </div>

        <div>
          <div className="text-sm font-bold tracking-wider logo-shimmer">EARTH PULSE</div>
          <div className="text-xs text-slate-800 -mt-0.5 tracking-widest" style={{ fontSize: "0.52rem" }}>
            CIVILIZATION STRESS INDEX
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* UTC clock */}
        <div
          className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded font-mono text-xs"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#374151",
            fontSize: "0.65rem",
            letterSpacing: "0.06em",
          }}
        >
          <Activity className="w-2.5 h-2.5" style={{ color: "#22d36b" }} />
          {clock}
        </div>
      </div>

      {/* ── Center: Threat level ── */}
      <div className="flex items-center gap-4">
        {/* Main threat display */}
        <div
          className="flex items-center gap-3 px-4 py-1.5 rounded-lg"
          style={{
            background: threat.bg,
            border: `1px solid ${threat.color}28`,
            boxShadow: `0 0 24px ${threat.color}12`,
          }}
        >
          {/* Signal bars */}
          <div className="flex items-end gap-0.5 h-5">
            {[1, 2, 3, 4, 5, 6].map(l => (
              <motion.div
                key={l}
                className="w-1 rounded-sm"
                animate={{ opacity: l <= threat.level ? 1 : 0.08 }}
                transition={{ duration: 0.4 }}
                style={{
                  height: `${28 + l * 12}%`,
                  background: l <= threat.level ? threat.color : "rgba(255,255,255,0.06)",
                  boxShadow: l <= threat.level ? `0 0 4px ${threat.color}66` : "none",
                }}
              />
            ))}
          </div>

          <div>
            <div className="text-xs text-slate-700 tracking-widest" style={{ fontSize: "0.52rem" }}>
              GLOBAL THREAT
            </div>
            <div
              className="text-xs font-bold tracking-wider"
              style={{ color: threat.color, textShadow: `0 0 12px ${threat.color}66`, lineHeight: 1.1 }}
            >
              {threat.label}
            </div>
            <div className="text-xs text-slate-700" style={{ fontSize: "0.52rem" }}>
              {threat.description}
            </div>
          </div>

          <div
            className="text-2xl font-black font-mono tabular-nums"
            style={{ color: threat.color, textShadow: `0 0 20px ${threat.color}55`, lineHeight: 1 }}
          >
            <AnimatedNumber value={avg} decimals={1} />
          </div>
        </div>

        {/* Secondary stats */}
        <div className="hidden xl:flex items-center gap-4">
          {/* Countries scored */}
          {stats && (
            <div
              className="text-center px-3 py-1.5 rounded"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="text-xs text-slate-700 tracking-widest" style={{ fontSize: "0.52rem" }}>NATIONS</div>
              <div className="text-sm font-bold text-slate-300 tabular-nums font-mono">
                {stats.countries_scored}
                <span className="text-slate-700 font-normal text-xs">/{stats.total_countries}</span>
              </div>
            </div>
          )}

          {/* People in crisis */}
          {impact && impact.people_in_crisis > 0 && (
            <div
              className="text-center px-3 py-1.5 rounded"
              style={{ background: "rgba(255,51,85,0.05)", border: "1px solid rgba(255,51,85,0.12)" }}
            >
              <div className="text-xs text-slate-700 tracking-widest" style={{ fontSize: "0.52rem" }}>PEOPLE IN CRISIS</div>
              <div className="text-sm font-bold font-mono tabular-nums" style={{ color: "#ff6680" }}>
                {fmt(impact.people_in_crisis)}
              </div>
            </div>
          )}

          {/* Highest risk country */}
          {stats?.highest_stress && (
            <div
              className="text-center px-3 py-1.5 rounded"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="text-xs text-slate-700 tracking-widest" style={{ fontSize: "0.52rem" }}>HIGHEST RISK</div>
              <div className="text-sm font-bold text-red-400 truncate max-w-[90px]">
                {stats.highest_stress.name}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Controls ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Live badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded" style={{ background: "rgba(34,211,107,0.06)", border: "1px solid rgba(34,211,107,0.12)" }}>
          <div className="relative live-dot">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs text-emerald-500 tracking-widest hidden sm:block" style={{ fontSize: "0.62rem" }}>
            LIVE
          </span>
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all disabled:opacity-40"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            color: "#475569",
          }}
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline text-xs">{refreshing ? "Fetching…" : "Refresh"}</span>
        </button>
      </div>
    </motion.header>
  );
}
