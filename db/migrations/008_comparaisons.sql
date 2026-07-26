-- Trois points de comparaison ajoutés aux graphiques existants :
-- 1) référentiel de surface forestière (pour situer la perte annuelle en contexte)
-- 2) génération électrique réelle par filière et par an (vs. capacité installée statique)
-- 3) prélèvements d'eau réels par an (vs. ressources disponibles)

ALTER TABLE vegetation_loss
  ADD COLUMN IF NOT EXISTS forest_area_ha NUMERIC(16, 2);

ALTER TABLE water_data
  ADD COLUMN IF NOT EXISTS withdrawal_m3 NUMERIC(18, 2);

CREATE TABLE IF NOT EXISTS electricity_generation (
    id SERIAL PRIMARY KEY,
    country_code CHAR(3) NOT NULL,
    country_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    coal_twh NUMERIC(12, 3),
    gas_twh NUMERIC(12, 3),
    oil_twh NUMERIC(12, 3),
    nuclear_twh NUMERIC(12, 3),
    hydro_twh NUMERIC(12, 3),
    wind_twh NUMERIC(12, 3),
    solar_twh NUMERIC(12, 3),
    biofuel_twh NUMERIC(12, 3),
    other_renewable_twh NUMERIC(12, 3),
    total_generation_twh NUMERIC(12, 3),
    demand_twh NUMERIC(12, 3),
    source TEXT NOT NULL DEFAULT 'Ember / Energy Institute, via Our World in Data',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country_code, year)
);
CREATE INDEX IF NOT EXISTS idx_electricity_country_year ON electricity_generation (country_code, year);
