-- Ajoute les noms communs (multilingues, résolus via GBIF vernacularNames +
-- overrides manuels — même fichier et même logique que species.js) aux
-- espèces observées, pour ne plus afficher que le nom scientifique en
-- latin. Format identique à species_status.common_names : objet JSON
-- {"fr": "...", "en": "...", ...}.

ALTER TABLE species_observations_countries
  ADD COLUMN IF NOT EXISTS common_names JSONB;

ALTER TABLE species_observation_places_species
  ADD COLUMN IF NOT EXISTS common_names JSONB;
