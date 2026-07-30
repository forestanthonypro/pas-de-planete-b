-- Ressources : deux volets distincts.
-- 1) Lieux physiques (carte) : jardins partagés, AMAP, recycleries...
-- 2) Ressources non physiques (trocs, plateformes d'échange en ligne...).
CREATE TABLE IF NOT EXISTS resource_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_locations (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    category_id INTEGER REFERENCES resource_categories(id) ON DELETE SET NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_locations_published ON resource_locations (published);

-- Un lieu peut avoir plusieurs liens (site, horaires, réseau social...).
CREATE TABLE IF NOT EXISTS resource_location_links (
    id SERIAL PRIMARY KEY,
    location_slug TEXT NOT NULL REFERENCES resource_locations(slug) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resource_location_links_slug ON resource_location_links (location_slug);

CREATE TABLE IF NOT EXISTS resource_online (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    category_id INTEGER REFERENCES resource_categories(id) ON DELETE SET NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_online_published ON resource_online (published);
