-- Migration initiale : schéma de base pour Pas de planète B
-- PostGIS est déjà activé par l'image docker postgis/postgis utilisée en dev/prod

-- Émissions de CO2 par pays (source : Global Carbon Project / Our World in Data)
CREATE TABLE IF NOT EXISTS co2_emissions (
    id SERIAL PRIMARY KEY,
    country_code CHAR(3) NOT NULL,       -- ISO 3166-1 alpha-3
    country_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    emissions_mt NUMERIC(12, 3),         -- mégatonnes de CO2
    emissions_per_capita NUMERIC(8, 3),  -- tonnes par habitant
    source TEXT NOT NULL DEFAULT 'Global Carbon Project via Our World in Data',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country_code, year)
);
CREATE INDEX IF NOT EXISTS idx_co2_country_year ON co2_emissions (country_code, year);

-- Centrales électriques (source : Global Power Plant Database, WRI)
CREATE TABLE IF NOT EXISTS power_plants (
    id SERIAL PRIMARY KEY,
    external_id TEXT UNIQUE,             -- identifiant de la source d'origine
    name TEXT NOT NULL,
    country_code CHAR(3) NOT NULL,
    fuel_type TEXT NOT NULL,             -- ex: solar, wind, gas, coal, nuclear, hydro
    capacity_mw NUMERIC(10, 2),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    source TEXT NOT NULL DEFAULT 'Global Power Plant Database (WRI)',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_power_plants_location ON power_plants USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_power_plants_country ON power_plants (country_code);

-- Incendies actifs / zones brûlées (source : NASA FIRMS, complété par EFFIS en Europe)
CREATE TABLE IF NOT EXISTS fires (
    id SERIAL PRIMARY KEY,
    detected_at TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    confidence NUMERIC(5, 2),            -- % de confiance de la détection
    frp NUMERIC(8, 2),                   -- fire radiative power
    source TEXT NOT NULL DEFAULT 'NASA FIRMS',
    country_code CHAR(3),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fires_location ON fires USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_fires_detected_at ON fires (detected_at);

-- Statuts d'extinction des espèces (source : IUCN Red List)
CREATE TABLE IF NOT EXISTS species_status (
    id SERIAL PRIMARY KEY,
    scientific_name TEXT NOT NULL UNIQUE,
    common_name TEXT,
    category CHAR(2) NOT NULL,           -- EX, EW, CR, EN, VU, NT, LC, DD
    population_trend TEXT,               -- increasing, decreasing, stable, unknown
    source TEXT NOT NULL DEFAULT 'IUCN Red List',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Statistiques anonymes agrégées (jamais d'identifiant utilisateur ici, par construction)
CREATE TABLE IF NOT EXISTS anonymous_stats_daily (
    id SERIAL PRIMARY KEY,
    day DATE NOT NULL,
    metric TEXT NOT NULL,                -- ex: 'profil_ville_maison_enfants'
    dimension_value TEXT NOT NULL,       -- ex: 'ville|maison|oui'
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (day, metric, dimension_value)
);
