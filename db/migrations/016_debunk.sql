-- Rubrique DEBUNK : idées reçues démontées avec sources vérifiables.
-- Volontairement livré sans contenu — les entrées seront choisies et
-- rédigées ensemble par la suite, pas inventées automatiquement.
CREATE TABLE IF NOT EXISTS debunk_entries (
    slug TEXT PRIMARY KEY,
    myth TEXT NOT NULL,           -- l'idée reçue, telle qu'on l'entend couramment
    reality TEXT NOT NULL,        -- la réalité, avec la nuance nécessaire
    category TEXT,                -- ex: "climat", "biodiversité", "énergie"
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sources associées à chaque entrée — une entrée peut avoir plusieurs
-- sources (recommandé : au moins une source primaire/officielle).
CREATE TABLE IF NOT EXISTS debunk_sources (
    id SERIAL PRIMARY KEY,
    debunk_slug TEXT NOT NULL REFERENCES debunk_entries(slug) ON DELETE CASCADE,
    label TEXT NOT NULL,          -- ex: "GIEC, rapport AR6 (2021)"
    url TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_debunk_sources_slug ON debunk_sources (debunk_slug);
