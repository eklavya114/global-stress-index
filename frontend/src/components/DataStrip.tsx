"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGlobalStats, fetchGlobalImpact } from "@/lib/api";
import { Map, TrendingUp, FlaskConical } from "lucide-react";

interface Props {
  view: "map" | "trends" | "lab";
  onViewChange: (v: "map" | "trends" | "lab") => void;
}

function scoreColor(v: number): string {
  return v >= 45 ? "#ff3355" : v >= 30 ? "#ff8800" : v >= 20 ? "#ffcc00" : "#00ff88";
}

function fmtPop(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(0) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}

export default function DataStrip({ view, onViewChange }: Props) {
  const { data: stats } = useQuery({
    queryKey: ["global-stats"],
    queryFn: fetchGlobalStats,
    refetchInterval: 60000,
    staleTime: 55000,
  });

  const { data: impact } = useQuery({
    queryKey: ["impact"],
    queryFn: fetchGlobalImpact,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const avgScore = stats?.avg_pulse_score ?? null;
  const highestName = stats?.highest_stress?.name ?? null;
  const highestScore = stats?.highest_stress?.pulse_score ?? null;
  const scored = stats?.countries_scored ?? null;
  const total = stats?.total_countries ?? null;
  const crisis = impact?.people_in_crisis ?? null;
  const highestIsCritical = highestScore != null && highestScore > 45;

  const VIEW_TABS = [
    { key: "map"    as const, label: "Map",    icon: Map },
    { key: "trends" as const, label: "Trends", icon: TrendingUp },
    { key: "lab"    as const, label: "Lab",    icon: FlaskConical },
  ];

  return (
    <div
      className="flex items-center flex-shrink-0 overflow-hidden"
      style={{
        height: 44,
        background: "rgba(2,6,16,0.98)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* View tabs */}
      <div
        className="flex items-center flex-shrink-0 h-full"
        style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {VIEW_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className="flex items-center gap-1.5 px-4 h-full text-xs font-medium transition-all"
            style={{
              color: view === key ? "#00d4ff" : "#475569",
              borderBottom: view === key ? "2px solid #00d4ff" : "2px solid transparent",
              background: view === key ? "rgba(0,212,255,0.05)" : "transparent",
            }}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Metric pills */}
      <div className="flex items-center h-full flex-shrink-0">
        {/* Global Index */}
        {avgScore != null && (
          <>
            <div
              className="flex items-center gap-2 px-3 h-full"
              style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span
                className="uppercase tracking-widest"
                style={{ color: "#334155", fontSize: "0.55rem" }}
              >
                Global Index
              </span>
              <span
                className="font-mono font-bold text-xs"
                style={{ color: scoreColor(avgScore) }}
              >
                {avgScore.toFixed(1)}
              </span>
            </div>
          </>
        )}

        {/* Critical */}
        {highestScore != null && (
          <div
            className="flex items-center gap-2 px-3 h-full"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span
              className="uppercase tracking-widest"
              style={{
                color: highestIsCritical ? "#ff335580" : "#334155",
                fontSize: "0.55rem",
              }}
            >
              {highestIsCritical ? "CRITICAL" : "STATUS"}
            </span>
            <span
              className="font-mono font-bold text-xs"
              style={{ color: highestIsCritical ? "#ff3355" : "#64748b" }}
            >
              {highestIsCritical ? "YES" : "OK"}
            </span>
          </div>
        )}

        {/* At Risk */}
        {crisis != null && (
          <div
            className="flex items-center gap-2 px-3 h-full"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span
              className="uppercase tracking-widest"
              style={{ color: "#334155", fontSize: "0.55rem" }}
            >
              At Risk
            </span>
            <span className="font-mono font-bold text-xs" style={{ color: "#ff8800" }}>
              {fmtPop(crisis)}
            </span>
          </div>
        )}

        {/* Highest */}
        {highestName != null && highestScore != null && (
          <div
            className="flex items-center gap-2 px-3 h-full"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span
              className="uppercase tracking-widest"
              style={{ color: "#334155", fontSize: "0.55rem" }}
            >
              Highest
            </span>
            <span
              className="font-mono text-xs truncate"
              style={{
                color: scoreColor(highestScore),
                maxWidth: 80,
              }}
              title={highestName}
            >
              {highestName.slice(0, 12)}
            </span>
            <span
              className="font-mono font-bold text-xs"
              style={{ color: scoreColor(highestScore) }}
            >
              {highestScore.toFixed(0)}
            </span>
          </div>
        )}

        {/* Scored */}
        {scored != null && total != null && (
          <div
            className="flex items-center gap-2 px-3 h-full"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span
              className="uppercase tracking-widest"
              style={{ color: "#334155", fontSize: "0.55rem" }}
            >
              Scored
            </span>
            <span className="font-mono font-bold text-xs" style={{ color: "#64748b" }}>
              {scored}/{total}
            </span>
            <span
              className="uppercase tracking-widest"
              style={{ color: "#1e293b", fontSize: "0.5rem" }}
            >
              Nations
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
