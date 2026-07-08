"use client";

import {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { geoEquirectangular, geoPath, geoContains } from "d3-geo";
import type { FeatureCollection } from "geojson";
import type { CountryScore, DimensionKey } from "@/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function scoreToColor(score: number | null): string {
  if (score === null) return "#1a2f4e";
  if (score < 20)  return "#064e3b";
  if (score < 35)  return "#166534";
  if (score < 50)  return "#ca8a04";
  if (score < 65)  return "#ea580c";
  if (score < 80)  return "#dc2626";
  return "#7f1d1d";
}

const DIM_KEY: Record<DimensionKey, keyof CountryScore> = {
  pulse:    "pulse_score",
  conflict: "conflict_score",
  food:     "food_score",
  economic: "economic_score",
};

function buildGlobeCanvas(
  geoJson: FeatureCollection,
  scoreMap: Map<string, CountryScore>,
  dimension: DimensionKey,
  selectedIso3: string | null
): HTMLCanvasElement {
  const W = 4096, H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Ocean — deep navy
  ctx.fillStyle = "#060e1c";
  ctx.fillRect(0, 0, W, H);

  const proj = geoEquirectangular()
    .scale(W / (2 * Math.PI))
    .translate([W / 2, H / 2]);
  const pathGen = geoPath(proj, ctx);
  const key = DIM_KEY[dimension];

  for (const feature of geoJson.features) {
    const iso3 = (feature.properties?.ISO_A3 ?? "") as string;
    const country = scoreMap.get(iso3);
    const score = country ? (country[key] as number | null) : null;
    const selected = iso3 === selectedIso3;

    ctx.beginPath();
    pathGen(feature);

    if (selected) {
      ctx.fillStyle = "rgba(96,165,250,0.35)";
    } else {
      ctx.fillStyle = scoreToColor(score);
    }
    ctx.fill();

    ctx.lineWidth = selected ? 3 : 0.6;
    ctx.strokeStyle = selected ? "#93c5fd" : "#0d2240";
    ctx.stroke();
  }

  return canvas;
}

// ── Atmosphere Glow ──────────────────────────────────────────────────────────

