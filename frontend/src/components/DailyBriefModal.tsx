"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { X, TrendingUp, AlertTriangle, BookmarkCheck, Newspaper } from "lucide-react";
import type { CountryScore } from "@/types";

const LS_LAST_SCORES = "earthpulse_last_scores";
const LS_LAST_VISIT  = "earthpulse_last_visit";

const CRITICAL_THRESHOLD = 45;

interface Props {
  scores: CountryScore[];
  watchlist: string[];
  onClose: () => void;
}

function scoreColor(v: number): string {
  return v >= 45 ? "#ff3355" : v >= 30 ? "#ff8800" : v >= 20 ? "#ffcc00" : "#00ff88";
}

function formatDate(date: Date): string {
  return date
    .toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

function timeSince(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d} day${d > 1 ? "s" : ""} ago`;
  if (h >= 1) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const m = Math.floor(diffMs / 60000);
  if (m >= 1) return `${m} minute${m > 1 ? "s" : ""} ago`;
  return "just now";
}

function markRead() {
  // Persist current scores as last-seen
  // (The parent calls onClose; we update localStorage here)
  localStorage.setItem(LS_LAST_VISIT, new Date().toISOString());
}

export default function DailyBriefModal({ scores, watchlist, onClose }: Props) {
  const lastVisit = useMemo(() => {
    try { return localStorage.getItem(LS_LAST_VISIT); } catch { return null; }
  }, []);

  const lastScores = useMemo<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(LS_LAST_SCORES);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, []);

  const hasHistory = Object.keys(lastScores).length > 0;

  // Section 1: New critical countries
  const newCritical = useMemo(() => {
    const scored = scores.filter((s) => s.pulse_score != null);
    if (hasHistory) {
      // Countries that newly crossed the threshold (weren't critical before)
      return scored
        .filter(
          (s) =>
            (s.pulse_score ?? 0) >= CRITICAL_THRESHOLD &&
            (lastScores[s.iso3] == null || lastScores[s.iso3] < CRITICAL_THRESHOLD)
        )
        .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
        .slice(0, 4);
    }
    // No history: show top 3 highest scored as "currently critical"
    return scored
      .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
      .slice(0, 3);
  }, [scores, lastScores, hasHistory]);

  // Section 2: Watchlist changes
  const watchlistChanges = useMemo(() => {
    return watchlist
      .map((iso3) => {
        const c = scores.find((s) => s.iso3 === iso3);
        if (!c || c.pulse_score == null) return null;
        const prev = lastScores[iso3];
        const delta = prev != null ? (c.pulse_score ?? 0) - prev : null;
        return { country: c, delta };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      .sort((a, b) => {
        // Sort by absolute delta descending; undelta entries at bottom
        const da = a.delta != null ? Math.abs(a.delta) : -1;
        const db = b.delta != null ? Math.abs(b.delta) : -1;
        return db - da;
      })
      .slice(0, 5);
  }, [scores, watchlist, lastScores]);

  // Section 3: Top story — most deteriorated country overall
  const topStory = useMemo(() => {
    if (!hasHistory) {
      // Fallback: highest scored country
      const top = [...scores]
        .filter((s) => s.pulse_score != null)
        .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))[0];
      return top
        ? {
            country: top,
            delta: null,
            line: `${top.name} leads global stress indicators at ${(top.pulse_score ?? 0).toFixed(1)}.`,
          }
        : null;
    }
    const worst = [...scores]
      .filter((s) => s.pulse_score != null && lastScores[s.iso3] != null)
      .map((s) => ({ country: s, delta: (s.pulse_score ?? 0) - lastScores[s.iso3] }))
      .sort((a, b) => b.delta - a.delta)[0];
    if (!worst || worst.delta <= 0) return null;
    return {
      country: worst.country,
      delta: worst.delta,
      line: `${worst.country.name} rose ${worst.delta.toFixed(1)} pts since last session — the sharpest single-country deterioration tracked.`,
    };
  }, [scores, lastScores, hasHistory]);

  const handleMarkRead = () => {
    markRead();
    // Persist current scores so next session has a baseline
    const snapshot: Record<string, number> = {};
    scores.forEach((s) => {
      if (s.iso3 && s.pulse_score != null) snapshot[s.iso3] = s.pulse_score;
    });
    try {
      localStorage.setItem(LS_LAST_SCORES, JSON.stringify(snapshot));
    } catch {}
    onClose();
  };

  const today = new Date();

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,8,20,0.88)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleMarkRead(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Daily brief"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "rgba(2,8,20,0.97)",
          border: "1px solid rgba(0,180,255,0.15)",
          borderRadius: 12,
          backdropFilter: "blur(20px)",
          boxShadow: "0 0 60px rgba(0,212,255,0.06), 0 24px 64px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,212,255,0.03)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.55rem",
                  letterSpacing: "0.18em",
                  color: "#00d4ff",
                  marginBottom: 4,
                  opacity: 0.8,
                }}
              >
                EARTHPULSE
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  color: "#e2e8f0",
                  letterSpacing: "0.08em",
                  lineHeight: 1.1,
                }}
              >
                MORNING BRIEF
              </div>
              <div
                style={{
                  fontSize: "0.62rem",
                  color: "#475569",
                  marginTop: 5,
                  letterSpacing: "0.06em",
                }}
              >
                {formatDate(today)}
              </div>
            </div>

            <button
              onClick={handleMarkRead}
              className="rounded p-1 transition-colors hover:bg-white/[0.06]"
              style={{ color: "#475569", flexShrink: 0, marginTop: 2 }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {lastVisit && (
            <div
              className="flex items-center gap-1.5 mt-3"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                padding: "5px 10px",
                display: "inline-flex",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#00d4ff", opacity: 0.6, flexShrink: 0 }}
              />
              <span style={{ fontSize: "0.66rem", color: "#64748b" }}>
                Since your last visit —
              </span>
              <span style={{ fontSize: "0.66rem", color: "#94a3b8" }}>
                {timeSince(lastVisit)}
              </span>
            </div>
          )}
        </div>

        {/* Sections */}
        <div
          style={{ padding: "0 20px", overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}
        >
          {/* Section 1: New Critical */}
          <BriefSection
            icon={<AlertTriangle className="w-3.5 h-3.5" style={{ color: "#ff3355" }} />}
            label={hasHistory ? "NEW CRITICAL" : "CURRENT CRITICAL"}
            accent="#ff3355"
          >
            {newCritical.length === 0 ? (
              <div style={{ color: "#334155", fontSize: "0.68rem", padding: "6px 0" }}>
                No new critical-level countries since last visit.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {newCritical.map((c) => {
                  const score = c.pulse_score ?? 0;
                  const color = scoreColor(score);
                  const prev = lastScores[c.iso3];
                  return (
                    <div
                      key={c.iso3}
                      className="flex items-center gap-2.5 rounded px-2.5 py-2"
                      style={{
                        background: "rgba(255,51,85,0.06)",
                        border: "1px solid rgba(255,51,85,0.12)",
                      }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: "#ff3355", boxShadow: "0 0 5px #ff335580" }}
                      />
                      <span
                        className="flex-1 truncate"
                        style={{ color: "#e2e8f0", fontSize: "0.75rem" }}
                      >
                        {c.name}
                      </span>
                      {prev != null && hasHistory && (
                        <span style={{ color: "#64748b", fontSize: "0.62rem", flexShrink: 0 }}>
                          was {prev.toFixed(0)}
                        </span>
                      )}
                      <span
                        className="font-mono font-bold flex-shrink-0"
                        style={{ color, fontSize: "0.78rem" }}
                      >
                        {score.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </BriefSection>

          {/* Section 2: Watchlist Changes */}
          <BriefSection
            icon={<BookmarkCheck className="w-3.5 h-3.5" style={{ color: "#00d4ff" }} />}
            label="WATCHLIST CHANGES"
            accent="#00d4ff"
          >
            {watchlist.length === 0 ? (
              <div
                className="rounded px-3 py-2.5"
                style={{
                  background: "rgba(0,212,255,0.04)",
                  border: "1px solid rgba(0,212,255,0.1)",
                  color: "#475569",
                  fontSize: "0.68rem",
                  lineHeight: 1.5,
                }}
              >
                Add countries to your watchlist for personalized tracking.
              </div>
            ) : watchlistChanges.length === 0 ? (
              <div style={{ color: "#334155", fontSize: "0.68rem", padding: "6px 0" }}>
                No data for your watchlist countries yet.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {watchlistChanges.map(({ country: c, delta }) => {
                  const score = c.pulse_score ?? 0;
                  const color = scoreColor(score);
                  return (
                    <div
                      key={c.iso3}
                      className="flex items-center gap-2.5 py-1.5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <span
                        className="font-mono flex-shrink-0"
                        style={{ color: "#334155", fontSize: "0.6rem", width: 28 }}
                      >
                        {c.iso3}
                      </span>
                      <span
                        className="flex-1 truncate"
                        style={{ color: "#94a3b8", fontSize: "0.72rem" }}
                      >
                        {c.name}
                      </span>

                      {delta != null && Math.abs(delta) >= 0.5 ? (
                        <span
                          className="font-mono font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                          style={{
                            fontSize: "0.65rem",
                            background: delta > 0 ? "rgba(255,51,85,0.1)" : "rgba(0,255,136,0.08)",
                            color: delta > 0 ? "#ff3355" : "#00ff88",
                            border: `1px solid ${delta > 0 ? "rgba(255,51,85,0.2)" : "rgba(0,255,136,0.15)"}`,
                          }}
                        >
                          {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ color: "#334155", fontSize: "0.62rem", flexShrink: 0 }}>
                          stable
                        </span>
                      )}

                      <span
                        className="font-mono font-bold flex-shrink-0"
                        style={{ color, fontSize: "0.75rem", width: 28, textAlign: "right" }}
                      >
                        {score.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </BriefSection>

          {/* Section 3: Top Story */}
          {topStory && (
            <BriefSection
              icon={<Newspaper className="w-3.5 h-3.5" style={{ color: "#ff8800" }} />}
              label="TOP STORY"
              accent="#ff8800"
            >
              <div
                className="rounded px-3 py-3"
                style={{
                  background: "rgba(255,136,0,0.05)",
                  border: "1px solid rgba(255,136,0,0.12)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: scoreColor(topStory.country.pulse_score ?? 0),
                      boxShadow: `0 0 6px ${scoreColor(topStory.country.pulse_score ?? 0)}80`,
                    }}
                  />
                  <span
                    className="font-semibold"
                    style={{ color: "#e2e8f0", fontSize: "0.8rem" }}
                  >
                    {topStory.country.name}
                  </span>
                  {topStory.delta != null && (
                    <span
                      className="font-mono font-bold"
                      style={{ color: "#ff3355", fontSize: "0.7rem" }}
                    >
                      +{topStory.delta.toFixed(1)}
                    </span>
                  )}
                  <span
                    className="font-mono font-bold ml-auto flex-shrink-0"
                    style={{
                      color: scoreColor(topStory.country.pulse_score ?? 0),
                      fontSize: "0.8rem",
                    }}
                  >
                    {(topStory.country.pulse_score ?? 0).toFixed(1)}
                  </span>
                </div>
                <p style={{ color: "#64748b", fontSize: "0.7rem", lineHeight: 1.55, margin: 0 }}>
                  {topStory.line}
                </p>
              </div>
            </BriefSection>
          )}

          {/* Spacer */}
          <div style={{ height: 8 }} />
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={handleMarkRead}
            className="flex-1 py-2 rounded text-xs font-semibold tracking-wide transition-all hover:bg-white/[0.06]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#64748b",
              fontSize: "0.7rem",
              letterSpacing: "0.06em",
            }}
          >
            Mark as read
          </button>
          <button
            onClick={handleMarkRead}
            className="flex-1 py-2 rounded text-xs font-bold tracking-wide transition-all"
            style={{
              background: "rgba(0,212,255,0.1)",
              border: "1px solid rgba(0,212,255,0.25)",
              color: "#00d4ff",
              fontSize: "0.7rem",
              letterSpacing: "0.06em",
              boxShadow: "0 0 20px rgba(0,212,255,0.08)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.16)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.1)";
            }}
          >
            Continue to Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Internal section wrapper
function BriefSection({
  icon,
  label,
  accent,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ paddingTop: 16, paddingBottom: 4 }}>
      <div
        className="flex items-center gap-2 mb-3"
        style={{ borderBottom: `1px solid ${accent}18`, paddingBottom: 7 }}
      >
        {icon}
        <span
          className="font-bold tracking-widest uppercase"
          style={{ fontSize: "0.58rem", color: "#475569", letterSpacing: "0.14em" }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}
