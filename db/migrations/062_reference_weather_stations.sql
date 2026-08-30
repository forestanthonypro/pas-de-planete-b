-- Indicateur thermique national maison : 10 stations de référence bien
-- réparties géographiquement (voir liste ci-dessous), historique quotidien
-- min/max sur la période de référence 1991-2020 (30 ans, la période
-- officielle des "normales" climatiques), pour calculer nous-mêmes un
-- écart à la normale et un ratio records de chaleur/froid.
--
-- Source des données : API Infoclimat OpenData (clé liée à l'IP du VPS,
-- voir /home/debian/pas-de-planete-b/scripts/README-infoclimat.md pour le
-- contexte). Codes stations fournis par Anthony le 30/08/2026 via
-- recherche manuelle sur https://www.infoclimat.fr/opendata/.

CREATE TABLE IF NOT EXISTS reference_weather_stations (
    station_code TEXT PRIMARY KEY,
    -- Nom convivial choisi (la ville qu'on veut représenter) — peut
    -- différer du nom exact de la station retourné par l'API (ex. une
    -- station "Grenoble - Saint-Martin-d'Hères" pour représenter
    -- "Grenoble").
    city_label TEXT NOT NULL,
    -- Rempli/mis à jour automatiquement par le script d'ingestion à partir
    -- des métadonnées renvoyées par l'API, pas saisi à la main.
    api_station_name TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    elevation INTEGER,
    display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reference_weather_daily (
    id SERIAL PRIMARY KEY,
    station_code TEXT NOT NULL REFERENCES reference_weather_stations(station_code) ON DELETE CASCADE,
    observed_date DATE NOT NULL,
    temp_min NUMERIC,
    temp_max NUMERIC,
    -- Nombre de relevés bruts ayant servi au calcul du jour — permet de
    -- repérer et exclure les jours à données incomplètes (panne de
    -- station, trou de collecte) plutôt que de les traiter comme des
    -- journées normales.
    reading_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (station_code, observed_date)
);
CREATE INDEX IF NOT EXISTS idx_reference_weather_daily_station_date ON reference_weather_daily (station_code, observed_date);

-- Reprise automatique de l'ingestion par lots de 7 jours (limite de l'API)
-- — même principe que species_observations_progress (migration 058).
CREATE TABLE IF NOT EXISTS reference_weather_ingest_progress (
    station_code TEXT PRIMARY KEY REFERENCES reference_weather_stations(station_code) ON DELETE CASCADE,
    next_start_date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    last_run_at TIMESTAMPTZ,
    consecutive_errors INTEGER NOT NULL DEFAULT 0
);

INSERT INTO reference_weather_stations (station_code, city_label, display_order) VALUES
    ('STATIC0061', 'Paris', 1),
    ('STATIC0368', 'Lille', 2),
    ('ME126', 'Strasbourg', 3),
    ('ME033', 'Brest', 4),
    ('ME034', 'Bordeaux', 5),
    ('000HF', 'Toulouse', 6),
    ('000C4', 'Marseille', 7),
    ('000BG', 'Lyon', 8),
    ('STATIC0273', 'Clermont-Ferrand', 9),
    ('000HT', 'Grenoble', 10)
ON CONFLICT (station_code) DO NOTHING;

-- Période de référence officielle des "normales" climatiques : 1991-2020.
INSERT INTO reference_weather_ingest_progress (station_code, next_start_date)
SELECT station_code, '1991-01-01'::date FROM reference_weather_stations
ON CONFLICT (station_code) DO NOTHING;
