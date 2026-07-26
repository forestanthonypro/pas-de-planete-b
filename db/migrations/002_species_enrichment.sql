-- Enrichit species_status (règne, identifiant GBIF stable, noms multilingues)
-- et ajoute la table de liaison espèce <-> pays.

ALTER TABLE species_status
  ADD COLUMN IF NOT EXISTS gbif_key TEXT,
  ADD COLUMN IF NOT EXISTS kingdom TEXT,
  ADD COLUMN IF NOT EXISTS common_names JSONB;

ALTER TABLE species_status
  DROP COLUMN IF EXISTS common_name;

-- Les espèces ingérées avant cette migration n'ont pas de gbif_key : on les retire,
-- la prochaine ingestion les recréera proprement avec toutes les nouvelles infos.
DELETE FROM species_status WHERE gbif_key IS NULL;

-- Un même gbif_key ne doit apparaître qu'une fois.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'species_status_gbif_key_key'
  ) THEN
    ALTER TABLE species_status ADD CONSTRAINT species_status_gbif_key_key UNIQUE (gbif_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS species_countries (
    gbif_key TEXT NOT NULL REFERENCES species_status (gbif_key) ON DELETE CASCADE,
    country_code CHAR(3) NOT NULL,
    PRIMARY KEY (gbif_key, country_code)
);
CREATE INDEX IF NOT EXISTS idx_species_countries_country ON species_countries (country_code);
