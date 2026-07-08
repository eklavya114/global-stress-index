"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical,
  Download,
  Copy,
  CheckCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Sigma,
  Beaker,
  BookOpen,
  Quote,
} from "lucide-react";
import type { CountryScore } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Anomaly {
  iso3: string;
  name: string;
  region: string | null;
  current_score: number;
  historical_mean: number;
  deviation: number;
  sigma: number;
  direction: "spike" | "dip";
}

interface CorrelationCountry {
  iso3: string;
  name: string;
  score: number;
}

interface CorrelationPair {
  a_iso3: string;
  b_iso3: string;
  correlation: number;
  n_points: number;
}

interface CorrelationsData {
  countries: CorrelationCountry[];
  pairs: CorrelationPair[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  scores: CountryScore[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function scoreColor(v: number): string {
  if (v >= 45) return "#ff3355";
  if (v >= 35) return "#ff8800";
  if (v >= 25) return "#ffcc00";
  if (v >= 15) return "#3b82f6";
  return "#00ff88";
}

function tierLabel(v: number): string {
  if (v >= 45) return "CRITICAL";
  if (v >= 35) return "HIGH";
  if (v >= 25) return "ELEVATED";
  if (v >= 15) return "MODERATE";
  return "STABLE";
}

function corrColor(c: number): string {
  if (c >= 0.7) return "#ff3355";
  if (c >= 0.4) return "#ff8800";
  if (c >= 0.1) return "#334155";
  if (c >= -0.1) return "#1e293b";
  if (c >= -0.4) return "#1e3a5f";
  return "#3b82f6";
}

function corrTextColor(c: number): string {
  if (Math.abs(c) >= 0.4) return "rgba(226,232,240,0.9)";
  return "rgba(100,116,139,0.7)";
}

function computeStats(scores: CountryScore[]) {
  const vals = scores
    .map((s) => s.pulse_score)
    .filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  const variance =
    vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const std = Math.sqrt(variance);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const tiers = {
    critical: vals.filter((v) => v >= 45).length,
    high: vals.filter((v) => v >= 35 && v < 45).length,
    elevated: vals.filter((v) => v >= 25 && v < 35).length,
    moderate: vals.filter((v) => v >= 15 && v < 25).length,
    stable: vals.filter((v) => v < 15).length,
  };
  const total = vals.length;
  return { mean, median, std, min, max, tiers, total };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 mb-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 8 }}
    >
      <span
        className="uppercase tracking-widest font-semibold"
        style={{ color: "#00d4ff", fontSize: "0.6rem", letterSpacing: "0.14em" }}
      >
        {children}
      </span>
    </div>
  );
}

function ColumnHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className="flex-shrink-0 px-4 py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <Icon className="w-3.5 h-3.5" style={{ color: "#00d4ff" }} />
        <span
          className="font-semibold tracking-wider uppercase"
          style={{ color: "#e2e8f0", fontSize: "0.7rem", letterSpacing: "0.1em" }}
        >
          {title}
        </span>
      </div>
      <p className="text-xs" style={{ color: "#475569", paddingLeft: 18 }}>
        {subtitle}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      className="mx-3 mb-2 rounded-lg p-3"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="h-3 rounded"
          style={{ width: 96, background: "rgba(255,255,255,0.06)" }}
        />
        <div
          className="h-4 rounded"
          style={{ width: 44, background: "rgba(255,255,255,0.04)" }}
        />
      </div>
      <div
        className="h-2 rounded mb-1"
        style={{ width: 72, background: "rgba(255,255,255,0.04)" }}
      />
      <div
        className="h-1.5 rounded mt-2"
        style={{ width: "100%", background: "rgba(255,255,255,0.03)" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Anomaly Card
// ---------------------------------------------------------------------------

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const isSpike = anomaly.direction === "spike";
  const accentColor = isSpike ? "#ff3355" : "#00ff88";
  const deviationPct = Math.min(
    100,
    (Math.abs(anomaly.deviation) / (anomaly.historical_mean || 1)) * 100
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mb-2 rounded-lg p-3 cursor-default"
      style={{
        background: `rgba(${isSpike ? "255,51,85" : "0,255,136"},0.04)`,
        border: `1px solid rgba(${isSpike ? "255,51,85" : "0,255,136"},0.1)`,
      }}
    >
      {/* Row 1: name + badge */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <span
            className="text-xs font-semibold truncate block"
            style={{ color: "#e2e8f0", maxWidth: 120 }}
          >
            {anomaly.name}
          </span>
          <span
            className="font-mono"
            style={{ color: "#475569", fontSize: "0.58rem" }}
          >
            {anomaly.iso3}
          </span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded flex-shrink-0"
          style={{
            background: `rgba(${isSpike ? "255,51,85" : "0,255,136"},0.12)`,
            border: `1px solid rgba(${isSpike ? "255,51,85" : "0,255,136"},0.2)`,
          }}
        >
          {isSpike ? (
            <TrendingUp className="w-2.5 h-2.5" style={{ color: accentColor }} />
          ) : (
            <TrendingDown className="w-2.5 h-2.5" style={{ color: accentColor }} />
          )}
          <span
            className="font-mono font-bold"
            style={{ color: accentColor, fontSize: "0.58rem" }}
          >
            {isSpike ? "SPIKE ▲" : "DIP ▼"}
          </span>
        </div>
      </div>

      {/* Row 2: sigma */}
      <div className="flex items-center gap-3 mb-2">
        <span className="flex items-center gap-1">
          <Sigma className="w-2.5 h-2.5" style={{ color: "#64748b" }} />
          <span
            className="font-mono font-bold"
            style={{ color: accentColor, fontSize: "0.7rem" }}
          >
            {isSpike ? "+" : ""}{anomaly.sigma.toFixed(1)}σ
          </span>
        </span>
        <span
          className="font-mono"
          style={{ color: "#64748b", fontSize: "0.62rem" }}
        >
          {anomaly.current_score.toFixed(1)}{" "}
          <span style={{ color: "#334155" }}>vs</span>{" "}
          {anomaly.historical_mean.toFixed(1)} avg
        </span>
      </div>

      {/* Deviation bar */}
      <div
        className="relative rounded-sm overflow-hidden"
        style={{ height: 4, background: "rgba(255,255,255,0.04)" }}
      >
        <div
          className="absolute top-0 h-full rounded-sm"
          style={{
            width: `${deviationPct / 2}%`,
            left: isSpike ? "50%" : `calc(50% - ${deviationPct / 2}%)`,
            background: accentColor,
            opacity: 0.7,
            transition: "width 0.4s ease",
          }}
        />
        {/* Center mark */}
        <div
          className="absolute top-0 h-full"
          style={{
            left: "50%",
            width: 1,
            background: "rgba(255,255,255,0.1)",
          }}
        />
      </div>

      {/* Region */}
      {anomaly.region && (
        <div
          className="mt-1.5 font-mono"
          style={{ color: "#334155", fontSize: "0.55rem" }}
        >
          {anomaly.region.toUpperCase()}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Correlation Matrix
// ---------------------------------------------------------------------------

function CorrelationMatrix({ data }: { data: CorrelationsData | undefined }) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    aName: string;
    bName: string;
    corr: number;
  } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Reveal animation: columns appear left-to-right
  useEffect(() => {
    if (data && data.countries.length > 0) {
      const timer = setTimeout(() => setRevealed(true), 80);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (!data || data.countries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "rgba(0,212,255,0.3)", borderTopColor: "transparent" }}
        />
        <span className="text-xs" style={{ color: "#334155" }}>
          Building correlation matrix…
        </span>
      </div>
    );
  }

  const countries = data.countries.slice(0, 15);
  const n = countries.length;
  const CELL = 26;
  const LABEL_W = 36;
  const LABEL_H = 36;
  const svgW = LABEL_W + n * CELL;
  const svgH = LABEL_H + n * CELL;

  // Build lookup map
  const corrMap = new Map<string, number>();
  data.pairs.forEach((p) => {
    corrMap.set(`${p.a_iso3}:${p.b_iso3}`, p.correlation);
    corrMap.set(`${p.b_iso3}:${p.a_iso3}`, p.correlation);
  });

  function getCorr(ai: number, bi: number): number | null {
    if (ai === bi) return 1.0;
    const key = `${countries[ai].iso3}:${countries[bi].iso3}`;
    return corrMap.get(key) ?? null;
  }

  // Top positive + inverse pairs
  const sortedPairs = [...data.pairs].sort((a, b) => b.correlation - a.correlation);
  const topPositive = sortedPairs.filter((p) => p.correlation > 0).slice(0, 5);
  const topInverse = [...sortedPairs]
    .sort((a, b) => a.correlation - b.correlation)
    .filter((p) => p.correlation < 0)
    .slice(0, 5);

  function countryName(iso3: string): string {
    return countries.find((c) => c.iso3 === iso3)?.name ?? iso3;
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      {/* Matrix SVG */}
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          width={svgW}
          height={svgH}
          style={{ display: "block", fontFamily: "monospace" }}
        >
          {/* Column headers */}
          {countries.map((c, ci) => (
            <text
              key={`col-${c.iso3}`}
              x={LABEL_W + ci * CELL + CELL / 2}
              y={LABEL_H - 4}
              textAnchor="middle"
              fill="#475569"
              fontSize={7.5}
              fontFamily="monospace"
            >
              {c.iso3}
            </text>
          ))}

          {/* Row headers */}
          {countries.map((c, ri) => (
            <text
              key={`row-${c.iso3}`}
              x={LABEL_W - 4}
              y={LABEL_H + ri * CELL + CELL / 2 + 3}
              textAnchor="end"
              fill="#475569"
              fontSize={7.5}
              fontFamily="monospace"
            >
              {c.iso3}
            </text>
          ))}

          {/* Cells */}
          {countries.map((rowC, ri) =>
            countries.map((colC, ci) => {
              const corr = getCorr(ri, ci);
              const isDiag = ri === ci;
              const bg = isDiag ? "#1e293b" : corr != null ? corrColor(corr) : "#0f172a";
              const colRevealDelay = ci * 0.04;
              const label =
                isDiag
                  ? rowC.iso3
                  : corr != null
                  ? corr.toFixed(2)
                  : "--";
              const textFill = isDiag ? "#475569" : corr != null ? corrTextColor(corr) : "#1e293b";

              return (
                <g
                  key={`${ri}:${ci}`}
                  style={{
                    opacity: revealed ? 1 : 0,
                    transition: `opacity 0.3s ease ${colRevealDelay}s`,
                  }}
                  onMouseEnter={(e) => {
                    if (isDiag || corr == null) return;
                    const rect = svgRef.current?.getBoundingClientRect();
                    setTooltip({
                      x: e.clientX - (rect?.left ?? 0),
                      y: e.clientY - (rect?.top ?? 0),
                      aName: rowC.name,
                      bName: colC.name,
                      corr,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <rect
                    x={LABEL_W + ci * CELL + 1}
                    y={LABEL_H + ri * CELL + 1}
                    width={CELL - 2}
                    height={CELL - 2}
                    fill={bg}
                    rx={2}
                    style={{ cursor: isDiag ? "default" : "crosshair" }}
                  />
                  {(isDiag || (corr != null && Math.abs(corr) >= 0.15)) && (
                    <text
                      x={LABEL_W + ci * CELL + CELL / 2}
                      y={LABEL_H + ri * CELL + CELL / 2 + 3}
                      textAnchor="middle"
                      fill={textFill}
                      fontSize={isDiag ? 6.5 : 6}
                      fontFamily="monospace"
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.1 }}
              className="absolute pointer-events-none z-20 px-3 py-2 rounded-lg"
              style={{
                left: tooltip.x + 12,
                top: tooltip.y - 40,
                background: "rgba(2,8,20,0.96)",
                border: "1px solid rgba(0,212,255,0.2)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
              }}
            >
              <div className="text-xs text-slate-300 mb-0.5">
                {tooltip.aName} × {tooltip.bName}
              </div>
              <div
                className="font-mono font-bold text-sm"
                style={{ color: corrColor(tooltip.corr) }}
              >
                r = {tooltip.corr.toFixed(3)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { label: "Strong +", color: "#ff3355" },
          { label: "Moderate +", color: "#ff8800" },
          { label: "Weak", color: "#334155" },
          { label: "Moderate −", color: "#1e3a5f" },
          { label: "Strong −", color: "#3b82f6" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: item.color }}
            />
            <span style={{ color: "#475569", fontSize: "0.58rem" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Top pairs */}
      {(topPositive.length > 0 || topInverse.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mt-1">
          {/* Top positive */}
          <div>
            <SectionLabel>Strongest Positive</SectionLabel>
            <div className="space-y-1.5">
              {topPositive.map((p) => (
                <div
                  key={`${p.a_iso3}:${p.b_iso3}`}
                  className="flex items-center justify-between gap-2"
                  style={{ padding: "3px 0" }}
                >
                  <span className="text-xs truncate" style={{ color: "#64748b" }}>
                    {p.a_iso3} ↔ {p.b_iso3}
                  </span>
                  <span
                    className="font-mono font-bold flex-shrink-0"
                    style={{ color: corrColor(p.correlation), fontSize: "0.7rem" }}
                  >
                    {p.correlation.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top inverse */}
          <div>
            <SectionLabel>Strongest Inverse</SectionLabel>
            <div className="space-y-1.5">
              {topInverse.map((p) => (
                <div
                  key={`${p.a_iso3}:${p.b_iso3}`}
                  className="flex items-center justify-between gap-2"
                  style={{ padding: "3px 0" }}
                >
                  <span className="text-xs truncate" style={{ color: "#64748b" }}>
                    {p.a_iso3} ↔ {p.b_iso3}
                  </span>
                  <span
                    className="font-mono font-bold flex-shrink-0"
                    style={{ color: corrColor(p.correlation), fontSize: "0.7rem" }}
                  >
                    {p.correlation.toFixed(2)}
                  </span>
                </div>
              ))}
              {topInverse.length === 0 && (
                <span style={{ color: "#334155", fontSize: "0.65rem" }}>
                  No inverse correlations found
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distribution Histogram (pure SVG)
// ---------------------------------------------------------------------------

function DistributionHistogram({ scores }: { scores: CountryScore[] }) {
  const vals = scores
    .map((s) => s.pulse_score)
    .filter((v): v is number => v != null);

  // 6 bins: 0-10, 10-20, 20-30, 30-40, 40-50, 50+
  const bins = [
    { label: "0–10", min: 0, max: 10, color: "#00ff88" },
    { label: "10–20", min: 10, max: 20, color: "#3b82f6" },
    { label: "20–30", min: 20, max: 30, color: "#ffcc00" },
    { label: "30–40", min: 30, max: 40, color: "#ff8800" },
    { label: "40–50", min: 40, max: 50, color: "#ff3355" },
    { label: "50+", min: 50, max: Infinity, color: "#cc0033" },
  ];

  const counts = bins.map((b) => vals.filter((v) => v >= b.min && v < b.max).length);
  const maxCount = Math.max(...counts, 1);

  const W = 200;
  const H = 56;
  const barW = Math.floor((W - 5 * 4) / 6);

  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      {bins.map((b, i) => {
        const barH = Math.max(3, (counts[i] / maxCount) * (H - 14));
        const x = i * (barW + 4);
        return (
          <g key={b.label}>
            <rect
              x={x}
              y={H - 10 - barH}
              width={barW}
              height={barH}
              fill={b.color}
              opacity={0.75}
              rx={2}
            />
            <text
              x={x + barW / 2}
              y={H - 1}
              textAnchor="middle"
              fill="#334155"
              fontSize={6}
              fontFamily="monospace"
            >
              {b.label}
            </text>
            {counts[i] > 0 && (
              <text
                x={x + barW / 2}
                y={H - 12 - barH}
                textAnchor="middle"
                fill={b.color}
                fontSize={7}
                fontFamily="monospace"
              >
                {counts[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Research Tools Panel
// ---------------------------------------------------------------------------

function ResearchTools({ scores }: { scores: CountryScore[] }) {
  const [copied, setCopied] = useState(false);

  const stats = computeStats(scores);

  function downloadCSV() {
    const header = "iso3,iso2,name,region,pulse_score,conflict_score,food_score,economic_score,data_quality,score_date";
    const rows = scores.map((s) =>
      [
        s.iso3,
        s.iso2,
        `"${s.name}"`,
        `"${s.region ?? ""}"`,
        s.pulse_score ?? "",
        s.conflict_score ?? "",
        s.food_score ?? "",
        s.economic_score ?? "",
        s.data_quality ?? "",
        s.score_date ?? "",
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `earth-pulse-scores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadJSON() {
    const top20 = [...scores]
      .filter((s) => s.pulse_score != null)
      .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
      .slice(0, 20);
    const json = JSON.stringify(top20, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `earth-pulse-top20-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const citation = `Earth Pulse (2026). Global Civilization Stress Index. Retrieved June 2026 from earthpulse.app. Sources: World Bank API, GDELT Project, FAO, UNHCR.`;

  async function copyCitation() {
    await navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tierColors: Record<string, string> = {
    critical: "#ff3355",
    high: "#ff8800",
    elevated: "#ffcc00",
    moderate: "#3b82f6",
    stable: "#00ff88",
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
      {/* QUICK EXPORT */}
      <div>
        <SectionLabel>Quick Export</SectionLabel>
        <div className="space-y-2">
          <button
            onClick={downloadCSV}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all group"
            style={{
              background: "rgba(0,212,255,0.05)",
              border: "1px solid rgba(0,212,255,0.12)",
            }}
          >
            <Download className="w-3 h-3 flex-shrink-0" style={{ color: "#00d4ff" }} />
            <span className="text-xs group-hover:text-slate-200 transition-colors" style={{ color: "#94a3b8" }}>
              Export All Scores (CSV)
            </span>
            <span
              className="ml-auto font-mono"
              style={{ color: "#334155", fontSize: "0.6rem" }}
            >
              {scores.length} rows
            </span>
          </button>

          <button
            onClick={downloadJSON}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all group"
            style={{
              background: "rgba(0,212,255,0.05)",
              border: "1px solid rgba(0,212,255,0.12)",
            }}
          >
            <Download className="w-3 h-3 flex-shrink-0" style={{ color: "#00d4ff" }} />
            <span className="text-xs group-hover:text-slate-200 transition-colors" style={{ color: "#94a3b8" }}>
              Export Top 20 (JSON)
            </span>
            <span
              className="ml-auto font-mono"
              style={{ color: "#334155", fontSize: "0.6rem" }}
            >
              highest stress
            </span>
          </button>
        </div>
      </div>

      {/* SCORE STATISTICS */}
      {stats && (
        <div>
          <SectionLabel>Score Statistics</SectionLabel>
          <div
            className="grid grid-cols-3 gap-1 mb-3 rounded-lg p-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
          >
            {[
              { label: "Mean", value: stats.mean.toFixed(1) },
              { label: "Median", value: stats.median.toFixed(1) },
              { label: "Std Dev", value: stats.std.toFixed(1) },
              { label: "Min", value: stats.min.toFixed(1) },
              { label: "Max", value: stats.max.toFixed(1) },
              { label: "Scored", value: String(stats.total) },
            ].map((s) => (
              <div key={s.label} className="p-1.5 text-center">
                <div
                  className="font-mono font-bold"
                  style={{ color: "#e2e8f0", fontSize: "0.78rem" }}
                >
                  {s.value}
                </div>
                <div
                  className="uppercase tracking-wider"
                  style={{ color: "#334155", fontSize: "0.52rem" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Tier distribution */}
          <div className="space-y-1 mb-3">
            {(["critical", "high", "elevated", "moderate", "stable"] as const).map((tier) => {
              const count = stats.tiers[tier];
              const pct = ((count / stats.total) * 100).toFixed(0);
              const color = tierColors[tier];
              return (
                <div key={tier} className="flex items-center gap-2">
                  <span
                    className="uppercase font-mono w-16 flex-shrink-0"
                    style={{ color, fontSize: "0.58rem" }}
                  >
                    {tier}
                  </span>
                  <div
                    className="flex-1 rounded-sm overflow-hidden"
                    style={{ height: 4, background: "rgba(255,255,255,0.04)" }}
                  >
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${pct}%`,
                        background: color,
                        opacity: 0.7,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                  <span
                    className="font-mono w-8 text-right flex-shrink-0"
                    style={{ color: "#475569", fontSize: "0.62rem" }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Histogram */}
          <DistributionHistogram scores={scores} />
        </div>
      )}

      {/* METHODOLOGY */}
      <div>
        <SectionLabel>Methodology</SectionLabel>
        <div
          className="p-3 rounded-lg space-y-2"
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div
            className="font-mono font-bold"
            style={{ color: "#00d4ff", fontSize: "0.68rem", letterSpacing: "0.04em" }}
          >
            Pulse = 0.40×Conflict + 0.30×Food + 0.30×Economic
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Model", value: "XGBoost ensemble" },
              { label: "Sources", value: "World Bank, GDELT, FAO, UNHCR" },
              { label: "Scale", value: "0–100 (current range ~0–55)" },
              { label: "Critical ≥", value: "45 | High ≥ 35 | Elevated ≥ 25" },
            ].map((row) => (
              <div key={row.label} className="flex gap-2">
                <span
                  className="uppercase tracking-wider flex-shrink-0"
                  style={{ color: "#334155", fontSize: "0.58rem", width: 52 }}
                >
                  {row.label}
                </span>
                <span className="text-xs" style={{ color: "#64748b", lineHeight: 1.4 }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CITE THIS TOOL */}
      <div>
        <SectionLabel>Cite This Tool</SectionLabel>
        <div
          className="p-3 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-start gap-1.5 mb-3">
            <Quote className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#334155" }} />
            <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
              {citation}
            </p>
          </div>
          <button
            onClick={copyCitation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded transition-all"
            style={{
              background: copied ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.04)",
              border: copied
                ? "1px solid rgba(0,255,136,0.2)"
                : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {copied ? (
              <CheckCheck className="w-3 h-3" style={{ color: "#00ff88" }} />
            ) : (
              <Copy className="w-3 h-3" style={{ color: "#64748b" }} />
            )}
            <span
              className="text-xs transition-colors"
              style={{ color: copied ? "#00ff88" : "#64748b" }}
            >
              {copied ? "Copied to clipboard" : "Copy citation"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LabView
// ---------------------------------------------------------------------------

export default function LabView({ scores }: Props) {
  const { data: anomalies = [], isLoading: anomaliesLoading } = useQuery<Anomaly[]>({
    queryKey: ["lab-anomalies"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/lab/anomalies`);
      if (!res.ok) throw new Error("Failed to fetch anomalies");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });

  const { data: correlations, isLoading: corrLoading } = useQuery<CorrelationsData>({
    queryKey: ["lab-correlations"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/lab/correlations`);
      if (!res.ok) throw new Error("Failed to fetch correlations");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });

  const spikes = anomalies.filter((a) => a.direction === "spike");
  const dips = anomalies.filter((a) => a.direction === "dip");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="flex h-full w-full overflow-hidden"
      style={{ background: "rgba(2,8,20,1.0)" }}
    >
      {/* ---------------------------------------------------------------- */}
      {/* LEFT: Statistical Anomalies                                      */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          width: 280,
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <ColumnHeader
          icon={AlertTriangle}
          title="Statistical Anomalies"
          subtitle="Countries deviating from 90-day baseline"
        />

        <div className="flex-1 overflow-y-auto py-3">
          {anomaliesLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          ) : anomalies.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Sigma className="w-6 h-6 mx-auto mb-2" style={{ color: "#1e293b" }} />
              <p className="text-xs" style={{ color: "#334155" }}>
                No anomalies detected against the 90-day baseline.
              </p>
            </div>
          ) : (
            <>
              {spikes.length > 0 && (
                <>
                  <div
                    className="px-4 py-1.5 mb-1"
                    style={{ borderBottom: "1px solid rgba(255,51,85,0.08)" }}
                  >
                    <span
                      className="uppercase tracking-widest"
                      style={{ color: "#ff335566", fontSize: "0.55rem" }}
                    >
                      Spikes — {spikes.length}
                    </span>
                  </div>
                  {spikes.map((a) => (
                    <AnomalyCard key={a.iso3} anomaly={a} />
                  ))}
                </>
              )}
              {dips.length > 0 && (
                <>
                  <div
                    className="px-4 py-1.5 mb-1 mt-2"
                    style={{ borderBottom: "1px solid rgba(0,255,136,0.08)" }}
                  >
                    <span
                      className="uppercase tracking-widest"
                      style={{ color: "#00ff8866", fontSize: "0.55rem" }}
                    >
                      Dips — {dips.length}
                    </span>
                  </div>
                  {dips.map((a) => (
                    <AnomalyCard key={a.iso3} anomaly={a} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* CENTER: Correlation Matrix                                        */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <ColumnHeader
          icon={BarChart3}
          title="Correlation Matrix"
          subtitle="Pulse score correlation across top-15 nations (60d)"
        />

        <div className="flex-1 overflow-y-auto relative">
          {corrLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{
                  borderColor: "rgba(0,212,255,0.15)",
                  borderTopColor: "#00d4ff",
                }}
              />
              <span className="text-xs" style={{ color: "#334155" }}>
                Computing correlations…
              </span>
            </div>
          ) : (
            <div className="pt-4 relative">
              <CorrelationMatrix data={correlations} />
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* RIGHT: Research Tools                                             */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          width: 280,
          borderLeft: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <ColumnHeader
          icon={Beaker}
          title="Research Tools"
          subtitle="Export, statistics, and citation"
        />

        <ResearchTools scores={scores} />
      </div>
    </motion.div>
  );
}
