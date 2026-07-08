"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Wheat,
  TrendingDown as EconIcon,
  Scale,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ForecastPoint {
  days: 30 | 60 | 90;
  predicted_score: number;
  confidence: number;
}

interface Intervention {
  type: string;
  avg_impact: number;
  timeframe: string;
  evidence: string;
}

interface ForecastData {
  iso3: string;
  name: string;
  current_score: number | null;
  trend_30d: number;
  trajectory: "deteriorating" | "improving" | "stable";
  forecast: ForecastPoint[];
  primary_driver: "conflict" | "food" | "economic" | "balanced";
  interventions: Intervention[];
  risk_factors: string[];
  history_points: number;
}

interface Props {
  iso3: string;
  name: string;
  currentScore: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "#475569";
  if (score < 30) return "#00ff88";
  if (score < 55) return "#ffcc00";
  if (score < 75) return "#ff8800";
  return "#ff3355";
}

function scoreLabel(score: number | null | undefined): string {
  if (score == null) return "No data";
  if (score < 30) return "Stable";
  if (score < 55) return "Elevated";
  if (score < 75) return "High";
  return "Critical";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-xs font-semibold tracking-widest uppercase mb-2"
      style={{ color: "#475569", fontSize: "0.6rem" }}
    >
      {children}
    </div>
  );
}

// ─── SVG Trajectory Chart ────────────────────────────────────────────────────

