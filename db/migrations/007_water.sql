-- Ressources en eau par pays et par année : ressources renouvelables disponibles
-- par habitant (AQUASTAT/FAO via Banque mondiale) et pluviométrie annuelle
-- (Copernicus ERA5), toutes deux republiées par Our World in Data.
CREATE TABLE IF NOT EXISTS water_data (
    id SERIAL PRIMARY KEY,
    country_code CHAR(3) NOT NULL,
    country_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    renewable_freshwater_m3_per_capita NUMERIC(12, 3),
    precipitation_mm NUMERIC(10, 2),
    source TEXT NOT NULL DEFAULT 'AQUASTAT/FAO via Banque mondiale, et Copernicus ERA5, via Our World in Data',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country_code, year)
);
CREATE INDEX IF NOT EXISTS idx_water_country_year ON water_data (country_code, year);
