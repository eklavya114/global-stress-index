"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCountryHistory, fetchInsights, exportCountryUrl } from "@/lib/api";
import type { CountryScore } from "@/types";
import { X, TrendingUp, TrendingDown, Minus, Shield, Wheat, TrendingDown as EconIcon, Download, BarChart2, AlertTriangle, Info, CheckCircle, Lightbulb, LineChart } from "lucide-react";
import ForecastTab from "./ForecastTab";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useState } from "react";

interface Props {
  country: CountryScore;
  onClose: () => void;
  onCompare?: () => void;
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "#475569";
  if (score < 30)   return "#00ff88";
  if (score < 55)   return "#ffcc00";
  if (score < 75)   return "#ff8800";
  return "#ff3355";
}

function scoreGlowClass(score: number | null | undefined): string {
  if (score == null) return "";
  if (score < 30)   return "glow-green";
  if (score < 55)   return "glow-yellow";
  if (score < 75)   return "glow-orange";
  return "glow-red";
}

function ScoreBar({ label, score, color, icon }: {
  label: string; score: number | null; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">{icon}{label}</div>
        <span className="text-sm font-bold font-mono" style={{ color }}>
          {score != null ? score.toFixed(1) : "—"}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: score != null ? `${Math.min(score, 100)}%` : "0%" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
    </div>
  );
}

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  critical: AlertTriangle,
  warning:  AlertTriangle,
  info:     Info,
  stable:   CheckCircle,
  positive: CheckCircle,
};
const INSIGHT_COLORS: Record<string, string> = {
  critical: "#ff3355",
  warning:  "#ff8800",
  info:     "#00d4ff",
  stable:   "#00ff88",
  positive: "#00ff88",
};

