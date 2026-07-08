"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { X, Search, BarChart2 } from "lucide-react";
import { fetchInsights } from "@/lib/api";
import type { CountryScore, InsightData } from "@/types";

interface Props {
  scores: CountryScore[];
  initial?: CountryScore | null;
  onClose: () => void;
}

const DIMS = [
  { key: "pulse_score",    label: "Pulse",    color: "#00d4ff" },
  { key: "conflict_score", label: "Conflict", color: "#ff3355" },
  { key: "food_score",     label: "Food",     color: "#ffcc00" },
  { key: "economic_score", label: "Economic", color: "#ff8800" },
] as const;

function scoreColor(v: number | null): string {
  if (v === null) return "#475569";
  if (v >= 75) return "#ff3355";
  if (v >= 55) return "#ff8800";
  if (v >= 35) return "#ffcc00";
  return "#00ff88";
}

function RadarBar({ label, a, b, colorA, colorB }: {
  label: string; a: number | null; b: number | null; colorA: string; colorB: string;
}) {
  const valA = a ?? 0;
  const valB = b ?? 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1.5">
        <span className="text-xs font-mono" style={{ color: colorA }}>{valA.toFixed(0)}</span>
        <span className="text-xs text-slate-600 uppercase tracking-widest" style={{ fontSize: "0.6rem" }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: colorB }}>{valB.toFixed(0)}</span>
      </div>
      {/* Double-ended bar */}
      <div className="relative h-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        {/* A: grows from center-left */}
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            right: "50%",
            width: `${valA / 2}%`,
            background: colorA,
            opacity: 0.8,
          }}
        />
        {/* B: grows from center-right */}
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            left: "50%",
            width: `${valB / 2}%`,
            background: colorB,
            opacity: 0.8,
          }}
        />
        {/* Center line */}
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{ left: "50%", background: "rgba(255,255,255,0.15)" }}
        />
      </div>
    </div>
  );
}

