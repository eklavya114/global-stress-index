"use client";

import { useState } from "react";
import { Layers, Target, Database, LayoutGrid, Bookmark } from "lucide-react";
import type { DimensionKey, CountryScore } from "@/types";
import WatchlistTab from "./WatchlistTab";

export interface LayerState {
  scores: boolean;
  markers: boolean;
  borders: boolean;
}

interface Props {
  dimension: DimensionKey;
  onDimensionChange: (d: DimensionKey) => void;
  layers: LayerState;
  onLayersChange: (l: LayerState) => void;
  scores: CountryScore[];
  onCountryClick?: (c: CountryScore) => void;
}

const BG = "rgba(2,8,20,0.94)";
const BORDER_L = "rgba(0,180,255,0.1)";

const DIMENSIONS: { key: DimensionKey; label: string; color: string }[] = [
  { key: "pulse",    label: "Pulse",    color: "#00d4ff" },
  { key: "conflict", label: "Conflict", color: "#ff3355" },
  { key: "food",     label: "Food",     color: "#ff8800" },
  { key: "economic", label: "Economic", color: "#3b82f6" },
];

function scoreColor(v: number): string {
  return v >= 45 ? "#ff3355" : v >= 30 ? "#ff8800" : v >= 20 ? "#ffcc00" : "#00ff88";
}

