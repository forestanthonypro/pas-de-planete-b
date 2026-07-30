-- "Les enfants d'aujourd'hui et de demain" — espace d'idées à soutenir par
-- le vote, indépendant de la charte éthique. Un vote simple (soutien),
-- classement naturel par popularité plutôt qu'un ordre géré manuellement.
CREATE TABLE IF NOT EXISTS future_ideas (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_future_ideas_published ON future_ideas (published);

-- Un vote de soutien par personne et par idée — peut être retiré (bascule),
-- jamais compté deux fois pour la même personne.
CREATE TABLE IF NOT EXISTS future_idea_votes (
    anonymous_id UUID NOT NULL,
    idea_slug TEXT NOT NULL REFERENCES future_ideas(slug) ON DELETE CASCADE,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (anonymous_id, idea_slug)
);
