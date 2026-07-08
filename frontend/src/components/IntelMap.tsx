"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Map, {
  Source,
  Layer,
  Marker,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type { ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CountryScore, DimensionKey } from "@/types";
import type { FeatureCollection, Feature, LineString } from "geojson";

interface MarkerData {
  iso3: string;
  name: string;
  lat: number;
  lon: number;
  pulse_score: number | null;
  conflict_score: number | null;
  food_score: number | null;
  economic_score: number | null;
  marker_type: "conflict" | "food" | "economic";
  severity: "critical" | "high" | "elevated";
}

interface LayerVisibility {
  scores: boolean;
  markers: boolean;
  borders: boolean;
}

interface Props {
  scores: CountryScore[];
  dimension: DimensionKey;
  layers: LayerVisibility;
  markers: MarkerData[];
  onCountryClick: (c: CountryScore | null) => void;
  selectedIso3: string | null;
  maptilerKey?: string;
  mapMode?: "choropleth" | "heatmap";
  satellite?: boolean;
  triggerReset?: number;
}

const DIMENSION_KEYS: Record<DimensionKey, string> = {
  pulse:    "pulse_score",
  conflict: "conflict_score",
  food:     "food_score",
  economic: "economic_score",
};

function colorExpression(key: string) {
  return [
    "case",
    ["==", ["get", key], null],
    "rgba(0,0,0,0)",
    [
      "interpolate",
      ["linear"],
      ["get", key],
      0,   "#064e3b",
      20,  "#166534",
      35,  "#ca8a04",
      50,  "#ea580c",
      65,  "#dc2626",
      80,  "#7f1d1d",
      100, "#450a0a",
    ],
  ] as unknown as string;
}

const MARKER_COLORS: Record<string, string> = {
  conflict: "#ff3355",
  food:     "#ff8800",
  economic: "#3b82f6",
};

const SEVERITY_SIZE: Record<string, number> = {
  critical: 14,
  high:     10,
  elevated: 7,
};

// Carto Dark base style (no API key needed)
const CARTO_DARK_STYLE = {
  version: 8 as const,
  sources: {
    "carto-tiles": {
      type: "raster" as const,
      tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© CARTO © OpenStreetMap contributors",
    },
  },
  layers: [{ id: "carto-base", type: "raster" as const, source: "carto-tiles" }],
};

