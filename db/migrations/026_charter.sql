-- Charte éthique "Les enfants d'aujourd'hui et de demain" — sections et
-- éléments gérables et réordonnables en admin, vote citoyen anonyme sur
-- chaque élément, et boîte à idées modérée avant publication.

CREATE TABLE IF NOT EXISTS charter_sections (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS charter_items (
    id SERIAL PRIMARY KEY,
    section_id INTEGER NOT NULL REFERENCES charter_sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_charter_items_section ON charter_items (section_id, display_order);

-- Un vote anonyme par personne et par élément — peut changer d'avis
-- (upsert), jamais deux votes différents comptés pour la même personne.
CREATE TABLE IF NOT EXISTS charter_votes (
    anonymous_id UUID NOT NULL,
    item_id INTEGER NOT NULL REFERENCES charter_items(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('adhere', 'nuance')),
    voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (anonymous_id, item_id)
);

-- Boîte à idées : suggestions du public, jamais publiées directement —
-- toujours modérées manuellement avant d'apparaître (ou de devenir un
-- élément à part entière de la charte).
CREATE TABLE IF NOT EXISTS charter_suggestions (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'draft', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_charter_suggestions_status ON charter_suggestions (status, submitted_at DESC);
