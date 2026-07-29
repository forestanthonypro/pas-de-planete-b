-- Votes citoyens : un visiteur peut voter (anonymement) sur un scrutin pour
-- comparer sa réponse à celle de l'Assemblée. Rien n'est enregistré côté
-- serveur tant que la personne n'a pas explicitement confirmé vouloir
-- garder un historique — voir le consentement géré côté frontend
-- (lib/anonymousId.js). L'identifiant est un UUID généré dans le navigateur,
-- jamais lié à un email, un nom ou une IP.
CREATE TABLE IF NOT EXISTS citizen_votes (
    anonymous_id UUID NOT NULL,
    legislature INTEGER NOT NULL,
    numero_scrutin INTEGER NOT NULL,
    position TEXT NOT NULL CHECK (position IN ('pour', 'contre', 'abstention')),
    voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (anonymous_id, legislature, numero_scrutin)
);
CREATE INDEX IF NOT EXISTS idx_citizen_votes_scrutin ON citizen_votes (legislature, numero_scrutin);
