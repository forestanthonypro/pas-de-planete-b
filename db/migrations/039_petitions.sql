-- Pétitions — recense des pétitions en cours ou clôturées (lien externe +
-- description écrite par nous), sur le même principe que "on devient tous
-- paysans" et les ressources : contenu géré en admin, formulaire public de
-- proposition modéré avant publication (published = false par défaut).
CREATE TABLE IF NOT EXISTS petitions (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,        -- résumé écrit par nous, jamais une citation longue
    petition_url TEXT NOT NULL,
    source_name TEXT,                 -- ex: "Change.org", "Assemblée nationale", "Mes Opinions"...
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'closed')),
    image_url TEXT,
    published BOOLEAN NOT NULL DEFAULT false,
    submitted_publicly BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_petitions_published ON petitions (published, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_petitions_status ON petitions (status);