function AtmosphereGlow() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 wp = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-wp.xyz);
            gl_Position = projectionMatrix * wp;
          }`,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float f = 1.0 - abs(dot(vNormal, vViewDir));
            f = pow(f, 2.8);
            gl_FragColor = vec4(0.04, 0.35, 1.0, f * 0.65);
          }`,
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false,
      }),
    []
  );
  return (
    <mesh scale={[1.055, 1.055, 1.055]}>
      <sphereGeometry args={[1, 64, 32]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ── Earth Mesh ───────────────────────────────────────────────────────────────

interface EarthMeshProps {
  geoJson: FeatureCollection | null;
  scores: CountryScore[];
  dimension: DimensionKey;
  selectedIso3: string | null;
  onHover: (country: CountryScore | null, x: number, y: number) => void;
  onCountryClick: (country: CountryScore | null) => void;
}

function EarthMesh({
  geoJson,
  scores,
  dimension,
  selectedIso3,
  onHover,
  onCountryClick,
}: EarthMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pointerDownPos = useRef({ x: 0, y: 0 });

  const scoreMap = useMemo(() => {
    const m = new Map<string, CountryScore>();
    for (const s of scores) m.set(s.iso3, s);
    return m;
  }, [scores]);

  // Rebuild globe texture whenever data or selection changes
  useEffect(() => {
    if (!geoJson || !meshRef.current) return;
    const canvas = buildGlobeCanvas(geoJson, scoreMap, dimension, selectedIso3);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (mat.map) mat.map.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
  }, [geoJson, scoreMap, dimension, selectedIso3]);

  const uvToCountry = useCallback(
    (u: number, v: number): CountryScore | null => {
      if (!geoJson) return null;
      const lon = (u - 0.5) * 360;
      const lat = (v - 0.5) * 180;
      for (const feat of geoJson.features) {
        if (geoContains(feat, [lon, lat])) {
          const iso3 = (feat.properties?.ISO_A3 ?? "") as string;
          return scoreMap.get(iso3) ?? null;
        }
      }
      return null;
    },
    [geoJson, scoreMap]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePointerMove = useCallback(
    (e: any) => {
      if (!e.uv) { onHover(null, 0, 0); return; }
      const country = uvToCountry(e.uv.x, e.uv.y);
      onHover(country, e.nativeEvent?.clientX ?? e.clientX ?? 0, e.nativeEvent?.clientY ?? e.clientY ?? 0);
    },
    [uvToCountry, onHover]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePointerDown = useCallback((e: any) => {
    pointerDownPos.current = {
      x: e.nativeEvent?.clientX ?? e.clientX ?? 0,
      y: e.nativeEvent?.clientY ?? e.clientY ?? 0,
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePointerUp = useCallback(
    (e: any) => {
      const cx = e.nativeEvent?.clientX ?? e.clientX ?? 0;
      const cy = e.nativeEvent?.clientY ?? e.clientY ?? 0;
      const dx = cx - pointerDownPos.current.x;
      const dy = cy - pointerDownPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;
      if (!e.uv) { onCountryClick(null); return; }
      const country = uvToCountry(e.uv.x, e.uv.y);
      onCountryClick(country);
    },
    [uvToCountry, onCountryClick]
  );

  return (
    <mesh
      ref={meshRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onHover(null, 0, 0)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <sphereGeometry args={[1, 128, 64]} />
      <meshStandardMaterial roughness={0.75} metalness={0.05} />
    </mesh>
  );
}

// ── Scene (inside Canvas) ────────────────────────────────────────────────────

interface SceneProps extends EarthMeshProps {
  autoRotate: boolean;
}

function Scene({ autoRotate, ...earthProps }: SceneProps) {
  const controlsRef = useRef<any>(null);

  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={[5, 3, 5]} intensity={1.3} color="#fff5e0" />
      <directionalLight position={[-5, -2, -3]} intensity={0.15} color="#4488ff" />
      <Stars radius={120} depth={60} count={6000} factor={4} saturation={0} fade speed={0.6} />
      <EarthMesh {...earthProps} />
      <AtmosphereGlow />
      <OrbitControls
        ref={controlsRef}
        enableZoom
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={0.4}
        minDistance={1.4}
        maxDistance={5}
        zoomSpeed={0.6}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

// ── Globe (public component) ─────────────────────────────────────────────────

interface GlobeProps {
  scores: CountryScore[];
  dimension: DimensionKey;
  onCountryClick: (country: CountryScore | null) => void;
  selectedIso3: string | null;
}

interface Tooltip {
  country: CountryScore;
  x: number;
  y: number;
}

export default function Globe({
  scores,
  dimension,
  onCountryClick,
  selectedIso3,
}: GlobeProps) {
  const [geoJson, setGeoJson] = useState<FeatureCollection | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    fetch("/countries.geojson")
      .then((r) => r.json())
      .then(setGeoJson)
      .catch(console.error);
  }, []);

  const handleHover = useCallback(
    (country: CountryScore | null, x: number, y: number) => {
      setTooltip(country ? { country, x, y } : null);
    },
    []
  );

  const handleClick = useCallback(
    (country: CountryScore | null) => {
      onCountryClick(country);
    },
    [onCountryClick]
  );

  const dimensionScore = (c: CountryScore) => {
    const k = DIM_KEY[dimension];
    return c[k] as number | null;
  };

  return (
    <div
      className="w-full h-full relative"
      onPointerEnter={() => setAutoRotate(false)}
      onPointerLeave={() => setAutoRotate(true)}
    >
      <Canvas
        camera={{ position: [2.5, 0.4, 0], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
      >
        <Scene
          autoRotate={autoRotate}
          geoJson={geoJson}
          scores={scores}
          dimension={dimension}
          selectedIso3={selectedIso3}
          onHover={handleHover}
          onCountryClick={handleClick}
        />
      </Canvas>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 14, top: tooltip.y - 14 }}
        >
          <div
            className="glass-strong rounded-xl px-3.5 py-2.5 text-sm shadow-xl"
            style={{ border: "1px solid rgba(0,212,255,0.2)" }}
          >
            <div className="font-semibold text-white">{tooltip.country.name}</div>
            <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
              <span className="capitalize">{dimension}</span>
              <span className="text-slate-600">·</span>
              <span
                className="font-mono font-bold"
                style={{ color: scoreToColor(dimensionScore(tooltip.country)) === "#1a2f4e" ? "#64748b" : "white" }}
              >
                {dimensionScore(tooltip.country) != null
                  ? (dimensionScore(tooltip.country) as number).toFixed(1)
                  : "No data"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {!geoJson && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-slate-500 text-sm animate-pulse tracking-widest uppercase text-xs">
            Loading globe…
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-slate-600 text-xs tracking-widest pointer-events-none select-none">
        DRAG TO ROTATE · SCROLL TO ZOOM · CLICK COUNTRY
      </div>
    </div>
  );
}
