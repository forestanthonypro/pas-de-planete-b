-- Espèces de plantes réellement observées (GBIF occurrence/search), par pays
-- et par quelques villes/régions pilotes, avec vérification GlobalTreeSearch
-- (BGCI) pour les espèces les plus observées. Complète species_status
-- (statuts d'extinction IUCN) par un signal différent : ce qui est
-- concrètement recensé sur le terrain, pas un statut de conservation.
--
-- Licence GlobalTreeSearch = CC BY-NC 4.0 (non commerciale) — le champ
-- in_global_tree_search est un simple constat de présence dans une
-- checklist, jamais une recommandation d'essence. Rappel affiché côté
-- interface (vegetation.js) et dans le kit de communication Actions.
--
-- Couverture establishmentMeans / degreeOfEstablishment (Darwin Core,
-- natif/introduit/envahissant) : champs très inégalement renseignés selon
-- les pays (constat vérifié par exploration directe de l'API le 24/08/2026
-- — 0% de couverture locale sur plusieurs zones testées, alors que le
-- champ existe et est renseigné ailleurs, très concentré sur quelques
-- pays). D'où les tables *_coverage : elles permettent d'afficher
-- honnêtement "donnée absente pour cette zone" plutôt que de fabriquer un
-- indicateur natif/introduit peu fiable.

CREATE TABLE IF NOT EXISTS species_observations_countries (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,          -- ISO 3166-1 alpha-3
  scientific_name TEXT NOT NULL,
  observation_count BIGINT NOT NULL,
  in_global_tree_search BOOLEAN NOT NULL DEFAULT false,
  rank INTEGER NOT NULL,               -- 1 = espèce la plus observée dans ce pays
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, scientific_name)
);
CREATE INDEX IF NOT EXISTS idx_species_observations_countries_country
  ON species_observations_countries (country_code, rank);

CREATE TABLE IF NOT EXISTS species_observations_coverage (
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  total_occurrences BIGINT NOT NULL,
  establishment_means_count BIGINT NOT NULL DEFAULT 0,
  degree_of_establishment_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Villes/régions pilotes : liste volontairement restreinte au démarrage
-- (contrairement au niveau pays, GBIF n'offre pas de filtre "ville" — il
-- faut construire un rectangle géographique par lieu). Table pensée pour
-- être étendue au fil du temps sans changement de schéma.
CREATE TABLE IF NOT EXISTS species_observation_places (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  contexte TEXT,
  lat NUMERIC(9, 6) NOT NULL,
  lon NUMERIC(9, 6) NOT NULL,
  demi_cote_deg NUMERIC(5, 3) NOT NULL
);

CREATE TABLE IF NOT EXISTS species_observation_places_species (
  id SERIAL PRIMARY KEY,
  place_id INTEGER NOT NULL REFERENCES species_observation_places (id) ON DELETE CASCADE,
  scientific_name TEXT NOT NULL,
  observation_count BIGINT NOT NULL,
  in_global_tree_search BOOLEAN NOT NULL DEFAULT false,
  rank INTEGER NOT NULL,
  UNIQUE (place_id, scientific_name)
);
CREATE INDEX IF NOT EXISTS idx_species_observation_places_species_place
  ON species_observation_places_species (place_id, rank);

CREATE TABLE IF NOT EXISTS species_observation_places_coverage (
  place_id INTEGER PRIMARY KEY REFERENCES species_observation_places (id) ON DELETE CASCADE,
  total_occurrences BIGINT NOT NULL,
  establishment_means_count BIGINT NOT NULL DEFAULT 0,
  degree_of_establishment_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
