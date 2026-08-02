-- Suivi personnalisé d'un député par email : la personne reçoit un digest
-- quand de nouveaux votes de ce député sont enregistrés. Double opt-in
-- (confirmed) pour rester conforme RGPD — pas d'inscription silencieuse
-- possible avec l'email de quelqu'un d'autre.
--
-- last_notified_scrutin permet de calculer "qu'est-ce qui est nouveau
-- depuis le dernier digest" sans avoir à stocker un log d'envois séparé.
-- Initialisé au scrutin le plus récent au moment de la confirmation, pour
-- que le premier digest ne renvoie pas tout l'historique du député.
CREATE TABLE IF NOT EXISTS deputy_follows (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    acteur_uid TEXT NOT NULL REFERENCES deputies(acteur_uid) ON DELETE CASCADE,
    confirmed BOOLEAN NOT NULL DEFAULT false,
    confirm_token TEXT NOT NULL,
    unsubscribe_token TEXT NOT NULL,
    last_notified_scrutin INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (email, acteur_uid)
);

CREATE INDEX IF NOT EXISTS idx_deputy_follows_acteur ON deputy_follows (acteur_uid);
CREATE INDEX IF NOT EXISTS idx_deputy_follows_confirm_token ON deputy_follows (confirm_token);
CREATE INDEX IF NOT EXISTS idx_deputy_follows_unsub_token ON deputy_follows (unsubscribe_token);