function TrajectoryChart({
  currentScore,
  forecast,
}: {
  currentScore: number | null;
  forecast: ForecastPoint[];
}) {
  const W = 256;
  const H = 64;
  const PAD_L = 28;
  const PAD_R = 8;
  const PAD_T = 6;
  const PAD_B = 16;

  const SCORE_MIN = 0;
  const SCORE_MAX = 55;

  // Grid lines at y=25, y=35, y=45
  const gridScores = [25, 35, 45];

  const xPositions = [PAD_L, PAD_L + (W - PAD_L - PAD_R) / 3, PAD_L + ((W - PAD_L - PAD_R) / 3) * 2, W - PAD_R];
  const xLabels = ["NOW", "30D", "60D", "90D"];

  function toY(score: number): number {
    const ratio = (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);
    return H - PAD_B - ratio * (H - PAD_T - PAD_B);
  }

  const allPoints: { x: number; y: number; score: number | null; isCurrent: boolean }[] = [];

  if (currentScore != null) {
    allPoints.push({ x: xPositions[0], y: toY(Math.min(currentScore, SCORE_MAX)), score: currentScore, isCurrent: true });
  }

  forecast
    .slice()
    .sort((a, b) => a.days - b.days)
    .forEach((pt, i) => {
      allPoints.push({
        x: xPositions[i + 1],
        y: toY(Math.min(pt.predicted_score, SCORE_MAX)),
        score: pt.predicted_score,
        isCurrent: false,
      });
    });

  // Build solid path segment (current only, or up to first forecast)
  const solidPath =
    allPoints.length >= 1
      ? `M ${allPoints[0].x} ${allPoints[0].y}`
      : "";

  // Dashed path from current → all forecast points
  const dashedPath =
    allPoints.length >= 2
      ? allPoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ")
      : "";

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", overflow: "visible" }}
      aria-label="Trajectory forecast chart"
    >
      {/* Horizontal grid lines */}
      {gridScores.map((gs) => (
        <g key={gs}>
          <line
            x1={PAD_L}
            y1={toY(gs)}
            x2={W - PAD_R}
            y2={toY(gs)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
          <text
            x={PAD_L - 4}
            y={toY(gs) + 3}
            textAnchor="end"
            fontSize={7}
            fill="#334155"
            fontFamily="ui-monospace, monospace"
          >
            {gs}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xPositions.map((x, i) => (
        <text
          key={i}
          x={x}
          y={H - 2}
          textAnchor="middle"
          fontSize={6.5}
          fill="#334155"
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.04em"
        >
          {xLabels[i]}
        </text>
      ))}

      {/* Dashed forecast line */}
      {dashedPath && (
        <path
          d={dashedPath}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      )}

      {/* Solid current-point dot anchor */}
      {solidPath && allPoints[0] && (
        <line
          x1={allPoints[0].x}
          y1={PAD_T}
          x2={allPoints[0].x}
          y2={H - PAD_B}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}

      {/* Forecast dots */}
      {allPoints.map((pt, i) => {
        if (pt.score == null) return null;
        const c = scoreColor(pt.score);
        return (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={3} fill={c} opacity={0.9} />
            {i > 0 && (
              <text
                x={pt.x}
                y={pt.y - 5}
                textAnchor="middle"
                fontSize={6.5}
                fill={c}
                fontFamily="ui-monospace, monospace"
              >
                {pt.score.toFixed(1)}
              </text>
            )}
          </g>
        );
      })}

      {/* Pulsing "NOW" dot — the aesthetic risk: radar-ping on the live reading */}
      {allPoints[0] && allPoints[0].score != null && (
        <g>
          {/* Outer ring animation via CSS on the SVG */}
          <circle
            cx={allPoints[0].x}
            cy={allPoints[0].y}
            r={7}
            fill="none"
            stroke={scoreColor(allPoints[0].score)}
            strokeWidth={1}
            opacity={0.3}
            className="animate-ping"
            style={{ transformOrigin: `${allPoints[0].x}px ${allPoints[0].y}px` }}
          />
          <circle
            cx={allPoints[0].x}
            cy={allPoints[0].y}
            r={3.5}
            fill={scoreColor(allPoints[0].score)}
          />
        </g>
      )}
    </svg>
  );
}

// ─── Forecast Card (30 / 60 / 90 day) ────────────────────────────────────────

function ForecastCard({
  pt,
  currentScore,
  delay,
}: {
  pt: ForecastPoint;
  currentScore: number | null;
  delay: number;
}) {
  const color = scoreColor(pt.predicted_score);
  const delta = currentScore != null ? pt.predicted_score - currentScore : null;
  const deltaPos = delta != null && delta > 0;
  const deltaColor = delta == null ? "#64748b" : deltaPos ? "#ff8800" : "#00ff88";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex-1 rounded-xl p-2.5 text-center"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid rgba(255,255,255,0.06)`,
        minWidth: 0,
      }}
    >
      {/* Label */}
      <div
        className="font-semibold tracking-widest uppercase mb-1"
        style={{ color: "#475569", fontSize: "0.55rem" }}
      >
        {pt.days}D
      </div>

      {/* Score */}
      <div
        className="font-black tabular-nums leading-none mb-1"
        style={{
          color,
          fontSize: "1.2rem",
          textShadow: `0 0 14px ${color}44`,
        }}
      >
        {pt.predicted_score.toFixed(1)}
      </div>

      {/* Delta */}
      {delta != null && (
        <div
          className="flex items-center justify-center gap-0.5 mb-1.5"
          style={{ color: deltaColor, fontSize: "0.6rem" }}
        >
          {deltaPos ? (
            <ArrowUpRight className="w-2.5 h-2.5 flex-shrink-0" />
          ) : (
            <ArrowDownRight className="w-2.5 h-2.5 flex-shrink-0" />
          )}
          <span className="font-bold tabular-nums">
            {deltaPos ? "+" : ""}
            {delta.toFixed(1)}
          </span>
        </div>
      )}

      {/* Confidence bar */}
      <div
        className="rounded-full overflow-hidden"
        style={{ height: "2px", background: "rgba(255,255,255,0.06)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pt.confidence}%` }}
          transition={{ delay: delay + 0.2, duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}55, ${color})` }}
        />
      </div>
      <div
        className="mt-1 tabular-nums"
        style={{ color: "#334155", fontSize: "0.55rem" }}
      >
        {pt.confidence}% conf
      </div>
    </motion.div>
  );
}

// ─── Primary Driver ───────────────────────────────────────────────────────────

const DRIVER_META: Record<
  string,
  { label: string; color: string; Icon: React.ElementType }
> = {
  conflict: { label: "Armed Conflict", color: "#f97316", Icon: Shield },
  food: { label: "Food Insecurity", color: "#eab308", Icon: Wheat },
  economic: { label: "Economic Stress", color: "#3b82f6", Icon: EconIcon },
  balanced: { label: "Multi-Dimensional", color: "#00d4ff", Icon: Scale },
};

function PrimaryDriverCard({ driver }: { driver: string }) {
  const meta = DRIVER_META[driver] ?? DRIVER_META.balanced;
  const { label, color, Icon } = meta;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{
        background: `${color}0a`,
        border: `1px solid ${color}22`,
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div>
        <div className="text-xs font-semibold" style={{ color }}>
          {label}
        </div>
        <div className="text-xs" style={{ color: "#475569", fontSize: "0.6rem" }}>
          Primary stress dimension
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Cards row */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex-1 h-20 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
        ))}
      </div>
      {/* Chart */}
      <div
        className="h-16 rounded-xl"
        style={{ background: "rgba(255,255,255,0.03)" }}
      />
      {/* Driver */}
      <div
        className="h-12 rounded-xl"
        style={{ background: "rgba(255,255,255,0.03)" }}
      />
      {/* Risk factors */}
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-6 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", width: `${70 + i * 10}%` }}
          />
        ))}
      </div>
      {/* Interventions */}
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForecastTab({ iso3, name, currentScore }: Props) {
  const { data, isLoading, isError } = useQuery<ForecastData>({
    queryKey: ["forecast", iso3],
    queryFn: async () => {
      const res = await fetch(`/api/forecast/${iso3}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <Skeleton />;

  if (isError || !data) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 py-10 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <AlertTriangle className="w-5 h-5" style={{ color: "#475569" }} />
        <div className="text-xs text-center" style={{ color: "#475569" }}>
          Forecast data unavailable for {name}.
        </div>
      </div>
    );
  }

  const score = currentScore ?? data.current_score;
  const sorted = [...(data.forecast ?? [])].sort((a, b) => a.days - b.days);
  const trend = data.trend_30d;
  const trendPos = trend > 0;

  const TRAJECTORY_META = {
    deteriorating: { color: "#ff3355", Icon: TrendingUp, label: "DETERIORATING" },
    improving:     { color: "#00ff88", Icon: TrendingDown, label: "IMPROVING" },
    stable:        { color: "#94a3b8", Icon: Minus, label: "STABLE" },
  };
  const traj = TRAJECTORY_META[data.trajectory] ?? TRAJECTORY_META.stable;
  const TrajIcon = traj.Icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={iso3}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        {/* ── SECTION 1: Trajectory header + cards ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Trajectory Forecast</SectionLabel>
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                background: `${traj.color}14`,
                border: `1px solid ${traj.color}28`,
              }}
            >
              <TrajIcon className="w-2.5 h-2.5" style={{ color: traj.color }} />
              <span
                className="font-semibold tracking-widest uppercase"
                style={{ color: traj.color, fontSize: "0.55rem" }}
              >
                {traj.label}
              </span>
              <span
                className="font-mono tabular-nums"
                style={{
                  color: trendPos ? "#ff8800" : "#00ff88",
                  fontSize: "0.55rem",
                }}
              >
                ({trendPos ? "+" : ""}{trend.toFixed(1)} pts)
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {sorted.map((pt, i) => (
              <ForecastCard
                key={pt.days}
                pt={pt}
                currentScore={score}
                delay={i * 0.06}
              />
            ))}
          </div>
        </div>

        {/* ── SECTION 2: SVG chart ── */}
        <div
          className="rounded-xl px-3 pt-3 pb-1"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <TrajectoryChart currentScore={score} forecast={sorted} />
        </div>

        {/* ── SECTION 3: Primary driver ── */}
        <div>
          <SectionLabel>Primary Driver</SectionLabel>
          <PrimaryDriverCard driver={data.primary_driver} />
        </div>

        {/* ── SECTION 4: Risk factors ── */}
        {data.risk_factors && data.risk_factors.length > 0 && (
          <div>
            <SectionLabel>Risk Factors</SectionLabel>
            <div
              className="rounded-xl p-3 space-y-2"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {data.risk_factors.map((rf, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex items-start gap-2"
                >
                  <AlertTriangle
                    className="w-3 h-3 mt-0.5 flex-shrink-0"
                    style={{ color: "#ff8800" }}
                  />
                  <span className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                    {rf}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 5: Intervention pathways ── */}
        {data.interventions && data.interventions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Intervention Pathways</SectionLabel>
              <span
                className="text-xs italic"
                style={{ color: "#334155", fontSize: "0.6rem" }}
              >
                What historically works
              </span>
            </div>
            <div className="space-y-2">
              {data.interventions.map((inv, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                  className="rounded-xl p-3"
                  style={{
                    background: "rgba(0,255,136,0.03)",
                    border: "1px solid rgba(0,255,136,0.1)",
                    borderLeft: "2px solid #00ff88",
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2
                        className="w-3 h-3 flex-shrink-0"
                        style={{ color: "#00ff88" }}
                      />
                      <span
                        className="text-xs font-semibold truncate"
                        style={{ color: "#e2e8f0" }}
                      >
                        {inv.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="font-bold tabular-nums font-mono"
                        style={{ color: "#00ff88", fontSize: "0.7rem" }}
                      >
                        {inv.avg_impact > 0 ? "+" : ""}
                        {inv.avg_impact.toFixed(1)} pts
                      </span>
                    </div>
                  </div>

                  <div
                    className="text-xs mb-1.5"
                    style={{ color: "#64748b", fontSize: "0.65rem" }}
                  >
                    {inv.timeframe}
                  </div>

                  <p
                    className="leading-relaxed line-clamp-2"
                    style={{ color: "#475569", fontSize: "0.6rem" }}
                  >
                    {inv.evidence}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Footer: data coverage note */}
        {data.history_points != null && (
          <div
            className="text-center"
            style={{ color: "#1e293b", fontSize: "0.6rem" }}
          >
            Model trained on {data.history_points} historical observations
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
