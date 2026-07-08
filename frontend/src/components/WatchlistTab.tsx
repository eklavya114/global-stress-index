"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { CountryScore } from "@/types";

const LS_WATCHLIST   = "earthpulse_watchlist";
const LS_LAST_SCORES = "earthpulse_last_scores";
const LS_LAST_VISIT  = "earthpulse_last_visit";

interface Props {
  scores: CountryScore[];
  onCountryClick: (c: CountryScore) => void;
}

function scoreColor(v: number): string {
  return v >= 45 ? "#ff3355" : v >= 30 ? "#ff8800" : v >= 20 ? "#ffcc00" : "#00ff88";
}

function severityLabel(v: number): string {
  return v >= 45 ? "CRITICAL" : v >= 30 ? "HIGH" : v >= 20 ? "ELEVATED" : "STABLE";
}

function timeSince(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  return "just now";
}

export default function WatchlistTab({ scores, onCountryClick }: Props) {
  const [watchlist,   setWatchlist]   = useState<string[]>([]);
  const [lastScores,  setLastScores]  = useState<Record<string, number>>({});
  const [lastVisit,   setLastVisit]   = useState<string | null>(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [query,       setQuery]       = useState("");
  const [showBrief,   setShowBrief]   = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const wl = localStorage.getItem(LS_WATCHLIST);
      if (wl) setWatchlist(JSON.parse(wl));
      const ls = localStorage.getItem(LS_LAST_SCORES);
      if (ls) setLastScores(JSON.parse(ls));
      const lv = localStorage.getItem(LS_LAST_VISIT);
      if (lv) setLastVisit(lv);
    } catch {}
  }, []);

  // When "add" panel opens, focus the input
  useEffect(() => {
    if (showAdd) searchRef.current?.focus();
  }, [showAdd]);

  const persist = (list: string[]) => {
    setWatchlist(list);
    localStorage.setItem(LS_WATCHLIST, JSON.stringify(list));
  };

  const addCountry = (iso3: string) => {
    if (!watchlist.includes(iso3)) {
      persist([...watchlist, iso3]);
    }
    setShowAdd(false);
    setQuery("");
  };

  const removeCountry = (iso3: string) => {
    persist(watchlist.filter((w) => w !== iso3));
  };

  // Compute deltas (only shown if diff >= 2)
  const getDelta = (iso3: string, current: number): number | null => {
    const prev = lastScores[iso3];
    if (prev == null) return null;
    const diff = current - prev;
    return Math.abs(diff) >= 2 ? diff : null;
  };

  const watchedCountries = watchlist
    .map((iso3) => scores.find((s) => s.iso3 === iso3))
    .filter((c): c is CountryScore => c != null);

  // Suggested quick-adds (top scored not already in watchlist)
  const suggested = [...scores]
    .filter((s) => s.pulse_score != null && !watchlist.includes(s.iso3))
    .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
    .slice(0, 3);

  // Filtered countries for add panel
  const filtered = query.trim().length > 0
    ? scores
        .filter(
          (s) =>
            !watchlist.includes(s.iso3) &&
            (s.name.toLowerCase().includes(query.toLowerCase()) ||
              s.iso3.toLowerCase().includes(query.toLowerCase()))
        )
        .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
        .slice(0, 8)
    : [];

  // Build mini brief text
  const buildBrief = () => {
    if (watchedCountries.length === 0) return null;

    const critical = watchedCountries.filter((c) => (c.pulse_score ?? 0) >= 45);
    const deteriorating = watchedCountries.filter((c) => {
      const delta = getDelta(c.iso3, c.pulse_score ?? 0);
      return delta != null && delta > 0;
    });
    const stable = watchedCountries.filter((c) => {
      const delta = getDelta(c.iso3, c.pulse_score ?? 0);
      return delta == null || Math.abs(delta) < 2;
    });

    const topDeteriorating = [...deteriorating].sort((a, b) => {
      const da = getDelta(a.iso3, a.pulse_score ?? 0) ?? 0;
      const db = getDelta(b.iso3, b.pulse_score ?? 0) ?? 0;
      return db - da;
    })[0];

    const parts: string[] = [];
    if (critical.length > 0) {
      parts.push(
        `${critical.map((c) => c.name).join(", ")} ${critical.length === 1 ? "is" : "are"} at critical`
      );
    }
    if (deteriorating.length > 0 && deteriorating.length !== critical.length) {
      const names = deteriorating
        .filter((c) => !critical.includes(c))
        .map((c) => c.name)
        .join(", ");
      if (names) parts.push(`${names} deteriorating`);
    }
    if (stable.length > 0) {
      parts.push(
        `${stable[0].name}${stable.length > 1 ? ` +${stable.length - 1}` : ""} stable${lastVisit ? ` since last visit` : ""}`
      );
    }

    let summary = parts.join(". ");
    if (!summary) summary = `${watchedCountries.length} countries tracked.`;

    if (topDeteriorating) {
      const delta = getDelta(topDeteriorating.iso3, topDeteriorating.pulse_score ?? 0);
      if (delta != null) {
        summary += ` ${topDeteriorating.name} rose ${delta.toFixed(1)} pts — highest change this session.`;
      }
    }

    return summary;
  };

  const brief = buildBrief();

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontSize: "0.72rem" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span
          className="font-bold tracking-widest uppercase"
          style={{ color: "#475569", fontSize: "0.58rem", letterSpacing: "0.12em" }}
        >
          WATCHLIST
          <span style={{ color: "#334155" }}> · {watchlist.length}</span>
        </span>
        <button
          onClick={() => { setShowAdd((v) => !v); setQuery(""); }}
          className="flex items-center gap-1 px-2 py-0.5 rounded transition-all"
          style={{
            background: showAdd ? "rgba(0,212,255,0.12)" : "rgba(0,212,255,0.05)",
            border: "1px solid rgba(0,212,255,0.2)",
            color: "#00d4ff",
            fontSize: "0.6rem",
            letterSpacing: "0.06em",
          }}
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Add panel */}
      {showAdd && (
        <div
          className="flex-shrink-0"
          style={{
            borderBottom: "1px solid rgba(0,212,255,0.1)",
            background: "rgba(0,212,255,0.03)",
          }}
        >
          <div className="px-3 pt-2 pb-1">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country…"
              className="w-full rounded px-2.5 py-1.5 outline-none text-xs"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(0,212,255,0.2)",
                color: "#e2e8f0",
                fontSize: "0.72rem",
              }}
            />
          </div>
          {filtered.length > 0 && (
            <div
              className="overflow-y-auto"
              style={{ maxHeight: 140 }}
            >
              {filtered.map((c) => {
                const score = c.pulse_score ?? 0;
                const color = scoreColor(score);
                return (
                  <button
                    key={c.iso3}
                    onClick={() => addCountry(c.iso3)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all hover:bg-white/[0.04]"
                  >
                    <span style={{ color: "#475569", width: 28, fontSize: "0.6rem", flexShrink: 0 }}>{c.iso3}</span>
                    <span className="flex-1 truncate" style={{ color: "#94a3b8" }}>{c.name}</span>
                    <span className="font-mono font-bold" style={{ color, fontSize: "0.7rem", flexShrink: 0 }}>
                      {score.toFixed(0)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {query.trim().length > 0 && filtered.length === 0 && (
            <div className="px-3 py-2" style={{ color: "#475569", fontSize: "0.65rem" }}>
              No results
            </div>
          )}
        </div>
      )}

      {/* Watchlist body */}
      <div className="flex-1 overflow-y-auto">
        {watchedCountries.length === 0 ? (
          <div className="flex flex-col items-center px-3 py-5 gap-4">
            <div
              className="text-center"
              style={{ color: "#334155", fontSize: "0.68rem", lineHeight: 1.5 }}
            >
              Pin countries for daily tracking
            </div>

            {suggested.length > 0 && (
              <div className="w-full flex flex-col gap-1">
                <div
                  className="px-1 mb-0.5 uppercase tracking-widest"
                  style={{ color: "#334155", fontSize: "0.55rem" }}
                >
                  Suggested
                </div>
                {suggested.map((c) => {
                  const score = c.pulse_score ?? 0;
                  const color = scoreColor(score);
                  return (
                    <button
                      key={c.iso3}
                      onClick={() => addCountry(c.iso3)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded transition-all"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span className="flex-1 truncate text-left" style={{ color: "#64748b" }}>{c.name}</span>
                      <span className="font-mono" style={{ color, fontSize: "0.68rem", flexShrink: 0 }}>
                        {score.toFixed(0)}
                      </span>
                      <Plus className="w-3 h-3 flex-shrink-0" style={{ color: "#334155" }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {watchedCountries.map((c) => {
              const score = c.pulse_score ?? 0;
              const color = scoreColor(score);
              const delta = getDelta(c.iso3, score);
              return (
                <button
                  key={c.iso3}
                  onClick={() => onCountryClick(c)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all hover:bg-white/[0.03] group"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  {/* Status dot */}
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: color,
                      boxShadow: score >= 45 ? `0 0 5px ${color}` : "none",
                    }}
                  />

                  {/* Name + ISO */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="truncate font-medium"
                      style={{ color: "#e2e8f0", fontSize: "0.72rem" }}
                    >
                      {c.name}
                    </div>
                    <div
                      className="font-mono"
                      style={{ color: "#334155", fontSize: "0.58rem" }}
                    >
                      {c.iso3}
                    </div>
                  </div>

                  {/* Mini score bar */}
                  <div
                    className="flex-shrink-0 rounded-full overflow-hidden"
                    style={{ width: 40, height: 3, background: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(score, 100)}%`,
                        background: `linear-gradient(90deg, ${color}55, ${color})`,
                      }}
                    />
                  </div>

                  {/* Score */}
                  <span
                    className="font-mono font-bold flex-shrink-0"
                    style={{ color, fontSize: "0.72rem", width: 22, textAlign: "right" }}
                  >
                    {score.toFixed(0)}
                  </span>

                  {/* Delta badge */}
                  {delta != null && (
                    <span
                      className="flex-shrink-0 font-mono font-bold px-1 rounded"
                      style={{
                        fontSize: "0.58rem",
                        background: delta > 0 ? "rgba(255,51,85,0.12)" : "rgba(0,255,136,0.1)",
                        color: delta > 0 ? "#ff3355" : "#00ff88",
                        border: `1px solid ${delta > 0 ? "rgba(255,51,85,0.25)" : "rgba(0,255,136,0.2)"}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {delta > 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(1)}
                    </span>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCountry(c.iso3); }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                    style={{ color: "#475569" }}
                    aria-label={`Remove ${c.name} from watchlist`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Brief footer */}
      {watchedCountries.length > 0 && (
        <div
          className="flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={() => setShowBrief((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 transition-all hover:bg-white/[0.02]"
            style={{ color: "#475569" }}
          >
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" style={{ color: "#00d4ff", opacity: 0.7 }} />
              <span
                className="uppercase tracking-widest font-bold"
                style={{ color: "#334155", fontSize: "0.58rem" }}
              >
                Brief
              </span>
              {lastVisit && (
                <span style={{ color: "#334155", fontSize: "0.56rem" }}>
                  · {timeSince(lastVisit)}
                </span>
              )}
            </div>
            {showBrief ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showBrief && brief && (
            <div
              className="px-3 pb-3"
              style={{
                color: "#64748b",
                fontSize: "0.66rem",
                lineHeight: 1.55,
                borderTop: "1px solid rgba(255,255,255,0.04)",
                paddingTop: 8,
              }}
            >
              {brief}
            </div>
          )}

          {showBrief && !brief && (
            <div
              className="px-3 pb-3"
              style={{
                color: "#334155",
                fontSize: "0.64rem",
                lineHeight: 1.5,
                borderTop: "1px solid rgba(255,255,255,0.04)",
                paddingTop: 8,
              }}
            >
              Visit again tomorrow for a session comparison.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
