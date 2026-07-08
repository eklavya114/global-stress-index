"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import type { CountryScore } from "@/types";

interface Props {
  scores: CountryScore[];
  onSelect: (country: CountryScore) => void;
  onClose: () => void;
}

function scoreColor(v: number | null): string {
  if (v === null) return "#475569";
  if (v >= 75) return "#ff3355";
  if (v >= 55) return "#ff8800";
  if (v >= 35) return "#ffcc00";
  return "#00ff88";
}

function scoreLabel(v: number | null): string {
  if (v === null) return "No data";
  if (v >= 75) return "CRITICAL";
  if (v >= 55) return "ELEVATED";
  if (v >= 35) return "MODERATE";
  return "STABLE";
}

export default function CommandPalette({ scores, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? scores
        .filter((s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.iso3.toLowerCase().includes(query.toLowerCase()) ||
          (s.region ?? "").toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 12)
    : scores
        .filter((s) => s.pulse_score !== null)
        .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
        .slice(0, 8);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setFocused(0);
  }, [query]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocused((f) => Math.min(f + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocused((f) => Math.max(f - 1, 0));
      }
      if (e.key === "Enter" && filtered[focused]) {
        onSelect(filtered[focused]);
        onClose();
      }
    },
    [filtered, focused, onClose, onSelect]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Scroll focused item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${focused}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: -20, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -12, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", damping: 26, stiffness: 340 }}
          className="w-full max-w-xl mx-4 rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: "rgba(5, 12, 28, 0.97)",
            border: "1px solid rgba(0, 180, 255, 0.18)",
          }}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country, region, or ISO code…"
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
              style={{ fontFamily: "inherit" }}
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-slate-600 hover:text-slate-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd
              className="text-xs text-slate-700 px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              ESC
            </kbd>
          </div>

          {/* Label row */}
          <div className="px-4 py-1.5 flex items-center justify-between">
            <span className="text-xs text-slate-700 tracking-widest" style={{ fontSize: "0.6rem" }}>
              {query ? `${filtered.length} RESULTS` : "TOP STRESSED COUNTRIES"}
            </span>
            <span className="text-xs text-slate-700 tracking-widest" style={{ fontSize: "0.6rem" }}>
              ↑↓ NAVIGATE · ↵ SELECT
            </span>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="overflow-y-auto"
            style={{ maxHeight: "min(420px, 60vh)" }}
          >
            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-600">
                No countries match &quot;{query}&quot;
              </div>
            ) : (
              filtered.map((c, i) => {
                const score = c.pulse_score;
                const color = scoreColor(score);
                const label = scoreLabel(score);
                return (
                  <button
                    key={c.iso3}
                    data-idx={i}
                    onClick={() => { onSelect(c); onClose(); }}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left transition-colors"
                    style={{
                      background: i === focused ? "rgba(0,212,255,0.06)" : "transparent",
                      borderLeft: i === focused ? "2px solid rgba(0,212,255,0.5)" : "2px solid transparent",
                    }}
                    onMouseEnter={() => setFocused(i)}
                  >
                    {/* ISO badge */}
                    <span
                      className="text-xs font-mono font-bold w-10 text-center flex-shrink-0 rounded"
                      style={{ color: "#64748b", letterSpacing: "0.05em" }}
                    >
                      {c.iso3}
                    </span>

                    {/* Name + region */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">{c.name}</div>
                      {c.region && (
                        <div className="text-xs text-slate-600 truncate">{c.region}</div>
                      )}
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-xs font-mono tracking-wider"
                        style={{ color, fontSize: "0.6rem", letterSpacing: "0.1em" }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-base font-black font-mono"
                        style={{ color, minWidth: 36, textAlign: "right" }}
                      >
                        {score !== null ? score.toFixed(0) : "—"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2.5 flex items-center justify-between border-t border-white/5"
            style={{ fontSize: "0.62rem", color: "#3D4A5E", letterSpacing: "0.1em" }}
          >
            <span>EARTH PULSE · COMMAND PALETTE</span>
            <span>{scores.filter((s) => s.pulse_score !== null).length} / {scores.length} COUNTRIES SCORED</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
