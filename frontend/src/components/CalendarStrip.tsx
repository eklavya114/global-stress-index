"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Vote,
  Globe2,
  Heart,
  Shield,
  Lock,
  Users,
  ChevronDown,
  X,
  CalendarDays,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type EventType =
  | "election"
  | "summit"
  | "humanitarian"
  | "ceasefire"
  | "sanctions"
  | "peace";

interface CalendarEvent {
  date: string;
  iso3: string | null;
  name: string | null;
  event_type: EventType;
  title: string;
  description: string;
  predicted_impact: number;
  historical_basis: string | null;
  days_until: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const EVENT_ICONS: Record<EventType, React.ElementType> = {
  election: Vote,
  summit: Globe2,
  humanitarian: Heart,
  ceasefire: Shield,
  sanctions: Lock,
  peace: Users,
};

const EVENT_LABELS: Record<EventType, string> = {
  election: "ELECTION",
  summit: "SUMMIT",
  humanitarian: "AID",
  ceasefire: "CEASEFIRE",
  sanctions: "SANCTIONS",
  peace: "PEACE",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pillBorderColor(impact: number): string {
  if (impact > 2.0) return "rgba(255,51,85,0.45)";
  if (impact < -1.5) return "rgba(0,255,136,0.35)";
  return "rgba(255,255,255,0.08)";
}

function impactConfig(impact: number): { color: string; bg: string; label: string } {
  const sign = impact >= 0 ? "+" : "";
  const label = `${sign}${impact.toFixed(1)}`;
  if (impact > 2)
    return { color: "#ff3355", bg: "rgba(255,51,85,0.12)", label };
  if (impact >= 1)
    return { color: "#ff8800", bg: "rgba(255,136,0,0.12)", label };
  if (impact < -1)
    return { color: "#00ff88", bg: "rgba(0,255,136,0.1)", label };
  return { color: "#475569", bg: "rgba(255,255,255,0.04)", label };
}

function fmtCountdown(days: number): string {
  if (days === 0) return "TODAY";
  if (days === 1) return "in 1d";
  return `in ${days}d`;
}

function fmtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function EventPill({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: (e: CalendarEvent) => void;
}) {
  const Icon = EVENT_ICONS[event.event_type] ?? CalendarDays;
  const borderColor = pillBorderColor(event.predicted_impact);
  const isToday = event.days_until === 0;

  return (
    <button
      onClick={() => onClick(event)}
      title={event.title}
      className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none transition-all"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${borderColor}`,
        borderRadius: 4,
        padding: "2px 8px",
        height: 22,
        outline: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(255,255,255,0.03)";
      }}
    >
      <Icon
        className="w-2.5 h-2.5 flex-shrink-0"
        style={{ color: "#00d4ff", opacity: 0.7 }}
      />
      <span
        className="font-mono flex-shrink-0"
        style={{
          fontSize: "0.58rem",
          color: isToday ? "#00ff88" : "#475569",
          letterSpacing: "0.04em",
          fontWeight: isToday ? 700 : 400,
        }}
      >
        {fmtCountdown(event.days_until)}
      </span>
      <span
        className="truncate"
        style={{
          fontSize: "0.68rem",
          color: "#64748b",
          maxWidth: 110,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {event.title}
      </span>
    </button>
  );
}

// ─── Expanded panel row ───────────────────────────────────────────────────────

function PanelRow({ event }: { event: CalendarEvent }) {
  const Icon = EVENT_ICONS[event.event_type] ?? CalendarDays;
  const impact = impactConfig(event.predicted_impact);
  const isToday = event.days_until === 0;

  return (
    <div
      className="flex items-start gap-3 px-4 py-2.5 transition-colors"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background =
          "rgba(255,255,255,0.025)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Date */}
      <div
        className="flex-shrink-0 font-mono text-right"
        style={{ width: 72, color: "#334155", fontSize: "0.62rem" }}
      >
        <div style={{ color: isToday ? "#00ff88" : "#475569", fontWeight: isToday ? 700 : 400 }}>
          {isToday ? "TODAY" : fmtCountdown(event.days_until)}
        </div>
        <div style={{ color: "#1e293b", fontSize: "0.56rem" }}>
          {fmtDate(event.date)}
        </div>
      </div>

      {/* Country */}
      <div
        className="flex-shrink-0 font-mono truncate"
        style={{ width: 64, color: "#334155", fontSize: "0.62rem" }}
        title={event.name ?? "Global"}
      >
        {event.name ?? "—"}
      </div>

      {/* Icon + type */}
      <div
        className="flex-shrink-0 flex items-center gap-1"
        style={{ width: 80 }}
      >
        <Icon className="w-3 h-3" style={{ color: "#00d4ff", opacity: 0.6 }} />
        <span
          className="font-mono tracking-widest"
          style={{ fontSize: "0.52rem", color: "#334155" }}
        >
          {EVENT_LABELS[event.event_type]}
        </span>
      </div>

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <div
          className="font-medium truncate"
          style={{ fontSize: "0.72rem", color: "#94a3b8" }}
        >
          {event.title}
        </div>
        <div
          className="mt-0.5"
          style={{ fontSize: "0.62rem", color: "#334155", lineHeight: 1.4 }}
        >
          {event.description}
        </div>
      </div>

      {/* Impact badge */}
      <div
        className="flex-shrink-0 font-mono font-bold text-right"
        style={{
          fontSize: "0.65rem",
          color: impact.color,
          background: impact.bg,
          border: `1px solid ${impact.color}30`,
          borderRadius: 3,
          padding: "1px 6px",
        }}
      >
        {impact.label}
      </div>
    </div>
  );
}

// ─── Tooltip/detail popover ───────────────────────────────────────────────────

function EventDetail({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const Icon = EVENT_ICONS[event.event_type] ?? CalendarDays;
  const impact = impactConfig(event.predicted_impact);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.14 }}
      className="absolute top-full mt-1 left-1/2 z-40"
      style={{
        transform: "translateX(-50%)",
        background: "rgba(3,8,22,0.98)",
        border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 6,
        padding: "12px 14px",
        minWidth: 260,
        maxWidth: 340,
        boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(0,212,255,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: "#00d4ff" }} />
          <span
            className="font-mono tracking-widest"
            style={{ fontSize: "0.55rem", color: "#334155" }}
          >
            {EVENT_LABELS[event.event_type]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0"
          style={{ color: "#334155" }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div
        className="font-medium mb-1"
        style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.3 }}
      >
        {event.title}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span
          className="font-mono"
          style={{ fontSize: "0.6rem", color: "#334155" }}
        >
          {fmtDate(event.date)}
        </span>
        {event.name && (
          <>
            <span style={{ color: "#1e293b" }}>·</span>
            <span
              className="font-mono"
              style={{ fontSize: "0.6rem", color: "#334155" }}
            >
              {event.name}
            </span>
          </>
        )}
        <span
          className="font-mono font-bold ml-auto"
          style={{
            fontSize: "0.62rem",
            color: impact.color,
            background: impact.bg,
            border: `1px solid ${impact.color}30`,
            borderRadius: 3,
            padding: "1px 5px",
          }}
        >
          {impact.label}
        </span>
      </div>

      <div
        style={{
          fontSize: "0.68rem",
          color: "#475569",
          lineHeight: 1.5,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: 8,
        }}
      >
        {event.description}
      </div>

      {event.historical_basis && (
        <div
          className="mt-2 pt-2"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.04)",
            fontSize: "0.6rem",
            color: "#334155",
            fontStyle: "italic",
          }}
        >
          Historical: {event.historical_basis}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarStrip() {
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>();
  const posRef = useRef(0);
  const pausedRef = useRef(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/calendar`);
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return res.json();
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 9 * 60 * 1000,
  });

  // Show the next 5-8 events for the scrolling strip
  const pillEvents = events.slice(0, 8);
  const displayEvents = [...pillEvents, ...pillEvents]; // duplicate for seamless loop

  // Smooth scrolling animation
  useEffect(() => {
    const track = trackRef.current;
    if (!track || pillEvents.length === 0) return;

    const speed = 0.42; // px/frame — deliberately slow, deliberate pacing

    const animate = () => {
      if (!pausedRef.current) {
        posRef.current -= speed;
        const halfWidth = track.scrollWidth / 2;
        if (Math.abs(posRef.current) >= halfWidth) {
          posRef.current = 0;
        }
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [pillEvents.length]);

  const handlePillClick = useCallback((event: CalendarEvent) => {
    setActiveEvent((prev) =>
      prev?.title === event.title ? null : event
    );
  }, []);

  const closeDetail = useCallback(() => setActiveEvent(null), []);

  // Close panel/detail on outside click
  useEffect(() => {
    if (!panelOpen && !activeEvent) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-calendar-root]")) {
        setPanelOpen(false);
        setActiveEvent(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen, activeEvent]);

  if (isLoading || pillEvents.length === 0) {
    // Minimal placeholder that preserves height
    return (
      <div
        className="flex-shrink-0 flex items-center overflow-hidden"
        style={{
          height: 36,
          background: "rgba(2,6,16,0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="flex items-center flex-shrink-0 px-3 gap-2 h-full"
          style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
        >
          <CalendarDays
            className="w-2.5 h-2.5"
            style={{ color: "#1e293b" }}
          />
          <span
            className="uppercase tracking-widest"
            style={{ fontSize: "0.52rem", color: "#1e293b", letterSpacing: "0.2em" }}
          >
            UPCOMING EVENTS
          </span>
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div
      data-calendar-root
      className="relative flex-shrink-0"
      style={{ zIndex: 20 }}
    >
      {/* ── Strip ── */}
      <div
        className="flex items-center overflow-hidden"
        style={{
          height: 36,
          background: "rgba(2,6,16,0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Left label */}
        <div
          className="flex items-center flex-shrink-0 gap-2 px-3 h-full"
          style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
        >
          <CalendarDays
            className="w-2.5 h-2.5"
            style={{ color: "#00d4ff", opacity: 0.5 }}
          />
          <span
            className="uppercase tracking-widest"
            style={{ fontSize: "0.52rem", color: "#334155", letterSpacing: "0.18em" }}
          >
            UPCOMING
          </span>
        </div>

        {/* Scrolling pills */}
        <div
          className="flex-1 relative overflow-hidden"
          style={{ height: "100%" }}
          onMouseEnter={() => { pausedRef.current = true; }}
          onMouseLeave={() => { pausedRef.current = false; }}
        >
          {/* Left fade */}
          <div
            className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none"
            style={{
              width: 24,
              background: "linear-gradient(to right, rgba(2,6,16,1), transparent)",
            }}
          />
          {/* Right fade */}
          <div
            className="absolute right-0 top-0 bottom-0 z-10 pointer-events-none"
            style={{
              width: 24,
              background: "linear-gradient(to left, rgba(2,6,16,1), transparent)",
            }}
          />

          <div
            ref={trackRef}
            className="flex items-center h-full"
            style={{ gap: 8, paddingLeft: 12, willChange: "transform" }}
          >
            {displayEvents.map((event, i) => (
              <span key={`${event.title}-${i}`} className="flex items-center gap-2 flex-shrink-0">
                {/* Pulse dot separator */}
                <span
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.08)",
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                <EventPill event={event} onClick={handlePillClick} />
              </span>
            ))}
          </div>
        </div>

        {/* Right: expand button */}
        <button
          onClick={() => {
            setPanelOpen((v) => !v);
            setActiveEvent(null);
          }}
          className="flex items-center gap-1.5 flex-shrink-0 h-full px-3 transition-colors"
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.05)",
            color: panelOpen ? "#00d4ff" : "#334155",
            background: panelOpen ? "rgba(0,212,255,0.05)" : "transparent",
            outline: "none",
          }}
          title="Show all events"
        >
          <span
            className="tracking-widest"
            style={{ fontSize: "0.52rem", color: "inherit" }}
          >
            ALL
          </span>
          <motion.div
            animate={{ rotate: panelOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-3 h-3" />
          </motion.div>
        </button>
      </div>

      {/* ── Pill detail popover ── */}
      <AnimatePresence>
        {activeEvent && !panelOpen && (
          <div className="absolute inset-x-0 top-0" style={{ pointerEvents: "none" }}>
            <div style={{ pointerEvents: "auto" }}>
              <EventDetail event={activeEvent} onClose={closeDetail} />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Expanded all-events panel ── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute top-full left-0 right-0 z-30 overflow-hidden"
            style={{
              background: "rgba(2,5,14,0.98)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderTop: "none",
              borderRadius: "0 0 6px 6px",
              boxShadow: "0 16px 48px rgba(0,0,0,0.8)",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-4 py-2 sticky top-0"
              style={{
                background: "rgba(2,5,14,0.99)",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                zIndex: 1,
              }}
            >
              <div className="flex items-center gap-2">
                <CalendarDays
                  className="w-3 h-3"
                  style={{ color: "#00d4ff", opacity: 0.7 }}
                />
                <span
                  className="uppercase tracking-widest"
                  style={{ fontSize: "0.55rem", color: "#334155", letterSpacing: "0.2em" }}
                >
                  GEOPOLITICAL CALENDAR — {events.length} EVENTS
                </span>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                style={{ color: "#334155" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Column headers */}
            <div
              className="flex items-center gap-3 px-4 py-1.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              {[
                { label: "ETA", width: 72 },
                { label: "COUNTRY", width: 64 },
                { label: "TYPE", width: 80 },
                { label: "EVENT", width: undefined },
                { label: "IMPACT", width: 52 },
              ].map(({ label, width }) => (
                <div
                  key={label}
                  className="uppercase tracking-widest"
                  style={{
                    fontSize: "0.48rem",
                    color: "#1e293b",
                    width: width ?? "auto",
                    flex: width ? undefined : 1,
                    letterSpacing: "0.18em",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Event rows */}
            {events.map((event, i) => (
              <PanelRow key={`${event.title}-${event.date}-${i}`} event={event} />
            ))}

            {events.length === 0 && (
              <div
                className="flex items-center justify-center py-8"
                style={{ color: "#1e293b", fontSize: "0.65rem" }}
              >
                No scheduled events
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
