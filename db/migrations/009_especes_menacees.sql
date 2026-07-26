-- Comptage officiel d'espèces menacées par pays (IUCN Red List / UNEP-WCMC via
-- Banque mondiale), pour comparer avec l'échantillon GBIF déjà affiché — et
-- référentiel mondial du % d'espèces menacées par grand groupe taxonomique,
-- pour donner un point de comparaison international (pas un vrai % par pays :
-- personne ne publie de dénominateur fiable "nombre total d'espèces par pays").

CREATE TABLE IF NOT EXISTS species_threatened_counts (
    id SERIAL PRIMARY KEY,
    country_code CHAR(3) NOT NULL,
    country_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    mammals_threatened INTEGER,
    birds_threatened INTEGER,
    fish_threatened INTEGER,
    source TEXT NOT NULL DEFAULT 'IUCN Red List / UNEP-WCMC via Banque mondiale, via Our World in Data',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country_code, year)
);
CREATE INDEX IF NOT EXISTS idx_species_threatened_country_year ON species_threatened_counts (country_code, year);

CREATE TABLE IF NOT EXISTS species_threatened_global_share (
    taxon_group TEXT PRIMARY KEY,
    share_percent NUMERIC(5, 1),
    year INTEGER,
    source TEXT NOT NULL DEFAULT 'IUCN Red List Summary Statistics, via Our World in Data',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
