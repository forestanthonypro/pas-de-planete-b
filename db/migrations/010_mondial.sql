-- Repères mondiaux (une valeur de référence par métrique, pas une série
-- complète) pour comparer le pays sélectionné au reste du monde. Et données
-- de pollution de l'air (PM2.5) par pays, nouvelle depuis cette migration.

CREATE TABLE IF NOT EXISTS world_benchmarks (
    metric_key TEXT PRIMARY KEY,
    value NUMERIC,
    unit TEXT,
    year INTEGER,
    source TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollution_data (
    id SERIAL PRIMARY KEY,
    country_code CHAR(3) NOT NULL,
    country_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    pm25_ug_m3 NUMERIC(8, 2),
    source TEXT NOT NULL DEFAULT 'SatPM (Washington University in St. Louis), via Our World in Data',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country_code, year)
);
CREATE INDEX IF NOT EXISTS idx_pollution_country_year ON pollution_data (country_code, year);

ALTER TABLE electricity_generation
  ADD COLUMN IF NOT EXISTS demand_per_capita_kwh NUMERIC(10, 2);
