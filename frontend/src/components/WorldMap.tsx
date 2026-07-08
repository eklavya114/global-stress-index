"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Map, {
  Source,
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CountryScore, DimensionKey } from "@/types";
import type { FeatureCollection, Feature } from "geojson";

interface Props {
  scores: CountryScore[];
  dimension: DimensionKey;
  onCountryClick: (c: CountryScore | null) => void;
  selectedIso3: string | null;
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// MapLibre color ramp: green → yellow → orange → red
function colorExpression(key: string) {
  return [
    "case",
    ["==", ["get", key], null],
    "#334155", // no data
    [
      "interpolate",
      ["linear"],
      ["get", key],
      0,   "#16a34a",
      25,  "#65a30d",
      45,  "#ca8a04",
      65,  "#ea580c",
      80,  "#dc2626",
      100, "#7f1d1d",
    ],
  ] as unknown as string;
}

const DIMENSION_KEYS: Record<DimensionKey, string> = {
  pulse:    "pulse_score",
  conflict: "conflict_score",
  food:     "food_score",
  economic: "economic_score",
};

export default function WorldMap({ scores, dimension, onCountryClick, selectedIso3 }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [geoJson, setGeoJson] = useState<FeatureCollection | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; score: number | null } | null>(null);

  // Load countries GeoJSON (downloaded by setup script to public/)
  useEffect(() => {
    fetch("/countries.geojson")
      .then((r) => r.json())
      .then((data: FeatureCollection) => setGeoJson(data))
      .catch((e) => console.error("Failed to load countries.geojson:", e));
  }, []);

  // Build ISO3 → score lookup
  const scoreMap = useMemo(() => {
    const m: Record<string, CountryScore> = {};
    for (const s of scores) m[s.iso3] = s;
    return m;
  }, [scores]);

  // Merge scores into GeoJSON properties
  const mergedGeoJson = useMemo(() => {
    if (!geoJson) return null;
    return {
      ...geoJson,
      features: geoJson.features.map((f: Feature) => {
        const iso3: string = (f.properties as Record<string, string>)?.ISO_A3 ?? "";
        const country = scoreMap[iso3];
        return {
          ...f,
          properties: {
            ...f.properties,
            pulse_score:    country?.pulse_score    ?? null,
            conflict_score: country?.conflict_score ?? null,
            food_score:     country?.food_score     ?? null,
            economic_score: country?.economic_score ?? null,
            data_quality:   country?.data_quality   ?? null,
          },
        };
      }),
    } as FeatureCollection;
  }, [geoJson, scoreMap]);

  const fillKey = DIMENSION_KEYS[dimension];

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

  const onMouseLeave = useCallback(() => setTooltip(null), []);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const features = e.features ?? [];
      if (features.length > 0) {
        const props = features[0].properties as Record<string, string>;
        const iso3 = props?.ISO_A3 ?? "";
        const country = scoreMap[iso3] ?? null;
        onCountryClick(country);
      } else {
        onCountryClick(null);
      }
    },
    [scoreMap, onCountryClick]
  );

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        mapStyle={STYLE_URL}
        initialViewState={{ longitude: 10, latitude: 20, zoom: 1.5 }}
        minZoom={1}
        maxZoom={10}
        interactiveLayerIds={mergedGeoJson ? ["country-fill"] : []}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        cursor={tooltip ? "pointer" : "grab"}
      >
        {mergedGeoJson && (
          <Source id="countries" type="geojson" data={mergedGeoJson}>
            {/* Fill */}
            <Layer
              id="country-fill"
              type="fill"
              paint={{
                "fill-color": colorExpression(fillKey) as unknown as string,
                "fill-opacity": 0.82,
              }}
            />
            {/* Border */}
            <Layer
              id="country-line"
              type="line"
              paint={{
                "line-color": "#0f172a",
                "line-width": 0.5,
              }}
            />
            {/* Selected highlight */}
            {selectedIso3 && (
              <Layer
                id="country-selected"
                type="line"
                filter={["==", ["get", "ISO_A3"], selectedIso3]}
                paint={{
                  "line-color": "#f8fafc",
                  "line-width": 2,
                }}
              />
            )}
          </Source>
        )}
      </Map>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="map-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-semibold">{tooltip.name}</div>
          <div className="text-slate-400">
            {tooltip.score != null ? (
              <>
                <span className="capitalize">{dimension}</span>:{" "}
                <span className="font-mono text-white">{tooltip.score.toFixed(1)}</span>
              </>
            ) : (
              "No data"
            )}
          </div>
        </div>
      )}
    </div>
  );
}
