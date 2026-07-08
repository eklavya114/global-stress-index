"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchNews, fetchEarlyWarnings } from "@/lib/api";
import type { NewsArticle, EarlyWarning } from "@/types";

interface TickerItem {
  id: string;
  type: "news" | "warning" | "alert";
  text: string;
  tag: string;
  tagColor: string;
  url?: string;
}

function formatItems(news: NewsArticle[], warnings: EarlyWarning[]): TickerItem[] {
  const items: TickerItem[] = [];

  warnings.forEach((w, i) => {
    items.push({
      id: `w-${i}`,
      type: "warning",
      text: `${w.name} — pulse score rose +${w.delta.toFixed(1)} pts to ${w.current_score.toFixed(0)} · ${w.primary_driver} driver`,
      tag: "⚠ EARLY WARNING",
      tagColor: "#ff8800",
    });
  });

  news.forEach((a, i) => {
    if (!a.title) return;
    items.push({
      id: `n-${i}`,
      type: "news",
      text: a.title,
      tag: a.domain?.replace(/^www\./, "").split(".")[0].toUpperCase() || "NEWS",
      tagColor: "#00d4ff",
      url: a.url,
    });
  });

  return items;
}

export default function EventTicker() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<TickerItem[]>([]);
  const animRef = useRef<number>();
  const posRef = useRef(0);

  const { data: news = [] } = useQuery({
    queryKey: ["news", "conflict"],
    queryFn: () => fetchNews("conflict"),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const { data: warnings = [] } = useQuery({
    queryKey: ["early-warnings", 7],
    queryFn: () => fetchEarlyWarnings(7),
    refetchInterval: 10 * 60 * 1000,
  });

  useEffect(() => {
    setItems(formatItems(news, warnings));
  }, [news, warnings]);

  // Smooth scroll animation
  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) return;

    let speed = 0.55; // px per frame

    const animate = () => {
      posRef.current -= speed;
      const totalWidth = track.scrollWidth / 2; // duplicated
      if (Math.abs(posRef.current) >= totalWidth) {
        posRef.current = 0;
      }
      track.style.transform = `translateX(${posRef.current}px)`;
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [items]);

  if (items.length === 0) return null;

  // Duplicate items for seamless loop
  const displayItems = [...items, ...items];

  return (
    <div
      className="flex-shrink-0 overflow-hidden flex items-center"
      style={{
        height: 34,
        background: "rgba(2,6,16,0.98)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        position: "relative",
      }}
    >
      {/* Left label */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 z-10"
        style={{
          height: "100%",
          background: "rgba(0,212,255,0.08)",
          borderRight: "1px solid rgba(0,212,255,0.15)",
          minWidth: 100,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span
          className="text-xs font-bold tracking-widest"
          style={{ color: "#00d4ff", fontSize: "0.6rem", letterSpacing: "0.15em" }}
        >
          LIVE FEED
        </span>
      </div>

      {/* Scrolling track */}
      <div className="flex-1 overflow-hidden relative">
        {/* Left fade */}
        <div
          className="absolute left-0 top-0 bottom-0 z-10 w-8 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(2,6,16,1), transparent)" }}
        />
        {/* Right fade */}
        <div
          className="absolute right-0 top-0 bottom-0 z-10 w-8 pointer-events-none"
          style={{ background: "linear-gradient(to left, rgba(2,6,16,1), transparent)" }}
        />

        <div
          ref={trackRef}
          className="flex items-center whitespace-nowrap"
          style={{ willChange: "transform" }}
        >
          {displayItems.map((item, i) => (
            <span key={`${item.id}-${i}`} className="flex items-center flex-shrink-0">
              {/* Separator */}
              <span
                className="mx-4 text-xs"
                style={{ color: "rgba(255,255,255,0.08)", userSelect: "none" }}
              >
                ◆
              </span>

              {/* Tag */}
              <span
                className="text-xs font-bold font-mono mr-2 px-1.5 py-0.5 rounded"
                style={{
                  color: item.tagColor,
                  background: `${item.tagColor}15`,
                  border: `1px solid ${item.tagColor}25`,
                  fontSize: "0.58rem",
                  letterSpacing: "0.08em",
                }}
              >
                {item.tag}
              </span>

              {/* Text */}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs transition-colors hover:text-white"
                  style={{ color: "#64748b", fontSize: "0.75rem", cursor: "pointer" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.text}
                </a>
              ) : (
                <span
                  className="text-xs"
                  style={{ color: item.type === "warning" ? "#94a3b8" : "#64748b", fontSize: "0.75rem" }}
                >
                  {item.text}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Right: timestamp */}
      <div
        className="flex-shrink-0 px-3 font-mono text-xs"
        style={{
          color: "rgba(255,255,255,0.1)",
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          fontSize: "0.6rem",
          letterSpacing: "0.06em",
        }}
      >
        {new Date().toUTCString().slice(17, 25)} UTC
      </div>
    </div>
  );
}
