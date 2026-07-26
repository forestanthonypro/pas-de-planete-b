-- Perte de couverture arborée par pays et par année.
-- Source : Global Forest Watch, republié par Our World in Data (CSV ouvert, sans clé).
CREATE TABLE IF NOT EXISTS vegetation_loss (
    id SERIAL PRIMARY KEY,
    country_code CHAR(3) NOT NULL,
    country_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    tree_cover_loss_ha NUMERIC(14, 3),
    source TEXT NOT NULL DEFAULT 'Global Forest Watch via Our World in Data',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country_code, year)
);
CREATE INDEX IF NOT EXISTS idx_vegetation_country_year ON vegetation_loss (country_code, year);
