-- Relais d'interviews, articles et vidéos scientifiques — contenu éditorial
-- (comme Debunk), jamais de citation longue reproduite (droit d'auteur) :
-- on écrit notre propre résumé factuel et on renvoie vers la source.
CREATE TABLE IF NOT EXISTS science_relays (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,              -- notre propre titre, pas celui de la source
    description TEXT NOT NULL,        -- résumé factuel écrit par nous, pas une citation
    scientist_name TEXT,
    scientist_field TEXT,             -- ex: "Climatologue", "Biologiste marin"
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'article', 'podcast')),
    source_url TEXT NOT NULL,         -- lien vers la source originale, toujours affiché
    source_name TEXT,                 -- ex: "France Inter", "Le Monde", "Chaîne YouTube X"
    embed_url TEXT,                   -- URL d'intégration (vidéo/podcast), vide pour les articles
    category TEXT,
    related_debunk_slug TEXT REFERENCES debunk_entries(slug) ON DELETE SET NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_science_relays_published ON science_relays (published, updated_at DESC);
