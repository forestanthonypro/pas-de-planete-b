-- "On devient tous paysans" — partage d'URLs, vidéos, podcasts et documents
-- autour des pratiques paysannes/autonomie alimentaire. Catégories gérables
-- en admin (pas du texte libre) pour garder un filtre cohérent dans le temps.
CREATE TABLE IF NOT EXISTS paysan_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paysan_resources (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,        -- résumé écrit par nous, jamais une citation longue
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'article', 'podcast', 'document')),
    source_url TEXT NOT NULL,
    source_name TEXT,
    embed_url TEXT,                   -- vidéo/podcast uniquement
    image_url TEXT,                   -- vignette pour article/document (vidéo = miniature auto)
    category_id INTEGER REFERENCES paysan_categories(id) ON DELETE SET NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_paysan_resources_published ON paysan_resources (published, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_paysan_resources_category ON paysan_resources (category_id);