function MapTab({ dimension, onDimensionChange, layers, onLayersChange }: Omit<Props, "scores">) {
  const toggle = (key: keyof LayerState) =>
    onLayersChange({ ...layers, [key]: !layers[key] });

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <div className="text-xs tracking-widest uppercase mb-2 px-1" style={{ color: "#475569", fontSize: "0.6rem" }}>
          Dimension
        </div>
        <div className="space-y-0.5">
          {DIMENSIONS.map(({ key, label, color }) => {
            const active = dimension === key;
            return (
              <button
                key={key}
                onClick={() => onDimensionChange(key)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all"
                style={{
                  background: active ? `${color}18` : "transparent",
                  border: active ? `1px solid ${color}35` : "1px solid transparent",
                }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active ? color : "#334155" }} />
                <span className="text-xs font-medium" style={{ color: active ? "#e2e8f0" : "#64748b" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
        <div className="text-xs tracking-widest uppercase mb-2 px-1" style={{ color: "#475569", fontSize: "0.6rem" }}>
          Layers
        </div>
        <div className="space-y-1">
          {(
            [
              { key: "scores"  as keyof LayerState, label: "Scores",  color: "#00d4ff" },
              { key: "markers" as keyof LayerState, label: "Markers", color: "#ff3355" },
              { key: "borders" as keyof LayerState, label: "Borders", color: "#475569" },
            ] as const
          ).map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all"
              style={{ background: layers[key] ? "rgba(255,255,255,0.04)" : "transparent" }}
            >
              <div
                className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  background: layers[key] ? color : "transparent",
                  border: `1px solid ${layers[key] ? color : "#334155"}`,
                }}
              >
                {layers[key] && (
                  <svg viewBox="0 0 8 8" className="w-2 h-2">
                    <polyline points="1,4 3,6 7,2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs" style={{ color: layers[key] ? "#94a3b8" : "#475569" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntelTab({ scores }: { scores: CountryScore[] }) {
  const top8 = [...scores]
    .filter((s) => s.pulse_score != null)
    .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
    .slice(0, 8);

  const regions = ["Africa", "Asia", "Americas", "Europe"] as const;
  const regionAvgs = regions.map((r) => {
    const group = scores.filter((s) => s.region === r && s.pulse_score != null);
    const avg = group.length > 0
      ? group.reduce((sum, s) => sum + (s.pulse_score ?? 0), 0) / group.length
      : null;
    return { region: r, avg };
  });

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <div className="text-xs tracking-widest uppercase mb-2 px-1" style={{ color: "#475569", fontSize: "0.6rem" }}>
          Top Stressed
        </div>
        <div className="space-y-1">
          {top8.map((c, i) => {
            const score = c.pulse_score ?? 0;
            const color = scoreColor(score);
            return (
              <div key={c.iso3} className="flex items-center gap-2 px-1">
                <span className="text-xs font-mono flex-shrink-0" style={{ color: "#334155", width: 14, fontSize: "0.6rem" }}>
                  {i + 1}
                </span>
                <span className="text-xs truncate flex-1" style={{ color: "#94a3b8", maxWidth: 90, fontSize: "0.72rem" }}>
                  {c.name}
                </span>
                <div className="h-1 rounded-full flex-shrink-0" style={{ width: 36, background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(score, 100)}%`, background: `linear-gradient(90deg, ${color}55, ${color})` }} />
                </div>
                <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color, fontSize: "0.7rem", width: 26, textAlign: "right" }}>
                  {score.toFixed(0)}
                </span>
              </div>
            );
          })}
          {top8.length === 0 && (
            <div className="text-xs text-slate-700 px-1 py-2 animate-pulse">Loading…</div>
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
        <div className="text-xs tracking-widest uppercase mb-2 px-1" style={{ color: "#475569", fontSize: "0.6rem" }}>
          Regional Avg
        </div>
        <div className="space-y-1.5">
          {regionAvgs.map(({ region, avg }) => {
            const color = avg != null ? scoreColor(avg) : "#334155";
            return (
              <div key={region} className="flex items-center gap-2 px-1">
                <span className="text-xs flex-1" style={{ color: "#64748b", fontSize: "0.7rem" }}>{region}</span>
                <span className="text-xs font-mono font-bold" style={{ color, fontSize: "0.72rem" }}>
                  {avg != null ? avg.toFixed(1) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DataTab({ scores }: { scores: CountryScore[] }) {
  const sources = [
    { name: "World Bank", updated: "2h ago" },
    { name: "GDELT",      updated: "15m ago" },
    { name: "FAO",        updated: "6h ago" },
    { name: "UNHCR",      updated: "1h ago" },
  ];

  const ranges = [
    { label: "0–10",  min: 0,  max: 10 },
    { label: "10–20", min: 10, max: 20 },
    { label: "20–30", min: 20, max: 30 },
    { label: "30–40", min: 30, max: 40 },
    { label: "40–50", min: 40, max: 50 },
    { label: "50+",   min: 50, max: 101 },
  ];

  const counts = ranges.map(({ min, max }) => ({
    label: min === 50 ? "50+" : `${min}–${max}`,
    count: scores.filter((s) => s.pulse_score != null && s.pulse_score >= min && s.pulse_score < max).length,
  }));

  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <div className="text-xs tracking-widest uppercase mb-2 px-1" style={{ color: "#475569", fontSize: "0.6rem" }}>
          Data Sources
        </div>
        <div className="space-y-1.5">
          {sources.map(({ name, updated }) => (
            <div
              key={name}
              className="flex items-center gap-2 px-2 py-1.5 rounded"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="flex-1">
                <div className="text-xs font-medium" style={{ color: "#94a3b8", fontSize: "0.7rem" }}>{name}</div>
                <div className="text-xs" style={{ color: "#334155", fontSize: "0.6rem" }}>{updated}</div>
              </div>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(0,255,136,0.1)",
                  color: "#00ff88",
                  border: "1px solid rgba(0,255,136,0.2)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.1em",
                }}
              >
                LIVE
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
        <div className="text-xs tracking-widest uppercase mb-2 px-1" style={{ color: "#475569", fontSize: "0.6rem" }}>
          Score Distribution
        </div>
        <div className="space-y-1.5">
          {counts.map(({ label, count }) => {
            const pct = (count / maxCount) * 100;
            const barColor = label === "50+" ? "#ff3355" : label.startsWith("40") ? "#ff8800" : label.startsWith("30") ? "#ffcc00" : "#00ff88";
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="font-mono flex-shrink-0" style={{ color: "#475569", fontSize: "0.6rem", width: 28 }}>{label}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor, opacity: 0.75 }} />
                </div>
                <span className="font-mono flex-shrink-0 text-right" style={{ color: "#64748b", fontSize: "0.62rem", width: 18 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatrixTab({ scores }: { scores: CountryScore[] }) {
  const [hovered, setHovered] = useState<CountryScore | null>(null);

  const sorted = [...scores]
    .filter((s) => s.pulse_score != null)
    .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0));

  const critical = sorted.filter((s) => (s.pulse_score ?? 0) >= 45).length;
  const high     = sorted.filter((s) => (s.pulse_score ?? 0) >= 35 && (s.pulse_score ?? 0) < 45).length;

  function cellColor(v: number): string {
    if (v >= 45) return "#ff3355";
    if (v >= 35) return "#ff8800";
    if (v >= 25) return "#ffcc00";
    if (v >= 12) return "#22d36b";
    return "#0a2416";
  }

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div className="uppercase tracking-widest" style={{ color: "#475569", fontSize: "0.6rem" }}>
        Threat Matrix — {sorted.length} Nations
      </div>

      <div className="flex gap-1.5">
        <div
          className="flex items-center gap-1 px-2 py-1 rounded"
          style={{ background: "rgba(255,51,85,0.08)", border: "1px solid rgba(255,51,85,0.2)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#ff3355" }} />
          <span className="font-mono font-bold" style={{ color: "#ff3355", fontSize: "0.65rem" }}>{critical}</span>
          <span style={{ color: "#475569", fontSize: "0.56rem" }}>CRIT</span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded"
          style={{ background: "rgba(255,136,0,0.08)", border: "1px solid rgba(255,136,0,0.2)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#ff8800" }} />
          <span className="font-mono font-bold" style={{ color: "#ff8800", fontSize: "0.65rem" }}>{high}</span>
          <span style={{ color: "#475569", fontSize: "0.56rem" }}>HIGH</span>
        </div>
      </div>

      <div className="h-8 flex items-center px-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {hovered ? (
          <div className="flex items-center gap-2 w-full">
            <span className="font-mono flex-shrink-0" style={{ color: "#475569", fontSize: "0.58rem" }}>{hovered.iso3}</span>
            <span className="flex-1 truncate" style={{ color: "#94a3b8", fontSize: "0.68rem" }}>{hovered.name}</span>
            <span className="font-mono font-bold flex-shrink-0" style={{ color: cellColor(hovered.pulse_score ?? 0), fontSize: "0.68rem" }}>
              {(hovered.pulse_score ?? 0).toFixed(1)}
            </span>
          </div>
        ) : (
          <span style={{ color: "#334155", fontSize: "0.62rem" }}>Hover a cell for details</span>
        )}
      </div>

      <div className="flex flex-wrap gap-0.5">
        {sorted.map((c) => {
          const score = c.pulse_score ?? 0;
          const color = cellColor(score);
          const intensity = Math.max(0.12, Math.min(score / 50, 1));
          return (
            <div
              key={c.iso3}
              onMouseEnter={() => setHovered(c)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: 13,
                height: 13,
                borderRadius: 2,
                background: color,
                opacity: intensity,
                boxShadow: score >= 45 ? `0 0 5px ${color}90` : score >= 35 ? `0 0 3px ${color}50` : "none",
                cursor: "default",
                flexShrink: 0,
                transition: "transform 0.08s ease, opacity 0.08s ease",
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "scale(1.5)";
                (e.currentTarget as HTMLDivElement).style.opacity = "1";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLDivElement).style.opacity = String(intensity);
              }}
            />
          );
        })}
        {sorted.length === 0 && (
          <div className="text-xs text-slate-700 animate-pulse">Loading data…</div>
        )}
      </div>

      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        {[
          { color: "#0a2416", label: "Low" },
          { color: "#22d36b", label: "Stable" },
          { color: "#ffcc00", label: "Elev." },
          { color: "#ff8800", label: "High" },
          { color: "#ff3355", label: "Crit." },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-0.5">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: "#334155", fontSize: "0.55rem" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type TabKey = "map" | "intel" | "data" | "matrix" | "watch";

const TABS: { key: TabKey; icon: React.ElementType; label: string }[] = [
  { key: "map",    icon: Layers,      label: "MAP" },
  { key: "intel",  icon: Target,      label: "INTEL" },
  { key: "data",   icon: Database,    label: "DATA" },
  { key: "matrix", icon: LayoutGrid,  label: "MATRIX" },
  { key: "watch",  icon: Bookmark,    label: "WATCH" },
];

export default function CommandSidebar({
  dimension,
  onDimensionChange,
  layers,
  onLayersChange,
  scores,
  onCountryClick,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("map");

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        width: 220,
        background: BG,
        borderRight: `1px solid ${BORDER_L}`,
      }}
    >
      <div className="flex items-center flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {TABS.map(({ key, icon: Icon, label }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-all"
              style={{
                color: active ? "#00d4ff" : "#475569",
                borderBottom: active ? "2px solid #00d4ff" : "2px solid transparent",
                background: active ? "rgba(0,212,255,0.04)" : "transparent",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="font-bold" style={{ fontSize: "0.55rem", letterSpacing: "0.1em" }}>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "map"    && <MapTab dimension={dimension} onDimensionChange={onDimensionChange} layers={layers} onLayersChange={onLayersChange} />}
        {activeTab === "intel"  && <IntelTab  scores={scores} />}
        {activeTab === "data"   && <DataTab   scores={scores} />}
        {activeTab === "matrix" && <MatrixTab scores={scores} />}
        {activeTab === "watch"  && <WatchlistTab scores={scores} onCountryClick={onCountryClick ?? (() => {})} />}
      </div>
    </aside>
  );
}
