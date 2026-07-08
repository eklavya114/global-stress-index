"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchNews, fetchLatestScores, fetchStoryFinder } from "@/lib/api";
import type { CountryScore, StoryEntry } from "@/types";
import { Newspaper, AlertTriangle, ExternalLink, Clock, TrendingUp, ChevronRight, BookOpen, Globe, FileText, AlertOctagon } from "lucide-react";
import NexusTab from "./NexusTab";
import RegionsTab from "./RegionsTab";

interface Props {
  onCountryClick: (c: CountryScore) => void;
}

function timeAgo(seen: string): string {
  try {
    const d = new Date(
      seen.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z")
    );
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

function scoreColor(score: number | null): string {
  if (score == null) return "#475569";
  if (score < 30)   return "#00ff88";
  if (score < 55)   return "#ffcc00";
  if (score < 75)   return "#ff8800";
  return "#ff3355";
}

function BriefTab({ scores }: { scores: CountryScore[] }) {
  const [timestamp] = useState(() => {
    const d = new Date();
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  });

  const sorted = [...scores]
    .filter((s) => s.pulse_score != null)
    .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0));

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-32">
        <span className="text-xs text-slate-600 animate-pulse tracking-widest">GENERATING BRIEF…</span>
      </div>
    );
  }

  const total   = sorted.length;
  const avg     = sorted.reduce((s, c) => s + (c.pulse_score ?? 0), 0) / total;
  const critical = sorted.filter((c) => (c.pulse_score ?? 0) >= 45);
  const stable   = sorted.filter((c) => (c.pulse_score ?? 0) < 15);

  const threatLabel =
    avg >= 45 ? "CRITICAL" : avg >= 35 ? "HIGH" : avg >= 25 ? "MODERATE" : avg >= 15 ? "LOW" : "MINIMAL";
  const threatColor =
    avg >= 45 ? "#ff3355" : avg >= 35 ? "#ff8800" : avg >= 25 ? "#ffcc00" : avg >= 15 ? "#66ff66" : "#00ff88";

  const withSub = sorted.filter(
    (s) => s.conflict_score != null && s.food_score != null && s.economic_score != null
  );
  const avgC = withSub.length ? withSub.reduce((s, c) => s + (c.conflict_score ?? 0), 0) / withSub.length : 0;
  const avgF = withSub.length ? withSub.reduce((s, c) => s + (c.food_score    ?? 0), 0) / withSub.length : 0;
  const avgE = withSub.length ? withSub.reduce((s, c) => s + (c.economic_score ?? 0), 0) / withSub.length : 0;
  const globalDriver =
    avgC >= avgF && avgC >= avgE ? "armed conflict & political instability" :
    avgF >= avgC && avgF >= avgE ? "food insecurity & agricultural stress"  :
    "economic instability & fiscal pressure";

  const REGIONS = ["Africa", "Asia", "Americas", "Europe", "Oceania"] as const;
  const regionStats = REGIONS.map((r) => {
    const group = sorted.filter((s) => s.region === r);
    if (!group.length) return null;
    const ravg = group.reduce((s, c) => s + (c.pulse_score ?? 0), 0) / group.length;
    return { name: r, avg: ravg, count: group.length };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const priority = [...sorted.filter((c) => (c.pulse_score ?? 0) >= 45), ...sorted.filter((c) => (c.pulse_score ?? 0) >= 35 && (c.pulse_score ?? 0) < 45)];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4" style={{ fontFamily: "'Courier New', 'Lucida Console', monospace", lineHeight: 1.65 }}>

        {/* Document header */}
        <div style={{ borderBottom: "1px solid rgba(0,212,255,0.12)", paddingBottom: 10 }}>
          <div style={{ color: "#00d4ff", fontSize: "0.7rem", fontWeight: "bold", letterSpacing: "0.12em" }}>
            ▸ SITUATION REPORT
          </div>
          <div style={{ color: "#334155", fontSize: "0.58rem", letterSpacing: "0.08em", marginTop: 2 }}>
            GLOBAL THREAT ASSESSMENT // UNCLASSIFIED
          </div>
          <div style={{ color: "#1e293b", fontSize: "0.58rem", marginTop: 3 }}>
            GENERATED: {timestamp}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
            padding: "2px 8px", borderRadius: 4,
            background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.1)",
            color: "#0e7490", fontSize: "0.56rem", letterSpacing: "0.06em",
          }}>
            EARTHPULSE · {total} NATIONS MONITORED
          </div>
        </div>

        {/* 01 Executive Summary */}
        <div>
          <div style={{ color: "#475569", fontSize: "0.58rem", letterSpacing: "0.12em", marginBottom: 6 }}>
            01 / EXECUTIVE SUMMARY
          </div>
          <p style={{ color: "#94a3b8", fontSize: "0.68rem", margin: 0 }}>
            Global Pulse Index:{" "}
            <span style={{ color: "#e2e8f0", fontWeight: "bold" }}>{avg.toFixed(1)}</span>.
            {" "}Threat level:{" "}
            <span style={{ color: threatColor, fontWeight: "bold" }}>{threatLabel}</span>.
            {" "}Primary stressor:{" "}
            <span style={{ color: "#64748b", fontStyle: "italic" }}>{globalDriver}</span>.
            {critical.length > 0
              ? ` ${critical.length} nation${critical.length === 1 ? "" : "s"} at CRITICAL threshold.`
              : " No nations at CRITICAL threshold."}
          </p>
        </div>

        {/* 02 Priority Concerns */}
        {priority.length > 0 && (
          <div>
            <div style={{ color: "#475569", fontSize: "0.58rem", letterSpacing: "0.12em", marginBottom: 8 }}>
              02 / PRIORITY CONCERNS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {priority.slice(0, 5).map((c) => {
                const isCrit = (c.pulse_score ?? 0) >= 45;
                const maxSub = Math.max(c.conflict_score ?? 0, c.food_score ?? 0, c.economic_score ?? 0);
                const driver =
                  maxSub === c.conflict_score ? "Armed conflict / political violence" :
                  maxSub === c.food_score     ? "Food insecurity / famine conditions" :
                  "Economic destabilization / fiscal crisis";
                const driverColor =
                  maxSub === c.conflict_score ? "#ff6680" :
                  maxSub === c.food_score     ? "#ff9933" : "#60a5fa";
                return (
                  <div key={c.iso3} style={{ borderLeft: `2px solid ${isCrit ? "#ff335530" : "#ff880025"}`, paddingLeft: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ color: isCrit ? "#ff6680" : "#ff9933", fontSize: "0.69rem", fontWeight: "bold" }}>
                        {c.name}
                      </span>
                      <span style={{ color: "#334155", fontSize: "0.58rem" }}>
                        [{(c.pulse_score ?? 0).toFixed(1)}]
                      </span>
                    </div>
                    <div style={{ color: driverColor, fontSize: "0.62rem" }}>↳ {driver}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 03 Regional Assessment */}
        <div>
          <div style={{ color: "#475569", fontSize: "0.58rem", letterSpacing: "0.12em", marginBottom: 6 }}>
            03 / REGIONAL ASSESSMENT
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {regionStats.map(({ name, avg: ravg, count }) => {
              const rc = ravg >= 45 ? "#ff3355" : ravg >= 35 ? "#ff8800" : ravg >= 25 ? "#ffcc00" : "#22d36b";
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#475569", fontSize: "0.6rem", width: 56, flexShrink: 0 }}>{name}</span>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min((ravg / 55) * 100, 100)}%`, background: rc, transition: "width 0.5s ease" }} />
                  </div>
                  <span style={{ color: rc, fontSize: "0.6rem", fontWeight: "bold", width: 28, textAlign: "right", flexShrink: 0 }}>{ravg.toFixed(1)}</span>
                  <span style={{ color: "#1e293b", fontSize: "0.56rem", flexShrink: 0 }}>n={count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 04 Stable zones */}
        {stable.length > 0 && (
          <div>
            <div style={{ color: "#475569", fontSize: "0.58rem", letterSpacing: "0.12em", marginBottom: 4 }}>
              04 / STABLE ZONES
            </div>
            <p style={{ color: "#475569", fontSize: "0.64rem", margin: 0 }}>
              {stable.length} nations below minimal threshold.{" "}
              <span style={{ color: "#334155" }}>
                Incl. {stable.slice(0, 3).map((s) => s.name).join(", ")}
                {stable.length > 3 ? ` +${stable.length - 3} others` : ""}.
              </span>
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10, color: "#1e293b", fontSize: "0.56rem", lineHeight: 1.7 }}>
          <div>SOURCES: World Bank · GDELT · FAO · UNHCR</div>
          <div>MODEL: XGBoost (Pulse = 0.40×Conflict + 0.30×Food + 0.30×Economic)</div>
          <div>NOTE: Statistical analysis only. For informational purposes.</div>
        </div>
      </div>
    </div>
  );
}

export default function IntelPanel({ onCountryClick }: Props) {
  const [activeTab, setActiveTab] = useState<"news" | "alerts" | "stories" | "regions" | "brief" | "nexus">("news");
  const [newsTopic, setNewsTopic] = useState<"conflict" | "food" | "economic">("conflict");

  const { data: news = [], isLoading: newsLoading } = useQuery({
    queryKey: ["news", newsTopic],
    queryFn: () => fetchNews(newsTopic),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["latest-scores"],
    queryFn: fetchLatestScores,
    refetchInterval: 60000,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ["story-finder"],
    queryFn: fetchStoryFinder,
    refetchInterval: 15 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });

  const topStressed = [...scores]
    .filter(s => s.pulse_score != null)
    .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
    .slice(0, 15);

  const tabs = [
    { key: "news"    as const, label: "News",    icon: Newspaper },
    { key: "alerts"  as const, label: "Alerts",  icon: AlertTriangle },
    { key: "stories" as const, label: "Stories", icon: BookOpen },
    { key: "regions" as const, label: "Regions", icon: Globe },
    { key: "brief"   as const, label: "Brief",   icon: FileText },
    { key: "nexus"   as const, label: "Nexus",   icon: AlertOctagon },
  ];

  return (
    <motion.aside
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col flex-shrink-0"
      style={{
        width: 300,
        background: "rgba(2, 8, 20, 0.94)",
        borderLeft: "1px solid rgba(0, 180, 255, 0.1)",
      }}
    >
      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all"
              style={{
                color: active ? "#00d4ff" : "#475569",
                borderBottom: active ? "2px solid #00d4ff" : "2px solid transparent",
                background: active ? "rgba(0,212,255,0.04)" : "transparent",
              }}
            >
              <Icon className="w-3 h-3" />
              <span className="font-medium" style={{ fontSize: "0.58rem", letterSpacing: "0.04em" }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* NEWS */}
      {activeTab === "news" && (
        <>
          <div
            className="flex gap-1 px-3 py-2 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
          >
            {(["conflict", "food", "economic"] as const).map(t => (
              <button
                key={t}
                onClick={() => setNewsTopic(t)}
                className="px-2.5 py-1 rounded text-xs transition-all capitalize"
                style={{
                  background: newsTopic === t ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                  color: newsTopic === t ? "#00d4ff" : "#475569",
                  border: newsTopic === t ? "1px solid rgba(0,212,255,0.25)" : "1px solid transparent",
                }}
              >
                {t}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-500">LIVE</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {newsLoading ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-xs text-slate-600 animate-pulse tracking-widest">FETCHING…</span>
              </div>
            ) : news.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 px-5 text-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.12)" }}>
                  <Newspaper className="w-4 h-4" style={{ color: "#334155" }} />
                </div>
                <span className="text-xs text-slate-600 leading-relaxed">GDELT feed temporarily rate-limited.</span>
                <span className="text-xs text-slate-700" style={{ fontSize: "0.62rem" }}>Auto-refreshes every 5 minutes</span>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {news.map((article, i) => (
                  <motion.a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="block px-4 py-3 hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: "rgba(0,212,255,0.08)", color: "#00b4e0", border: "1px solid rgba(0,212,255,0.15)", fontSize: "0.65rem", letterSpacing: "0.05em" }}>
                        {article.domain?.replace(/^www\./, "").split(".")[0].toUpperCase() || "SOURCE"}
                      </span>
                      <div className="flex items-center gap-1 text-slate-700 text-xs flex-shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo(article.seen_at)}
                      </div>
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed group-hover:text-white transition-colors line-clamp-3">
                      {article.title}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-slate-700 group-hover:text-slate-500 transition-colors">
                      <ExternalLink className="w-2.5 h-2.5" />
                      <span className="text-xs">Read more</span>
                    </div>
                  </motion.a>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* STORIES */}
      {activeTab === "stories" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,182,39,0.04)" }}>
            <div className="text-xs font-semibold tracking-wider" style={{ color: "#FFB627", fontSize: "0.7rem" }}>UNDERREPORTED CRISES</div>
            <div className="text-xs text-slate-600 mt-0.5" style={{ fontSize: "0.64rem" }}>High stress, low media coverage</div>
          </div>
          {stories.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-xs text-slate-600 animate-pulse">Loading…</span>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {stories.map((s, i) => <StoryCard key={s.iso3} story={s} rank={i + 1} />)}
            </div>
          )}
        </div>
      )}

      {/* REGIONS */}
      {activeTab === "regions" && (
        <div className="flex-1 overflow-y-auto">
          <RegionsTab scores={scores} />
        </div>
      )}

      {/* ALERTS */}
      {activeTab === "alerts" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2.5 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <TrendingUp className="w-3 h-3 text-red-400" />
            <span className="text-xs text-slate-400 tracking-wider">HIGHEST STRESS COUNTRIES</span>
          </div>
          {topStressed.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-xs text-slate-600 animate-pulse">Waiting for scores…</span>
            </div>
          ) : (
            <div className="py-1">
              {topStressed.map((c, i) => {
                const color = scoreColor(c.pulse_score);
                return (
                  <motion.button
                    key={c.iso3}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => onCountryClick(c)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left group"
                  >
                    <span className="text-xs font-mono text-slate-700 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="text-xs font-mono px-1 rounded flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "1px solid rgba(255,255,255,0.07)", fontSize: "0.6rem" }}>
                      {c.iso3}
                    </span>
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors flex-1 truncate">{c.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="h-1 rounded-full" style={{ width: 40, background: "rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full" style={{ width: `${c.pulse_score ?? 0}%`, background: `linear-gradient(90deg, ${color}66, ${color})` }} />
                      </div>
                      <span className="text-xs font-mono font-bold w-8 text-right" style={{ color }}>
                        {c.pulse_score?.toFixed(0) ?? "—"}
                      </span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-slate-400 flex-shrink-0" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BRIEF */}
      {activeTab === "brief" && <BriefTab scores={scores} />}

      {/* NEXUS */}
      {activeTab === "nexus" && (
        <div className="flex-1 overflow-y-auto">
          <NexusTab onCountryClick={(iso3, name) => {
            const c = scores.find((s) => s.iso3 === iso3);
            if (c) onCountryClick(c);
          }} />
        </div>
      )}
    </motion.aside>
  );
}

function StoryCard({ story, rank }: { story: StoryEntry; rank: number }) {
  const sColor = story.pulse_score >= 75 ? "#ff3355" : story.pulse_score >= 55 ? "#ff8800" : "#ffcc00";
  const popFmt = story.population >= 1e6
    ? `${(story.population / 1e6).toFixed(0)}M pop`
    : story.population >= 1e3
    ? `${(story.population / 1e3).toFixed(0)}K pop`
    : `${story.population} pop`;

  return (
    <div className="px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-default">
      <div className="flex items-start gap-2 mb-1.5">
        <span className="text-xs text-slate-700 font-mono w-4 flex-shrink-0 mt-0.5">{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-slate-200 truncate">{story.name}</span>
            <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: sColor }}>{story.pulse_score.toFixed(0)}</span>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed line-clamp-2" style={{ fontSize: "0.7rem" }}>{story.story_angle}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,182,39,0.1)", color: "#FFB627", fontSize: "0.6rem", border: "1px solid rgba(255,182,39,0.2)" }}>
              UNDERREPORTED
            </span>
            <span className="text-xs text-slate-700" style={{ fontSize: "0.6rem" }}>{popFmt}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
