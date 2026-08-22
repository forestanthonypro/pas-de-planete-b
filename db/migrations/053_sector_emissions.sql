-- Émissions de gaz à effet de serre par secteur économique et par pays —
-- source Climate Watch (World Resources Institute), licence CC BY 4.0.
-- Permet de calculer la part réelle de l'industrie dans les émissions
-- totales d'un pays (kit de communication "Actions"), plutôt qu'une
-- comparaison ultra-spécifique du type "le plus gros site industriel vs
-- une boulangerie" — décision du 22 août après avoir constaté que la
-- décomposition sectorielle avait disparu du CSV OWID déjà utilisé pour
-- le CO2 (owid-co2-data.csv, remplacé par la source Jones et al. pour les
-- gaz à effet de serre totaux).
CREATE TABLE IF NOT EXISTS sector_emissions (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,       -- code ISO 3166-1 alpha-3
  year INTEGER NOT NULL,
  sector TEXT NOT NULL,             -- libellé Climate Watch (ex. "Energy", "Industrial Processes")
  value_mtco2e NUMERIC(12, 3),      -- millions de tonnes de CO2 équivalent
  UNIQUE (country_code, year, sector)
);

CREATE INDEX IF NOT EXISTS idx_sector_emissions_country_year
  ON sector_emissions (country_code, year);
