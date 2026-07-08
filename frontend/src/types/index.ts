export interface CountryScore {
  iso3: string;
  iso2: string;
  name: string;
  region: string | null;
  lat: number | null;
  lon: number | null;
  pulse_score: number | null;
  conflict_score: number | null;
  food_score: number | null;
  economic_score: number | null;
  data_quality: number | null;
  score_date: string | null;
}

export interface HistoricalScore {
  country_iso3: string;
  score_date: string;
  pulse_score: number | null;
  conflict_score: number | null;
  food_score: number | null;
  economic_score: number | null;
  data_quality: number | null;
}

export interface GlobalStats {
  total_countries: number;
  countries_scored: number;
  avg_pulse_score: number;
  highest_stress: CountryScore | null;
  lowest_stress: CountryScore | null;
  last_updated: string | null;
}

export interface NewsArticle {
  title: string;
  url: string;
  domain: string;
  source_country: string;
  seen_at: string;
  image: string;
}

export interface MarkerData {
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

export type DimensionKey = "pulse" | "conflict" | "food" | "economic";

export interface TrendEntry {
  iso3: string;
  name: string;
  region: string | null;
  current_score: number;
  previous_score: number;
  delta: number;
  conflict_score: number;
  food_score: number;
  economic_score: number;
  direction: "deteriorating" | "improving" | "stable";
}

export interface Insight {
  type: "critical" | "warning" | "info" | "stable" | "positive";
  title: string;
  body: string;
}

export interface InsightData {
  iso3: string;
  name: string;
  region: string | null;
  latest_score: number | null;
  score_date: string | null;
  insights: Insight[];
  history: HistoricalScore[];
}

export interface EarlyWarning {
  iso3: string;
  name: string;
  region: string | null;
  current_score: number;
  previous_score: number;
  delta: number;
  primary_driver: string;
  driver_score: number;
}

export interface StoryEntry {
  iso3: string;
  name: string;
  region: string | null;
  pulse_score: number;
  conflict_score: number;
  food_score: number;
  economic_score: number;
  population: number;
  underreport_score: number;
  story_angle: string;
}

export interface GlobalImpact {
  total_population_tracked: number;
  buckets: { critical: number; high: number; elevated: number; moderate: number; stable: number };
  people_in_crisis: number;
  crisis_pct: number;
}

export interface MapFeatureProperties {
  ISO_A3: string;
  NAME: string;
  pulse_score: number | null;
  conflict_score: number | null;
  food_score: number | null;
  economic_score: number | null;
  data_quality: number | null;
}

export interface NexusEntry {
  iso3: string; name: string; region: string | null;
  nexus_type: "triple" | "food-conflict" | "economic-conflict" | "food-economic";
  severity: 1 | 2 | 3;
  pulse_score: number; conflict_score: number | null;
  food_score: number | null; economic_score: number | null;
  nexus_score: number; description: string;
}

export interface CascadeImpact {
  iso3: string; name: string; mechanism: string; strength: number; current_score: number | null;
}

export interface CascadeData {
  source_iso3: string; source_name: string; source_score: number | null;
  impacts: CascadeImpact[]; message?: string;
}

export interface CalendarEvent {
  date: string; iso3: string | null; name: string | null;
  event_type: "election" | "summit" | "humanitarian" | "ceasefire" | "sanctions" | "peace";
  title: string; description: string; predicted_impact: number;
  historical_basis: string | null; days_until: number;
}

export interface ForecastPoint {
  days: number; predicted_score: number; confidence: number;
}

export interface Intervention {
  type: string; avg_impact: number; timeframe: string; evidence?: string;
}

export interface ForecastData {
  iso3: string; name: string; current_score: number | null; trend_30d: number;
  trajectory: "deteriorating" | "improving" | "stable";
  forecast: ForecastPoint[]; primary_driver: "conflict" | "food" | "economic" | "balanced";
  interventions: Intervention[]; risk_factors: string[]; history_points: number;
}

export interface Anomaly {
  iso3: string; name: string; region: string | null;
  current_score: number; historical_mean: number;
  deviation: number; sigma: number; direction: "spike" | "dip";
}

export interface CorrelationPair {
  a_iso3: string; b_iso3: string; correlation: number; n_points: number;
}

export interface CorrelationMatrix {
  countries: { iso3: string; name: string; score: number }[];
  pairs: CorrelationPair[];
}
