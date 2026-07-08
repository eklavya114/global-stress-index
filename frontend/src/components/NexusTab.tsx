"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";

const API_URL = "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

type NexusType = "triple" | "food-conflict" | "economic-conflict" | "food-economic";

interface NexusEntry {
  iso3: string;
  name: string;
  region: string | null;
  nexus_type: NexusType;
  severity: 1 | 2 | 3;
  pulse_score: number;
  conflict_score: number | null;
  food_score: number | null;
  economic_score: number | null;
  nexus_score: number;
  description: string;
}

interface Props {
  onCountryClick?: (iso3: string, name: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NEXUS_TYPE_LABELS: Record<NexusType, string> = {
  "triple":            "Food + Conflict + Economic",
  "food-conflict":     "Food + Conflict",
  "economic-conflict": "Economic + Conflict",
  "food-economic":     "Food + Economic",
};

// Left border accent color per nexus type
const NEXUS_BORDER_COLOR: Record<NexusType, string> = {
  "triple":            "#ff3355",
  "food-conflict":     "#f59e0b",
  "economic-conflict": "#3b82f6",
  "food-economic":     "#ff8800",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nexusScoreColor(score: number): string {
  if (score >= 75) return "#ff3355";
  if (score >= 55) return "#ff8800";
  if (score >= 35) return "#ffcc00";
  return "#00ff88";
}

// ─── Dimension mini-bar ───────────────────────────────────────────────────────

interface DimBarProps {
  label: string;
  score: number | null;
  color: string;
  elevated: boolean;
}

function DimBar({ label, score, color, elevated }: DimBarProps) {
  const pct = score != null ? Math.min(Math.max(score, 0), 100) : 0;
  const labelColor = elevated ? "#cbd5e1" : "#475569";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {/* Label */}
      <span
        style={{
          fontSize: "0.58rem",
          letterSpacing: "0.05em",
          color: labelColor,
          width: 46,
          flexShrink: 0,
          textTransform: "uppercase",
          fontWeight: elevated ? 600 : 400,
          transition: "color 0.2s",
        }}
      >
        {label}
      </span>

      {/* Bar track (40px wide) */}
      <div
        style={{
          width: 40,
          height: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.06)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{
            height: "100%",
            borderRadius: 2,
            background: `linear-gradient(90deg, ${color}77, ${color})`,
          }}
        />
      </div>

      {/* Score number */}
      <span
        style={{
          fontSize: "0.6rem",
          fontFamily: "'Courier New', monospace",
          color: score != null && elevated ? color : "#334155",
          fontWeight: elevated ? 700 : 400,
          minWidth: 22,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {score != null ? score.toFixed(0) : "—"}
      </span>
    </div>
  );
}

// ─── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity, nexusType }: { severity: 1 | 2 | 3; nexusType: NexusType }) {
  if (severity === 3) {
    return (
      <motion.span
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          fontSize: "0.56rem",
          fontFamily: "'Courier New', monospace",
          letterSpacing: "0.1em",
          padding: "2px 6px",
          borderRadius: 3,
          background: "rgba(255,51,85,0.15)",
          color: "#ff3355",
          border: "1px solid rgba(255,51,85,0.35)",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        TRIPLE NEXUS
      </motion.span>
    );
  }
  if (severity === 2) {
    return (
      <span
        style={{
          fontSize: "0.56rem",
          fontFamily: "'Courier New', monospace",
          letterSpacing: "0.1em",
          padding: "2px 6px",
          borderRadius: 3,
          background: "rgba(255,136,0,0.12)",
          color: "#ff8800",
          border: "1px solid rgba(255,136,0,0.28)",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        DUAL [HIGH]
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: "0.56rem",
        fontFamily: "'Courier New', monospace",
        letterSpacing: "0.1em",
        padding: "2px 6px",
        borderRadius: 3,
        background: "rgba(255,204,0,0.1)",
        color: "#ffcc00",
        border: "1px solid rgba(255,204,0,0.22)",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      DUAL [ELEV]
    </span>
  );
}

// ─── Nexus card ────────────────────────────────────────────────────────────────

function NexusCard({
  entry,
  index,
  onCountryClick,
}: {
  entry: NexusEntry;
  index: number;
  onCountryClick?: (iso3: string, name: string) => void;
}) {
  const borderColor = NEXUS_BORDER_COLOR[entry.nexus_type];
  const nsColor = nexusScoreColor(entry.nexus_score);
  const isClickable = !!onCountryClick;

  const conflictElevated = (entry.conflict_score ?? 0) >= 22;
  const foodElevated     = (entry.food_score ?? 0) >= 22;
  const economicElevated = (entry.economic_score ?? 0) >= 22;

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
      onClick={() => onCountryClick?.(entry.iso3, entry.name)}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCountryClick?.(entry.iso3, entry.name);
              }
            }
          : undefined
      }
      style={{
        borderLeft: `3px solid ${borderColor}`,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        padding: "10px 12px 10px 11px",
        cursor: isClickable ? "pointer" : "default",
        background: "transparent",
        transition: "background 0.15s",
        outline: "none",
      }}
      whileHover={
        isClickable
          ? { backgroundColor: "rgba(255,255,255,0.025)" }
          : {}
      }
    >
      {/* Top row: name + severity */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#e2e8f0",
            letterSpacing: "0.02em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.name}
        </span>
        <SeverityBadge severity={entry.severity} nexusType={entry.nexus_type} />
      </div>

      {/* Dimension bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 7 }}>
        <DimBar
          label="Conflict"
          score={entry.conflict_score}
          color="#ff3355"
          elevated={conflictElevated}
        />
        <DimBar
          label="Food"
          score={entry.food_score}
          color="#ff8800"
          elevated={foodElevated}
        />
        <DimBar
          label="Economic"
          score={entry.economic_score}
          color="#3b82f6"
          elevated={economicElevated}
        />
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: "0.64rem",
          color: "#64748b",
          lineHeight: 1.55,
          margin: 0,
          marginBottom: 7,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {entry.description}
      </p>

      {/* Footer: nexus score + type label + region */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {/* nexus_score badge */}
        <span
          style={{
            fontSize: "0.58rem",
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
            color: nsColor,
            padding: "1px 5px",
            borderRadius: 3,
            background: `${nsColor}15`,
            border: `1px solid ${nsColor}30`,
            letterSpacing: "0.04em",
          }}
        >
          {entry.nexus_score.toFixed(1)}
        </span>

        {/* nexus type label */}
        <span
          style={{
            fontSize: "0.58rem",
            color: "#334155",
            letterSpacing: "0.03em",
          }}
        >
          {NEXUS_TYPE_LABELS[entry.nexus_type]}
        </span>

        {/* Region tag */}
        {entry.region && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.56rem",
              color: "#1e3a5f",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {entry.region}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      style={{
        borderLeft: "3px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        padding: "10px 12px 10px 11px",
        animationDelay: `${index * 0.12}s`,
      }}
      className="animate-pulse"
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ height: 10, width: 90, borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
        <div style={{ height: 16, width: 72, borderRadius: 3, background: "rgba(255,255,255,0.05)" }} />
      </div>
      {/* Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ height: 6, width: 46, borderRadius: 2, background: "rgba(255,255,255,0.04)" }} />
            <div style={{ height: 3, width: 40, borderRadius: 2, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ height: 6, width: 22, borderRadius: 2, background: "rgba(255,255,255,0.04)" }} />
          </div>
        ))}
      </div>
      {/* Description */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
        <div style={{ height: 6, width: "100%", borderRadius: 2, background: "rgba(255,255,255,0.04)" }} />
        <div style={{ height: 6, width: "75%", borderRadius: 2, background: "rgba(255,255,255,0.04)" }} />
      </div>
      {/* Footer */}
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ height: 14, width: 32, borderRadius: 3, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ height: 14, width: 88, borderRadius: 3, background: "rgba(255,255,255,0.04)" }} />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function NexusTab({ onCountryClick }: Props) {
  const { data = [], isLoading } = useQuery<NexusEntry[]>({
    queryKey: ["nexus"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/nexus`);
      if (!res.ok) throw new Error(`Nexus API error: ${res.status}`);
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const tripleCount = data.filter((e) => e.nexus_type === "triple").length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Non-scrolling header (36px) ── */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 12,
          paddingRight: 12,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(2,8,20,0.6)",
        }}
      >
        <span
          style={{
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#475569",
          }}
        >
          Compound Crisis Nexus
        </span>

        {/* Active count badge */}
        {!isLoading && (
          <span
            style={{
              fontSize: "0.58rem",
              fontFamily: "'Courier New', monospace",
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "2px 7px",
              borderRadius: 10,
              background: data.length > 0 ? "rgba(255,51,85,0.14)" : "rgba(0,255,136,0.1)",
              color: data.length > 0 ? "#ff3355" : "#00ff88",
              border: data.length > 0 ? "1px solid rgba(255,51,85,0.3)" : "1px solid rgba(0,255,136,0.2)",
            }}
          >
            {data.length} active
          </span>
        )}
      </div>

      {/* ── Summary strip (triple nexus count) ── */}
      <AnimatePresence>
        {!isLoading && data.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: tripleCount > 0 ? "rgba(255,51,85,0.04)" : "rgba(255,255,255,0.01)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: "0.6rem",
                color: "#475569",
                letterSpacing: "0.04em",
              }}
            >
              {tripleCount > 0 ? (
                <>
                  <span style={{ color: "#ff3355", fontWeight: 700 }}>{tripleCount}</span>
                  {" "}triple-nexus{" "}
                  <span style={{ color: "#334155" }}>
                    {tripleCount === 1 ? "country" : "countries"} — all three dimensions critical
                  </span>
                </>
              ) : (
                <span style={{ color: "#334155" }}>No triple-nexus countries detected</span>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable content ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {isLoading ? (
          /* Skeleton state */
          <div>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        ) : data.length === 0 ? (
          /* Empty state */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: 140,
              gap: 8,
              padding: "0 24px",
              textAlign: "center",
            }}
          >
            <CheckCircle
              style={{ width: 20, height: 20, color: "#00ff88", opacity: 0.7 }}
            />
            <span
              style={{
                fontSize: "0.68rem",
                color: "#334155",
                letterSpacing: "0.04em",
                lineHeight: 1.5,
              }}
            >
              No compound crises detected
            </span>
            <span
              style={{
                fontSize: "0.6rem",
                color: "#1e293b",
                letterSpacing: "0.03em",
              }}
            >
              All monitored nations show single-dimension or sub-threshold stress
            </span>
          </div>
        ) : (
          /* Card list */
          <div>
            {data.map((entry, i) => (
              <NexusCard
                key={entry.iso3}
                entry={entry}
                index={i}
                onCountryClick={onCountryClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