export default function IntelMap({
  scores,
  dimension,
  layers,
  markers,
  onCountryClick,
  selectedIso3,
  maptilerKey,
  mapMode = "choropleth",
  satellite = false,
  triggerReset,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [geoJson, setGeoJson] = useState<FeatureCollection | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; name: string; score: number | null;
  } | null>(null);

  useEffect(() => {
    fetch("/countries.geojson")
      .then(r => r.json())
      .then(setGeoJson)
      .catch(console.error);
  }, []);

  const scoreMap = useMemo(() => {
    const m: Record<string, CountryScore> = {};
    for (const s of scores) m[s.iso3] = s;
    return m;
  }, [scores]);

  const mergedGeoJson = useMemo(() => {
    if (!geoJson) return null;
    return {
      ...geoJson,
      features: geoJson.features.map((f: Feature) => {
        const iso3 = (f.properties as Record<string, string>)?.ISO_A3 ?? "";
        const c = scoreMap[iso3];
        return {
          ...f,
          properties: {
            ...f.properties,
            pulse_score:    c?.pulse_score    ?? null,
            conflict_score: c?.conflict_score ?? null,
            food_score:     c?.food_score     ?? null,
            economic_score: c?.economic_score ?? null,
          },
        };
      }),
    } as FeatureCollection;
  }, [geoJson, scoreMap]);

  // Reset zoom when triggerReset counter changes
  useEffect(() => {
    if (triggerReset == null) return;
    mapRef.current?.flyTo({ center: [15, 20], zoom: 2, duration: 1200 });
  }, [triggerReset]);

  const fillKey = DIMENSION_KEYS[dimension];

  const mapStyle = satellite && maptilerKey
    ? `https://api.maptiler.com/maps/satellite/style.json?key=${maptilerKey}`
    : maptilerKey
    ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${maptilerKey}`
    : CARTO_DARK_STYLE;

  // Crisis arc features: top 5 scored countries connected to their 2 nearest neighbors
  const arcFeatures = useMemo((): FeatureCollection => {
    const withCoords = scores.filter(
      (s) => s.pulse_score != null && s.lat != null && s.lon != null
    );
    const top5 = [...withCoords]
      .sort((a, b) => (b.pulse_score ?? 0) - (a.pulse_score ?? 0))
      .slice(0, 5);

    const lines: Feature[] = [];
    for (const src of top5) {
      const others = withCoords
        .filter((s) => s.iso3 !== src.iso3)
        .map((s) => ({
          s,
          dist: Math.hypot((s.lat ?? 0) - (src.lat ?? 0), (s.lon ?? 0) - (src.lon ?? 0)),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);

      for (const { s } of others) {
        lines.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [src.lon!, src.lat!],
              [s.lon!, s.lat!],
            ],
          } as LineString,
          properties: {},
        });
      }
    }
    return { type: "FeatureCollection", features: lines };
  }, [scores]);

  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const features = e.features ?? [];
      if (features.length > 0) {
        const props = features[0].properties as Record<string, unknown>;
        const name = String(props?.NAME ?? props?.name ?? "Unknown");
        const score = typeof props?.[fillKey] === "number" ? (props[fillKey] as number) : null;
        setTooltip({ x: e.point.x, y: e.point.y, name, score });
      } else {
        setTooltip(null);
      }
    },
    [fillKey]
  );

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const features = e.features ?? [];
      if (features.length > 0) {
        const iso3 = (features[0].properties as Record<string, string>)?.ISO_A3 ?? "";
        onCountryClick(scoreMap[iso3] ?? null);
      } else {
        onCountryClick(null);
      }
    },
    [scoreMap, onCountryClick]
  );

  const scoreToColor = (score: number | null, type: string): string => {
    return MARKER_COLORS[type] ?? "#ffffff";
  };

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        mapStyle={mapStyle as any}
        initialViewState={{ longitude: 15, latitude: 20, zoom: 2 }}
        minZoom={1}
        maxZoom={12}
        interactiveLayerIds={mergedGeoJson && layers.scores ? ["country-fill"] : []}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={onClick}
        cursor={tooltip ? "pointer" : "grab"}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Country polygons */}
        {mergedGeoJson && layers.scores && (
          <Source id="countries" type="geojson" data={mergedGeoJson}>
            <Layer
              id="country-fill"
              type="fill"
              paint={{
                "fill-color": colorExpression(fillKey) as unknown as string,
                "fill-opacity": mapMode === "heatmap" ? 0.2 : 0.58,
              }}
            />
            {layers.borders && (
              <Layer
                id="country-line"
                type="line"
                paint={{
                  "line-color": "#1a3a5c",
                  "line-width": 0.5,
                }}
              />
            )}
            {selectedIso3 && (
              <Layer
                id="country-selected"
                type="line"
                filter={["==", ["get", "ISO_A3"], selectedIso3]}
                paint={{
                  "line-color": "#00d4ff",
                  "line-width": 2.5,
                  "line-opacity": 0.9,
                }}
              />
            )}
            {mapMode === "heatmap" && (
              <Layer
                id="country-heat"
                type="heatmap"
                paint={{
                  "heatmap-weight": [
                    "interpolate", ["linear"], ["get", "pulse_score"],
                    0, 0, 60, 1
                  ] as unknown as number,
                  "heatmap-intensity": 2,
                  "heatmap-color": ([
                    "interpolate", ["linear"], ["heatmap-density"],
                    0,   "rgba(0,0,0,0)",
                    0.3, "rgba(6,78,59,0.8)",
                    0.5, "rgba(202,138,4,0.8)",
                    0.7, "rgba(234,88,12,0.9)",
                    1.0, "rgba(220,38,38,1)"
                  ]) as unknown as ExpressionSpecification,
                  "heatmap-radius": 50,
                  "heatmap-opacity": 0.7,
                }}
              />
            )}
          </Source>
        )}

        {/* Crisis arcs */}
        {arcFeatures.features.length > 0 && (
          <Source id="crisis-arcs" type="geojson" data={arcFeatures}>
            <Layer
              id="crisis-arc-lines"
              type="line"
              paint={{
                "line-color": "#ff3355",
                "line-width": 0.8,
                "line-opacity": 0.3,
              }}
            />
          </Source>
        )}

        {/* Hotspot markers */}
        {layers.markers && markers.map((m) => {
          const size = SEVERITY_SIZE[m.severity] ?? 8;
          const color = MARKER_COLORS[m.marker_type] ?? "#ffffff";
          return (
            <Marker key={m.iso3} longitude={m.lon} latitude={m.lat} anchor="center">
              <div
                className="marker-dot"
                title={`${m.name}: ${m.pulse_score?.toFixed(1)}`}
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  background: color,
                  boxShadow: `0 0 ${size * 2}px ${color}`,
                  border: `1px solid ${color}cc`,
                  cursor: "pointer",
                  animation: m.severity === "critical" ? "marker-pulse 1.5s ease-in-out infinite" : undefined,
                }}
                onClick={() => onCountryClick(scoreMap[m.iso3] ?? null)}
              />
            </Marker>
          );
        })}
      </Map>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="intel-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-semibold text-white text-sm">{tooltip.name}</div>
          <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
            <span className="capitalize text-slate-500">{dimension}</span>
            <span className="text-slate-700">·</span>
            <span className="font-mono" style={{ color: tooltip.score == null ? "#475569" : "#e2e8f0" }}>
              {tooltip.score != null ? tooltip.score.toFixed(1) : "No data"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
