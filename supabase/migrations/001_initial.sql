-- Earth Pulse schema — run this in Supabase SQL Editor (optional; SQLite is the default)

CREATE TABLE IF NOT EXISTS countries (
    id          SERIAL PRIMARY KEY,
    iso3        VARCHAR(3)   NOT NULL UNIQUE,
    iso2        VARCHAR(2)   NOT NULL,
    name        VARCHAR(255) NOT NULL,
    region      VARCHAR(100),
    lat         DECIMAL(9,6),
    lon         DECIMAL(9,6),
    population  INTEGER,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_countries_iso3 ON countries(iso3);

CREATE TABLE IF NOT EXISTS pulse_scores (
    id              SERIAL PRIMARY KEY,
    country_iso3    VARCHAR(3)  NOT NULL REFERENCES countries(iso3),
    score_date      DATE        NOT NULL,
    pulse_score     DECIMAL(5,2),
    conflict_score  DECIMAL(5,2),
    food_score      DECIMAL(5,2),
    economic_score  DECIMAL(5,2),
    data_quality    DECIMAL(4,3),
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_iso3, score_date)
);

CREATE INDEX IF NOT EXISTS idx_pulse_scores_country ON pulse_scores(country_iso3);
CREATE INDEX IF NOT EXISTS idx_pulse_scores_date ON pulse_scores(score_date DESC);

CREATE TABLE IF NOT EXISTS raw_metrics (
    id           SERIAL PRIMARY KEY,
    country_iso3 VARCHAR(3)   NOT NULL,
    source       VARCHAR(50)  NOT NULL,
    metric_name  VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4),
    metric_date  DATE,
    fetched_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_metrics_country ON raw_metrics(country_iso3);
CREATE INDEX IF NOT EXISTS idx_raw_metrics_name    ON raw_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_raw_metrics_date    ON raw_metrics(metric_date DESC);

CREATE TABLE IF NOT EXISTS scraper_runs (
    id               SERIAL PRIMARY KEY,
    scraper_name     VARCHAR(50)  NOT NULL,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    status           VARCHAR(20)  DEFAULT 'running',
    records_fetched  INTEGER      DEFAULT 0,
    error_message    TEXT
);

-- Enable Row Level Security (Supabase best practice)
ALTER TABLE countries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_metrics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_runs  ENABLE ROW LEVEL SECURITY;

-- Allow public read access to countries and scores (the dashboard is public)
CREATE POLICY "public_read_countries"    ON countries    FOR SELECT USING (true);
CREATE POLICY "public_read_scores"       ON pulse_scores FOR SELECT USING (true);

-- Service role has full access (for the backend)
CREATE POLICY "service_all_countries"    ON countries    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_scores"       ON pulse_scores FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_raw_metrics"  ON raw_metrics  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_runs"         ON scraper_runs FOR ALL USING (auth.role() = 'service_role');
