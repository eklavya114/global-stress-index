"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart2, Search } from "lucide-react";
import { fetchLatestScores, fetchMarkers } from "@/lib/api";
import type { CountryScore, DimensionKey } from "@/types";
import Header from "@/components/Header";
import CommandSidebar, { type LayerState } from "@/components/CommandSidebar";
import IntelPanel from "@/components/IntelPanel";
import CountryPanel from "@/components/CountryPanel";
import ScoreLegend from "@/components/ScoreLegend";
import CommandPalette from "@/components/CommandPalette";
import TrendsView from "@/components/TrendsView";
import EventTicker from "@/components/EventTicker";
import DataStrip from "@/components/DataStrip";
import MapOverlay from "@/components/MapOverlay";
import CalendarStrip from "@/components/CalendarStrip";
import LabView from "@/components/LabView";
import DailyBriefModal from "@/components/DailyBriefModal";

// Dynamic imports (browser-only)
const IntelMap = dynamic(() => import("@/components/IntelMap"), { ssr: false });
const CompareModal = dynamic(() => import("@/components/CompareModal"), { ssr: false });

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export default function Home() {
  const [dimension, setDimension] = useState<DimensionKey>("pulse");
  const [selected, setSelected] = useState<CountryScore | null>(null);
  const [layers, setLayers] = useState<LayerState>({ scores: true, markers: true, borders: true });
  const [view, setView] = useState<"map" | "trends" | "lab">("map");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [showDailyBrief, setShowDailyBrief] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [mapMode, setMapMode] = useState<"choropleth" | "heatmap">("choropleth");
  const [satellite, setSatellite] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const { data: scores = [] } = useQuery({
    queryKey: ["latest-scores"],
    queryFn: fetchLatestScores,
    refetchInterval: 60000,
  });

  const { data: markers = [] } = useQuery({
    queryKey: ["markers"],
    queryFn: fetchMarkers,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  // Load watchlist + daily brief check
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("earthpulse_watchlist");
    if (stored) { try { setWatchlist(JSON.parse(stored)); } catch {} }
    const lastVisit = localStorage.getItem("earthpulse_last_visit");
    if (!lastVisit) { setShowDailyBrief(true); return; }
    const hoursSince = (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60);
    if (hoursSince >= 8) setShowDailyBrief(true);
  }, []);

  // Global Cmd+K listener
  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setShowPalette(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleKeydown]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#020408" }}>
      <Header />

      {/* Data strip: view tabs + metrics */}
      <DataStrip view={view} onViewChange={setView} />

      {/* Geopolitical calendar strip */}
      <CalendarStrip />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Command sidebar (map + lab views) */}
        <AnimatePresence>
          {(view === "map" || view === "lab") && (
            <motion.div
              key="command-sidebar"
              initial={{ x: -220, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -220, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="flex-shrink-0"
            >
              <CommandSidebar
                dimension={dimension}
                onDimensionChange={setDimension}
                layers={layers}
                onLayersChange={setLayers}
                scores={scores}
                onCountryClick={(c) => { setSelected(c); setView("map"); }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center: Main view */}
        <div className="relative flex-1 overflow-hidden">
          {/* Compare + search buttons */}
          <div
            className="absolute top-2 right-2 z-20 flex items-center gap-2"
          >
            <button
              onClick={() => setShowCompare(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all"
              style={{
                background: "rgba(3,10,24,0.88)",
                color: "#64748b",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
              }}
            >
              <BarChart2 className="w-3 h-3" />
              Compare
            </button>

            <button
              onClick={() => setShowPalette(true)}
              className="flex items-center gap-2 px-3 py-1 rounded text-xs transition-all"
              style={{
                background: "rgba(3,10,24,0.88)",
                color: "#64748b",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
              }}
            >
              <Search className="w-3 h-3" />
              Search
              <kbd
                className="text-xs text-slate-700 px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "0.6rem",
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {view === "map" && (
              <motion.div
                key="map-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <IntelMap
                  scores={scores}
                  dimension={dimension}
                  layers={layers}
                  markers={markers as any}
                  onCountryClick={setSelected}
                  selectedIso3={selected?.iso3 ?? null}
                  maptilerKey={MAPTILER_KEY}
                  mapMode={mapMode}
                  satellite={satellite}
                  triggerReset={resetKey}
                />
                <MapOverlay
                  scores={scores}
                  mapMode={mapMode}
                  onModeChange={setMapMode}
                  satellite={satellite}
                  onSatellite={setSatellite}
                  onResetZoom={() => setResetKey((k) => k + 1)}
                />
                <ScoreLegend />

                {/* Country detail panel (overlays map) */}
                <AnimatePresence>
                  {selected && (
                    <CountryPanel
                      key={selected.iso3}
                      country={selected}
                      onClose={() => setSelected(null)}
                      onCompare={() => setShowCompare(true)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {view === "trends" && (
              <motion.div
                key="trends-view"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col"
              >
                <TrendsView />
              </motion.div>
            )}

            {view === "lab" && (
              <motion.div
                key="lab-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <LabView scores={scores} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Intel panel */}
        <IntelPanel onCountryClick={(c) => { setSelected(c); setView("map"); }} />
      </div>

      {/* Bottom: Event Ticker */}
      <EventTicker />

      {/* Overlays */}
      <AnimatePresence>
        {showPalette && (
          <CommandPalette
            key="palette"
            scores={scores}
            onSelect={(c) => { setSelected(c); setView("map"); }}
            onClose={() => setShowPalette(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCompare && (
          <CompareModal
            key="compare"
            scores={scores}
            initial={selected}
            onClose={() => setShowCompare(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDailyBrief && scores.length > 0 && (
          <DailyBriefModal
            key="daily-brief"
            scores={scores}
            watchlist={watchlist}
            onClose={() => {
              setShowDailyBrief(false);
              localStorage.setItem("earthpulse_last_visit", new Date().toISOString());
              localStorage.setItem(
                "earthpulse_last_scores",
                JSON.stringify(
                  Object.fromEntries(
                    scores
                      .filter((s) => s.pulse_score != null)
                      .map((s) => [s.iso3, s.pulse_score])
                  )
                )
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
