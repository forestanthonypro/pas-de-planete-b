-- Normales (moyenne ±7 jours) et records (jour exact) par station de
-- référence et par jour calendaire — calculés à partir de
-- reference_weather_daily via ingest/referenceWeatherNormals.js, sur la
-- période officielle 1991-2020. Une ligne par (station, mois-jour), donc
-- 366 lignes maximum par station (29 février inclus).

CREATE TABLE IF NOT EXISTS reference_weather_normals (
    station_code TEXT NOT NULL REFERENCES reference_weather_stations(station_code) ON DELETE CASCADE,
    -- Format "MM-DD" (ex. "07-15" pour le 15 juillet) plutôt qu'un numéro
    -- de jour dans l'année 1-366, pour éviter les décalages d'une unité
    -- qu'introduiraient les années bissextiles avec un simple entier.
    month_day TEXT NOT NULL,
    normal_temp_min NUMERIC,
    normal_temp_max NUMERIC,
    record_temp_min NUMERIC,
    record_temp_min_year INTEGER,
    record_temp_max NUMERIC,
    record_temp_max_year INTEGER,
    -- Nombre de relevés ayant contribué à la normale (fenêtre ±7 jours x
    -- nombre d'années disponibles) — sert à distinguer une normale fiable
    -- (viser 30 ans x 15 jours = 450) d'une encore provisoire, tant que le
    -- backfill historique n'est pas terminé pour cette station.
    sample_size INTEGER NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (station_code, month_day)
);