function CountrySelector({
  scores,
  value,
  onChange,
  placeholder,
  color,
}: {
  scores: CountryScore[];
  value: CountryScore | null;
  onChange: (c: CountryScore | null) => void;
  placeholder: string;
  color: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = q
    ? scores.filter((s) =>
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.iso3.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 10)
    : scores
        .filter((s) => s.pulse_score !== null)
        .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
        .slice(0, 10);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${value ? color + "40" : "rgba(255,255,255,0.08)"}`,
        }}
      >
        {value ? (
          <>
            <span className="text-xs font-mono text-slate-600">{value.iso3}</span>
            <span className="text-sm text-slate-200 flex-1 truncate">{value.name}</span>
            <span className="text-sm font-bold font-mono flex-shrink-0" style={{ color: scoreColor(value.pulse_score) }}>
              {value.pulse_score?.toFixed(0) ?? "—"}
            </span>
            <X
              className="w-3.5 h-3.5 flex-shrink-0 text-slate-600 hover:text-slate-400"
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            />
          </>
        ) : (
          <>
            <Search className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-sm text-slate-600">{placeholder}</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 left-0 right-0 mt-1 rounded-lg overflow-hidden"
            style={{
              background: "rgba(5, 12, 28, 0.98)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div className="px-3 py-2 border-b border-white/5">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-full bg-transparent text-sm text-slate-300 placeholder-slate-600 outline-none"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.iso3}
                  onClick={() => { onChange(c); setOpen(false); setQ(""); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  <span className="text-xs font-mono text-slate-600 w-9">{c.iso3}</span>
                  <span className="text-sm text-slate-300 flex-1 truncate">{c.name}</span>
                  <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: scoreColor(c.pulse_score) }}>
                    {c.pulse_score?.toFixed(0) ?? "—"}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CompareModal({ scores, initial, onClose }: Props) {
  const [countryA, setCountryA] = useState<CountryScore | null>(initial ?? null);
  const [countryB, setCountryB] = useState<CountryScore | null>(null);

  const { data: insightsA } = useQuery<InsightData>({
    queryKey: ["insights", countryA?.iso3],
    queryFn: () => fetchInsights(countryA!.iso3),
    enabled: !!countryA,
  });

  const { data: insightsB } = useQuery<InsightData>({
    queryKey: ["insights", countryB?.iso3],
    queryFn: () => fetchInsights(countryB!.iso3),
    enabled: !!countryB,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const COLOR_A = "#00d4ff";
  const COLOR_B = "#ff8800";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 16, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", damping: 28, stiffness: 360 }}
          className="w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: "rgba(5, 12, 28, 0.97)",
            border: "1px solid rgba(255,255,255,0.08)",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-300 tracking-wide">Country Comparison</span>
            </div>
            <button onClick={onClose} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Selectors */}
          <div
            className="grid grid-cols-2 gap-4 px-5 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div>
              <div className="text-xs mb-1.5 tracking-widest" style={{ color: COLOR_A, fontSize: "0.6rem" }}>
                COUNTRY A
              </div>
              <CountrySelector
                scores={scores}
                value={countryA}
                onChange={setCountryA}
                placeholder="Select first country…"
                color={COLOR_A}
              />
            </div>
            <div>
              <div className="text-xs mb-1.5 tracking-widest" style={{ color: COLOR_B, fontSize: "0.6rem" }}>
                COUNTRY B
              </div>
              <CountrySelector
                scores={scores}
                value={countryB}
                onChange={setCountryB}
                placeholder="Select second country…"
                color={COLOR_B}
              />
            </div>
          </div>

          {/* Comparison body */}
          <div className="flex-1 overflow-y-auto">
            {!countryA && !countryB ? (
              <div className="text-center py-16 text-sm text-slate-600">
                Select two countries above to compare them
              </div>
            ) : (
              <div className="p-5 space-y-6">
                {/* Score bars */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {countryA && (
                        <span className="text-xs font-semibold" style={{ color: COLOR_A }}>
                          ← {countryA.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-700 tracking-widest" style={{ fontSize: "0.6rem" }}>
                      SCORE COMPARISON (0–100)
                    </span>
                    <div className="flex items-center gap-3">
                      {countryB && (
                        <span className="text-xs font-semibold" style={{ color: COLOR_B }}>
                          {countryB.name} →
                        </span>
                      )}
                    </div>
                  </div>

                  {DIMS.map((dim) => (
                    <RadarBar
                      key={dim.key}
                      label={dim.label}
                      a={countryA ? (countryA[dim.key] as number | null) : null}
                      b={countryB ? (countryB[dim.key] as number | null) : null}
                      colorA={COLOR_A}
                      colorB={COLOR_B}
                    />
                  ))}
                </div>

                {/* Insight columns */}
                {(insightsA || insightsB) && (
                  <div className="grid grid-cols-2 gap-4">
                    <InsightColumn
                      title={countryA?.name ?? ""}
                      data={insightsA}
                      color={COLOR_A}
                    />
                    <InsightColumn
                      title={countryB?.name ?? ""}
                      data={insightsB}
                      color={COLOR_B}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function InsightColumn({ title, data, color }: {
  title: string; data: InsightData | undefined; color: string;
}) {
  if (!data) return null;
  const INSIGHT_COLORS: Record<string, string> = {
    critical: "#ff3355",
    warning: "#ff8800",
    info: "#00d4ff",
    stable: "#00ff88",
    positive: "#00ff88",
  };

  return (
    <div
      className="p-4 rounded-lg space-y-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="text-xs font-semibold tracking-wider truncate" style={{ color }}>{title}</div>
      {data.insights.slice(0, 2).map((ins, i) => (
        <div key={i}>
          <div className="text-xs font-semibold mb-0.5" style={{ color: INSIGHT_COLORS[ins.type] ?? "#64748b" }}>
            {ins.title}
          </div>
          <div className="text-xs text-slate-600 leading-relaxed line-clamp-3">{ins.body}</div>
        </div>
      ))}
    </div>
  );
}
