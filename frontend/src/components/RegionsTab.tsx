"use client";

import type { CountryScore } from "@/types";

interface Props {
  scores: CountryScore[];
}

const KNOWN_REGIONS = ["Africa", "Asia", "Europe", "Americas", "Oceania"] as const;

function scoreColor(v: number): string {
  return v >= 45 ? "#ff3355" : v >= 30 ? "#ff8800" : v >= 20 ? "#ffcc00" : "#00ff88";
}

export default function RegionsTab({ scores }: Props) {
  const regionData = KNOWN_REGIONS.map((region) => {
    const group = scores.filter(
      (s) => s.region === region && s.pulse_score != null
    );
    const avg =
      group.length > 0
        ? group.reduce((sum, s) => sum + (s.pulse_score ?? 0), 0) / group.length
        : null;
    return { region, count: group.length, avg };
  })
    .filter((r) => r.count > 0)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  if (regionData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-xs text-slate-600 animate-pulse">Loading…</span>
      </div>
    );
  }

  const maxAvg = Math.max(1, ...regionData.map((r) => r.avg ?? 0));

  return (
    <div className="flex flex-col">
      <div
        className="px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: "#475569", fontSize: "0.65rem" }}
        >
          Geographic Breakdown
        </div>
        <div className="text-xs text-slate-600 mt-0.5" style={{ fontSize: "0.6rem" }}>
          Avg pulse score by region
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {regionData.map(({ region, count, avg }) => {
          const color = avg != null ? scoreColor(avg) : "#334155";
          const pct = avg != null ? (avg / maxAvg) * 100 : 0;
          return (
            <div
              key={region}
              className="px-4 py-3 hover:bg-white/[0.02] transition-colors"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-300">{region}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs text-slate-600 font-mono"
                    style={{ fontSize: "0.65rem" }}
                  >
                    {count} nations
                  </span>
                  <span
                    className="text-xs font-mono font-bold"
                    style={{ color, fontSize: "0.75rem" }}
                  >
                    {avg != null ? avg.toFixed(1) : "—"}
                  </span>
                </div>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}55, ${color})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
