import type { CountryScore, HistoricalScore, GlobalStats, NewsArticle, MarkerData, TrendEntry, InsightData, EarlyWarning, StoryEntry, GlobalImpact, NexusEntry, CascadeData, CalendarEvent, ForecastData, Anomaly, CorrelationMatrix } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchLatestScores(): Promise<CountryScore[]> {
  return apiFetch<CountryScore[]>("/api/scores/latest");
}

export async function fetchCountryHistory(iso3: string, days = 30): Promise<HistoricalScore[]> {
  return apiFetch<HistoricalScore[]>(`/api/scores/${iso3}?days=${days}`);
}

export async function fetchGlobalStats(): Promise<GlobalStats> {
  return apiFetch<GlobalStats>("/api/stats");
}

export async function fetchNews(topic: "conflict" | "food" | "economic" | "all" = "conflict"): Promise<NewsArticle[]> {
  return apiFetch<NewsArticle[]>(`/api/news?topic=${topic}`);
}

export async function fetchMarkers(): Promise<MarkerData[]> {
  return apiFetch<MarkerData[]>("/api/markers");
}

export async function fetchTrends(days = 7): Promise<TrendEntry[]> {
  return apiFetch<TrendEntry[]>(`/api/trends?days=${days}`);
}

export async function fetchInsights(iso3: string): Promise<InsightData> {
  return apiFetch<InsightData>(`/api/insights/${iso3}`);
}

export async function fetchEarlyWarnings(days = 7): Promise<EarlyWarning[]> {
  return apiFetch<EarlyWarning[]>(`/api/early-warnings?days=${days}`);
}

export function exportCountryUrl(iso3: string): string {
  return `${API_URL}/api/export/${iso3}`;
}

export async function fetchStoryFinder(): Promise<StoryEntry[]> {
  return apiFetch<StoryEntry[]>("/api/story-finder");
}

export async function fetchGlobalImpact(): Promise<GlobalImpact> {
  return apiFetch<GlobalImpact>("/api/impact");
}

export async function triggerScrapers(): Promise<void> {
  await fetch(`${API_URL}/api/scrapers/run`, { method: "POST" });
}

export async function refreshScores(): Promise<void> {
  await fetch(`${API_URL}/api/scores/refresh`, { method: "POST" });
}

export async function fetchNexus(): Promise<NexusEntry[]> {
  return apiFetch<NexusEntry[]>("/api/nexus");
}

export async function fetchCascade(iso3: string): Promise<CascadeData> {
  return apiFetch<CascadeData>(`/api/cascade/${iso3}`);
}

export async function fetchCalendar(): Promise<CalendarEvent[]> {
  return apiFetch<CalendarEvent[]>("/api/calendar");
}

export async function fetchForecast(iso3: string): Promise<ForecastData> {
  return apiFetch<ForecastData>(`/api/forecast/${iso3}`);
}

export async function fetchLabAnomalies(): Promise<Anomaly[]> {
  return apiFetch<Anomaly[]>("/api/lab/anomalies");
}

export async function fetchLabCorrelations(): Promise<CorrelationMatrix> {
  return apiFetch<CorrelationMatrix>("/api/lab/correlations");
}
