"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Globe } from "lucide-react";
import { fetchTrends, fetchEarlyWarnings } from "@/lib/api";
import type { TrendEntry, EarlyWarning } from "@/types";

type Tab = "movers" | "warnings";
type TimeRange = 7 | 30 | 90;

function DeltaBadge({ delta }: { delta: number }) {
  const abs = Math.abs(delta);
  if (delta > 2) return (
    <span className="flex items-center gap-1 text-xs font-mono font-bold" style={{ color: "#ff3355" }}>
      <TrendingUp className="w-3 h-3" /> +{delta.toFixed(1)}
    </span>
  );
  if (delta < -2) return (
    <span className="flex items-center gap-1 text-xs font-mono font-bold" style={{ color: "#00ff88" }}>
      <TrendingDown className="w-3 h-3" /> {delta.toFixed(1)}
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-mono text-slate-600">
      <Minus className="w-3 h-3" /> {abs < 0.1 ? "0.0" : delta.toFixed(1)}
    </span>
  );
}

function ScorePip({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value >= 75 ? "#ff3355" : value >= 55 ? "#ff8800" : value >= 35 ? "#ffcc00" : "#00ff88";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 rounded-full"
        style={{ width: 56, background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color, minWidth: 28 }}>{value.toFixed(0)}</span>
    </div>
  );
}

export default function TrendsView() {
  const [tab, setTab] = useState<Tab>("movers");
  const [days, setDays] = useState<TimeRange>(7);

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ["trends", days],
    queryFn: () => fetchTrends(days),
    refetchInterval: 10 * 60 * 1000,
  });

  const { data: warnings = [], isLoading: warningsLoading } = useQuery({
    queryKey: ["early-warnings", days],
    queryFn: () => fetchEarlyWarnings(days),
    refetchInterval: 10 * 60 * 1000,
  });

  const deteriorating = trends.filter((t) => t.delta > 2).slice(0, 15);
  const improving = trends.filter((t) => t.delta < -2).slice(0, 15);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 overflow-hidden flex flex-col"
      style={{ background: "#020408" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-6">
          {(["movers", "warnings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-sm font-medium tracking-wide transition-colors"
              style={{
                color: tab === t ? "#00d4ff" : "#475569",
                borderBottom: tab === t ? "1.5px solid #00d4ff" : "1.5px solid transparent",
                paddingBottom: 3,
              }}
            >
              {t === "movers" ? "Top Movers" : (
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#ff8800" }} />
                  Early Warnings
                  {warnings.length > 0 && (
                    <span
                      className="text-xs px-1.5 rounded-full font-bold"
                      style={{ background: "rgba(255,136,0,0.15)", color: "#ff8800" }}
                    >
                      {warnings.length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Time range */}
        <div className="flex items-center gap-1">
          {([7, 30, 90] as TimeRange[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="text-xs px-2.5 py-1 rounded transition-all"
              style={{
                background: days === d ? "rgba(0,212,255,0.1)" : "transparent",
                color: days === d ? "#00d4ff" : "#475569",
                border: days === d ? "1px solid rgba(0,212,255,0.25)" : "1px solid transparent",
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "movers" && (
          <div className="grid grid-cols-2 h-full" style={{ gridTemplateRows: "min-content 1fr" }}>
            {/* Deteriorating */}
            <div style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>
              <div
                className="sticky top-0 px-5 py-2.5 flex items-center gap-2"
                style={{
                  background: "rgba(255,51,85,0.06)",
                  borderBottom: "1px solid rgba(255,51,85,0.12)",
                  zIndex: 1,
                }}
              >
                <TrendingUp className="w-3.5 h-3.5" style={{ color: "#ff3355" }} />
                <span className="text-xs font-semibold tracking-wider" style={{ color: "#ff3355" }}>
                  DETERIORATING
                </span>
                <span className="text-xs text-slate-700 ml-auto">{deteriorating.length} countries</span>
              </div>
              {trendsLoading ? (
                <div className="p-8 text-center text-sm text-slate-600">Loading…</div>
              ) : deteriorating.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-600">
                  No significant deterioration in {days} days
                </div>
              ) : (
                deteriorating.map((t, i) => (
                  <TrendRow key={t.iso3} entry={t} rank={i + 1} />
                ))
              )}
            </div>

            {/* Improving */}
            <div>
              <div
                className="sticky top-0 px-5 py-2.5 flex items-center gap-2"
                style={{
                  background: "rgba(0,255,136,0.05)",
                  borderBottom: "1px solid rgba(0,255,136,0.1)",
                  zIndex: 1,
                }}
              >
                <TrendingDown className="w-3.5 h-3.5" style={{ color: "#00ff88" }} />
                <span className="text-xs font-semibold tracking-wider" style={{ color: "#00ff88" }}>
                  IMPROVING
                </span>
                <span className="text-xs text-slate-700 ml-auto">{improving.length} countries</span>
              </div>
              {trendsLoading ? (
                <div className="p-8 text-center text-sm text-slate-600">Loading…</div>
              ) : improving.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-600">
                  No significant improvement in {days} days
                </div>
              ) : (
                improving.map((t, i) => (
                  <TrendRow key={t.iso3} entry={t} rank={i + 1} />
                ))
              )}
            </div>
          </div>
        )}

        {tab === "warnings" && (
          <div className="p-6">
            {warningsLoading ? (
              <div className="text-center text-sm text-slate-600 py-16">Loading early warnings…</div>
            ) : warnings.length === 0 ? (
              <div className="text-center py-16">
                <Globe className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-600">
                  No rapid deterioration detected in the last {days} days.
                </p>
                <p className="text-xs text-slate-700 mt-1">
                  Countries are flagged when pulse score rises ≥8 points.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {warnings.map((w) => (
                  <WarningCard key={w.iso3} warning={w} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TrendRow({ entry, rank }: { entry: TrendEntry; rank: number }) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
    >
      <span className="text-xs text-slate-700 w-5 text-right flex-shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-200 truncate">{entry.name}</div>
        <div className="text-xs text-slate-600 truncate">{entry.region ?? "Unknown region"}</div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <ScorePip value={entry.current_score} />
        <DeltaBadge delta={entry.delta} />
      </div>
    </div>
  );
}

function WarningCard({ warning }: { warning: EarlyWarning }) {
  const urgency = warning.delta >= 15 ? "#ff3355" : warning.delta >= 10 ? "#ff8800" : "#ffcc00";
  return (
    <div
      className="flex items-start gap-4 p-4 rounded-lg"
      style={{
        background: "rgba(255,136,0,0.05)",
        border: `1px solid rgba(255,136,0,0.15)`,
      }}
    >
      <div
        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
        style={{ background: urgency, boxShadow: `0 0 8px ${urgency}88` }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-slate-200">{warning.name}</span>
          <span className="text-xs text-slate-600">{warning.region}</span>
        </div>
        <div className="text-xs text-slate-500">
          Score rose{" "}
          <span style={{ color: urgency }} className="font-bold font-mono">
            +{warning.delta.toFixed(1)} pts
          </span>{" "}
          · Now at{" "}
          <span className="font-bold font-mono text-slate-300">{warning.current_score.toFixed(0)}</span>
          <span className="text-slate-700"> (was {warning.previous_score.toFixed(0)})</span>
        </div>
        <div className="text-xs text-slate-600 mt-1">
          Primary driver: <span className="text-slate-400">{warning.primary_driver}</span>{" "}
          <span className="font-mono">{warning.driver_score.toFixed(0)}/100</span>
        </div>
      </div>
    </div>
  );
}
