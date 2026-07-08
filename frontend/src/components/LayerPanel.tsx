"use client";

import { motion } from "framer-motion";
import type { DimensionKey, CountryScore } from "@/types";
import {
  Shield,
  Wheat,
  TrendingDown,
  Activity,
  MapPin,
  Layers,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

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
}

const DIMENSIONS = [
  { key: "pulse" as DimensionKey,    label: "Pulse Score",   icon: Activity,     color: "#00d4ff", desc: "Overall stress" },
  { key: "conflict" as DimensionKey, label: "Conflict",      icon: Shield,       color: "#ff3355", desc: "GDELT + ACLED" },
  { key: "food" as DimensionKey,     label: "Food Stress",   icon: Wheat,        color: "#ff8800", desc: "FAO index" },
  { key: "economic" as DimensionKey, label: "Economic",      icon: TrendingDown, color: "#3b82f6", desc: "GDP, inflation" },
];

function riskCount(scores: CountryScore[], min: number, max: number) {
  return scores.filter(s => {
    const p = s.pulse_score;
    return p != null && p >= min && p < max;
  }).length;
}

export default function LayerPanel({ dimension, onDimensionChange, layers, onLayersChange, scores }: Props) {
  const [open, setOpen] = useState(true);

  const toggle = (key: keyof LayerState) => {
    onLayersChange({ ...layers, [key]: !layers[key] });
  };

  const critical = riskCount(scores, 75, 101);
  const high     = riskCount(scores, 55, 75);
  const moderate = riskCount(scores, 35, 55);
  const stable   = riskCount(scores, 0, 35);

  return (
    <motion.aside
      initial={{ x: -260, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col flex-shrink-0 overflow-y-auto"
      style={{
        width: 220,
        background: "rgba(2, 8, 20, 0.94)",
        borderRight: "1px solid rgba(0, 180, 255, 0.1)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Layers className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Layers
        </span>
      </div>

      {/* Dimension selector */}
      <div className="px-3 py-3">
        <div className="text-xs text-slate-600 tracking-widest uppercase mb-2 px-1">View Mode</div>
        <div className="space-y-1">
          {DIMENSIONS.map(({ key, label, icon: Icon, color, desc }) => {
            const active = dimension === key;
            return (
              <button
                key={key}
                onClick={() => onDimensionChange(key)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                style={{
                  background: active ? `${color}18` : "transparent",
                  border: active ? `1px solid ${color}35` : "1px solid transparent",
                }}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: active ? color : "#475569" }} />
                <div>
                  <div className="text-xs font-medium" style={{ color: active ? "#e2e8f0" : "#64748b" }}>
                    {label}
                  </div>
                  <div className="text-xs text-slate-700">{desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Layer toggles */}
      <div
        className="px-3 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="text-xs text-slate-600 tracking-widest uppercase mb-2 px-1">Display</div>
        <div className="space-y-1.5">
          {[
            { key: "scores" as keyof LayerState, label: "Stress Heatmap", color: "#00d4ff" },
            { key: "markers" as keyof LayerState, label: "Hotspot Markers", color: "#ff3355" },
            { key: "borders" as keyof LayerState, label: "Country Borders",  color: "#334155" },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: layers[key] ? "rgba(255,255,255,0.04)" : "transparent",
              }}
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
              <span className="text-xs" style={{ color: layers[key] ? "#94a3b8" : "#475569" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Risk distribution */}
      <div
        className="px-3 py-3 mt-auto"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="text-xs text-slate-600 tracking-widest uppercase mb-2.5 px-1">Risk Distribution</div>
        <div className="space-y-2">
          {[
            { label: "Critical (75+)", count: critical, color: "#7f1d1d", bg: "#ff333520" },
            { label: "High (55–75)",   count: high,     color: "#ea580c", bg: "#ea580c18" },
            { label: "Moderate",       count: moderate, color: "#ca8a04", bg: "#ca8a0415" },
            { label: "Stable (<35)",   count: stable,   color: "#166534", bg: "#16653418" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs text-slate-600">{label}</span>
              </div>
              <span
                className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                style={{ color, background: bg }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>

        {scores.length > 0 && (
          <div className="mt-3 text-xs text-slate-700 px-1">
            {scores.length} countries scored
          </div>
        )}
      </div>
    </motion.aside>
  );
}