export default function CountryPanel({ country, onClose, onCompare }: Props) {
  const [tab, setTab] = useState<"overview" | "insights" | "forecast">("overview");

  const { data: history } = useQuery({
    queryKey: ["history", country.iso3],
    queryFn: () => fetchCountryHistory(country.iso3, 30),
  });

  const { data: insights } = useQuery({
    queryKey: ["insights", country.iso3],
    queryFn: () => fetchInsights(country.iso3),
    staleTime: 10 * 60 * 1000,
  });

  const chartData = (history ?? [])
    .slice()
    .reverse()
    .map((h) => ({
      date: format(new Date(h.score_date), "MMM d"),
      pulse: h.pulse_score,
      conflict: h.conflict_score,
      food: h.food_score,
      economic: h.economic_score,
    }));

  const score = country.pulse_score;
  const TrendIcon = score == null ? Minus : score > 55 ? TrendingUp : score < 35 ? TrendingDown : Minus;
  const pulseColor = scoreColor(score);
  const qualityPct = country.data_quality != null ? (country.data_quality * 100).toFixed(0) : null;

  return (
    <motion.div
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute right-4 top-4 bottom-4 z-20 w-80 flex flex-col overflow-hidden rounded-2xl"
      style={{
        background: "rgba(2, 8, 20, 0.88)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 0 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between p-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div>
          <div className="font-bold text-base text-white">{country.name}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
            <span>{country.region ?? "Unknown"}</span>
            <span className="text-slate-700">·</span>
            <span className="font-mono px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}>
              {country.iso3}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <TrendIcon className="w-4 h-4" style={{ color: pulseColor }} />
          {onCompare && (
            <button
              onClick={onCompare}
              title="Compare countries"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748b" }}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          )}
          <a
            href={exportCountryUrl(country.iso3)}
            download
            title="Download CSV"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748b" }}
          >
            <Download className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {(["overview", "insights", "forecast"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 capitalize"
            style={{
              color: tab === t ? "#00d4ff" : "#475569",
              borderBottom: tab === t ? "1.5px solid #00d4ff" : "1.5px solid transparent",
              background: tab === t ? "rgba(0,212,255,0.04)" : "transparent",
            }}
          >
            {t === "insights" && <Lightbulb className="w-3 h-3" />}
            {t === "forecast" && <LineChart className="w-3 h-3" />}
            {t}
            {t === "insights" && insights && insights.insights.length > 0 && (
              <span
                className="text-xs px-1 rounded-full font-bold"
                style={{ background: "rgba(0,212,255,0.15)", color: "#00d4ff", fontSize: "0.6rem" }}
              >
                {insights.insights.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "overview" && (
          <>
            {/* Pulse score */}
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="text-xs text-slate-500 tracking-widest uppercase mb-1">Pulse Score</div>
              <motion.div
                key={score}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className={`text-5xl font-black tabular-nums ${scoreGlowClass(score)}`}
                style={{ color: pulseColor }}
              >
                {score != null ? score.toFixed(1) : "—"}
              </motion.div>
              <div className="text-xs text-slate-600 mt-1">
                {score == null ? "No data" : score < 30 ? "Stable" : score < 55 ? "Moderate Stress" : score < 75 ? "High Stress" : "Critical"}
              </div>
            </div>

            {/* Dimension bars */}
            <div className="rounded-xl p-4 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <ScoreBar label="Conflict"    score={country.conflict_score} color="#f97316" icon={<Shield className="w-3 h-3" />} />
              <ScoreBar label="Food Stress" score={country.food_score}     color="#eab308" icon={<Wheat className="w-3 h-3" />} />
              <ScoreBar label="Economic"    score={country.economic_score} color="#3b82f6" icon={<EconIcon className="w-3 h-3" />} />
            </div>

            {/* Data quality */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-600">
                Data quality: <span className="text-slate-400 font-medium">{qualityPct != null ? `${qualityPct}%` : "unknown"}</span>
              </span>
              {country.score_date && (
                <span className="text-slate-700 font-mono">{country.score_date}</span>
              )}
            </div>

            {/* History chart */}
            {chartData.length > 1 && (
              <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-xs text-slate-500 tracking-widest uppercase mb-3">30-Day History</div>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="pulseGrad"    x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e2e8f0" stopOpacity={0.15} /><stop offset="95%" stopColor="#e2e8f0" stopOpacity={0} /></linearGradient>
                      <linearGradient id="conflictGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.12} /><stop offset="95%" stopColor="#f97316" stopOpacity={0} /></linearGradient>
                      <linearGradient id="foodGrad"     x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#eab308" stopOpacity={0.12} /><stop offset="95%" stopColor="#eab308" stopOpacity={0} /></linearGradient>
                      <linearGradient id="econGrad"     x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#475569" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "#475569" }} tickLine={false} axisLine={false} width={22} />
                    <Tooltip
                      contentStyle={{ background: "rgba(2,8,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, padding: "6px 10px" }}
                      labelStyle={{ color: "#94a3b8" }}
                      itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Area type="monotone" dataKey="pulse"    stroke="#e2e8f0" strokeWidth={2} fill="url(#pulseGrad)"    dot={false} name="Pulse" />
                    <Area type="monotone" dataKey="conflict" stroke="#f97316" strokeWidth={1} fill="url(#conflictGrad)" dot={false} name="Conflict" />
                    <Area type="monotone" dataKey="food"     stroke="#eab308" strokeWidth={1} fill="url(#foodGrad)"     dot={false} name="Food" />
                    <Area type="monotone" dataKey="economic" stroke="#3b82f6" strokeWidth={1} fill="url(#econGrad)"     dot={false} name="Economic" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Data sources */}
            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              {[
                { color: "#f97316", label: "Conflict", src: "GDELT sentiment analysis" },
                { color: "#eab308", label: "Food",     src: "FAO price index + undernourishment" },
                { color: "#3b82f6", label: "Economic", src: "World Bank GDP, inflation, unemployment" },
              ].map(({ color, label, src }) => (
                <div key={label} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: color }} />
                  <span className="text-slate-600"><span className="text-slate-500">{label}:</span> {src}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "insights" && (
          <>
            {!insights ? (
              <div className="text-center py-8 text-sm text-slate-600 animate-pulse">
                Analyzing {country.name}…
              </div>
            ) : insights.insights.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-600">
                No insights available — score data needed.
              </div>
            ) : (
              <div className="space-y-3">
                {insights.insights.map((ins, i) => {
                  const Icon = INSIGHT_ICONS[ins.type] ?? Info;
                  const color = INSIGHT_COLORS[ins.type] ?? "#64748b";
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="p-4 rounded-xl"
                      style={{
                        background: `rgba(${color === "#ff3355" ? "255,51,85" : color === "#ff8800" ? "255,136,0" : color === "#00d4ff" ? "0,212,255" : "0,255,136"},0.05)`,
                        border: `1px solid ${color}22`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                        <span className="text-xs font-semibold" style={{ color }}>{ins.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{ins.body}</p>
                    </motion.div>
                  );
                })}

                {/* Cite box */}
                <div
                  className="p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="text-xs text-slate-600 mb-1 tracking-wider" style={{ fontSize: "0.6rem" }}>CITATION</div>
                  <div className="text-xs text-slate-700 leading-relaxed font-mono" style={{ fontSize: "0.7rem" }}>
                    Earth Pulse ({new Date().getFullYear()}). {country.name} Civilization Stress Index.
                    Score date: {insights.score_date ?? "—"}. Sources: World Bank, GDELT, FAO, UNHCR.
                    earthpulse.app/country/{country.iso3.toLowerCase()}
                  </div>
                  <a
                    href={exportCountryUrl(country.iso3)}
                    download
                    className="mt-2 flex items-center gap-1.5 text-xs transition-colors"
                    style={{ color: "#00d4ff" }}
                  >
                    <Download className="w-3 h-3" />
                    Download full dataset (CSV)
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "forecast" && (
          <ForecastTab iso3={country.iso3} name={country.name} currentScore={country.pulse_score} />
        )}
      </div>
    </motion.div>
  );
}
