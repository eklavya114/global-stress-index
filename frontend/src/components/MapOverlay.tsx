"use client";

import type { CountryScore } from "@/types";

interface Props {
  scores: CountryScore[];
  mapMode: "choropleth" | "heatmap";
  onModeChange: (m: "choropleth" | "heatmap") => void;
  satellite: boolean;
  onSatellite: (v: boolean) => void;
  onResetZoom: () => void;
}

const GLASS = {
  background: "rgba(3,10,24,0.92)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
} as const;

function scoreColor(v: number): string {
  return v >= 45 ? "#ff3355" : v >= 30 ? "#ff8800" : v >= 20 ? "#ffcc00" : "#00ff88";
}

export default function MapOverlay({
  scores,
  mapMode,
  onModeChange,
  satellite,
  onSatellite,
  onResetZoom,
}: Props) {
  // Compute dimension averages
  const withConflict = scores.filter((s) => s.conflict_score != null);
  const withFood     = scores.filter((s) => s.food_score != null);
  const withEcon     = scores.filter((s) => s.economic_score != null);

  const avgConflict =
    withConflict.length > 0
      ? withConflict.reduce((sum, s) => sum + (s.conflict_score ?? 0), 0) / withConflict.length
      : null;
  const avgFood =
    withFood.length > 0
      ? withFood.reduce((sum, s) => sum + (s.food_score ?? 0), 0) / withFood.length
      : null;
  const avgEcon =
    withEcon.length > 0
      ? withEcon.reduce((sum, s) => sum + (s.economic_score ?? 0), 0) / withEcon.length
      : null;

  const rows: { label: string; value: number | null }[] = [
    { label: "Conflict", value: avgConflict },
    { label: "Food",     value: avgFood },
    { label: "Economic", value: avgEcon },
  ];

  const activeNodes = scores.filter((s) => s.pulse_score != null).length;

  return (
    <>
      {/* Corner targeting brackets */}
      <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 6 }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M 1 28 L 1 5 Q 1 1 5 1 L 28 1" stroke="rgba(0,212,255,0.28)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="absolute top-0 right-0 pointer-events-none" style={{ zIndex: 6 }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M 35 28 L 35 5 Q 35 1 31 1 L 8 1" stroke="rgba(0,212,255,0.28)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="absolute bottom-0 left-0 pointer-events-none" style={{ zIndex: 6 }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M 1 8 L 1 31 Q 1 35 5 35 L 28 35" stroke="rgba(0,212,255,0.28)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="absolute bottom-0 right-0 pointer-events-none" style={{ zIndex: 6 }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M 35 8 L 35 31 Q 35 35 31 35 L 8 35" stroke="rgba(0,212,255,0.28)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Top-center: HUD status chip */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "3px 12px",
          borderRadius: 6,
          background: "rgba(3,10,24,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(0,212,255,0.08)",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#00d4ff",
            opacity: 0.7,
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <span
          style={{
            color: "#334155",
            fontSize: "0.58rem",
            fontFamily: "monospace",
            letterSpacing: "0.1em",
          }}
        >
          GLOBAL VIEW · {activeNodes} ACTIVE NODES
        </span>
      </div>

      {/* Top-left: mode buttons */}
      <div
        className="absolute flex items-center gap-px overflow-hidden"
        style={{ top: 12, left: 12, zIndex: 10, ...GLASS, borderRadius: 8, padding: 2 }}
      >
        {(
          [
            { label: "Map",   action: () => onModeChange("choropleth"), active: mapMode === "choropleth" },
            { label: "Heat",  action: () => onModeChange("heatmap"),    active: mapMode === "heatmap" },
            { label: "Sat",   action: () => onSatellite(!satellite),    active: satellite },
            { label: "Reset", action: () => onResetZoom(),              active: false },
          ] as const
        ).map(({ label, action, active }) => (
          <button
            key={label}
            onClick={action}
            className="px-2.5 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: active ? "rgba(0,212,255,0.15)" : "transparent",
              color: active ? "#00d4ff" : "#64748b",
              border: active ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
              fontSize: "0.65rem",
              letterSpacing: "0.03em",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bottom-left: global index card */}
      <div
        className="absolute flex flex-col gap-1.5 p-2.5"
        style={{ bottom: 64, left: 12, zIndex: 10, width: 130, ...GLASS }}
      >
        <div
          className="uppercase tracking-widest"
          style={{ color: "#334155", fontSize: "0.55rem", letterSpacing: "0.15em" }}
        >
          Global Index
        </div>
        {rows.map(({ label, value }) => {
          const color = value != null ? scoreColor(value) : "#334155";
          const pct = value != null ? Math.min(value, 100) : 0;
          return (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="flex-shrink-0"
                style={{ color: "#475569", fontSize: "0.6rem", width: 44 }}
              >
                {label}
              </span>
              <div
                className="flex-1 h-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: color,
                    opacity: 0.8,
                  }}
                />
              </div>
              <span
                className="font-mono flex-shrink-0 text-right"
                style={{ color, fontSize: "0.62rem", width: 24 }}
              >
                {value != null ? value.toFixed(0) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
