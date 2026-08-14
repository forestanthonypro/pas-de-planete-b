-- Indicateurs de température par pays et par année, calculés à partir des
-- séries journalières Open-Meteo Historical Weather API (ERA5/ERA5-Land) —
-- un point représentatif (capitale) par pays, voir
-- apps/api/src/ingest/country_capitals.js et apps/api/src/ingest/temperatures.js.
--
-- Une seule ligne par pays/année : les séries journalières brutes ne sont pas
-- conservées en base (volume important sur ~75 ans x ~190 pays), seuls les
-- agrégats annuels utiles à l'affichage le sont. reference_period documente
-- la période de référence utilisée pour l'écart (warming stripes) et pour le
-- calcul des seuils canicule/vague de froid, au cas où elle change plus tard.
CREATE TABLE IF NOT EXISTS country_temperatures (
    id SERIAL PRIMARY KEY,
    country_code CHAR(3) NOT NULL,
    country_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    avg_temp_c NUMERIC(5, 2),
    max_temp_c NUMERIC(5, 2),
    min_temp_c NUMERIC(5, 2),
    deviation_from_reference_c NUMERIC(5, 2),
    heatwave_count INTEGER NOT NULL DEFAULT 0,
    coldwave_count INTEGER NOT NULL DEFAULT 0,
    reference_period TEXT NOT NULL DEFAULT '1991-2020',
    latitude NUMERIC(8, 4),
    longitude NUMERIC(8, 4),
    source TEXT NOT NULL DEFAULT 'Open-Meteo Historical Weather API (ERA5/ERA5-Land)',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country_code, year)
);

CREATE INDEX IF NOT EXISTS idx_country_temperatures_country_year ON country_temperatures (country_code, year);
