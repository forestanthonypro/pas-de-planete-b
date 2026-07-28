-- Députés, groupes politiques, scrutins et votes de l'Assemblée nationale
-- (17e législature), source CIVIX (data.gouv.fr), à partir des données
-- officielles de l'Assemblée nationale. Licence Ouverte / Open Licence 2.0.
--
-- Remplace entièrement une première tentative de ce même périmètre basée sur
-- NosDéputés.fr, qui s'est révélée non maintenue pour la législature en cours
-- (l'équipe bénévole avait annoncé dès 2022 que la législature précédente
-- serait la dernière qu'ils pourraient maintenir).

DROP TABLE IF EXISTS deputy_votes;
DROP TABLE IF EXISTS scrutins;
DROP TABLE IF EXISTS deputies;
DROP TABLE IF EXISTS an_groups;

CREATE TABLE an_groups (
    legislature INTEGER NOT NULL,
    abbreviation TEXT NOT NULL,
    name TEXT NOT NULL,
    effectif INTEGER,
    avg_participation_pct NUMERIC(5, 2),
    median_participation_pct NUMERIC(5, 2),
    total_votes_exprimes INTEGER,
    scrutins_eligibles INTEGER,
    source TEXT NOT NULL DEFAULT 'CIVIX, à partir des données open data de l''Assemblée nationale',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (legislature, abbreviation)
);

CREATE TABLE deputies (
    acteur_uid TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT NOT NULL,
    legislature INTEGER NOT NULL,
    circo_number INTEGER,
    department TEXT,
    group_name TEXT,
    group_abbreviation TEXT,
    source TEXT NOT NULL DEFAULT 'CIVIX, à partir des données open data de l''Assemblée nationale',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scrutins (
    legislature INTEGER NOT NULL,
    numero INTEGER NOT NULL,
    scrutin_uid TEXT,
    scrutin_date TIMESTAMPTZ,
    type_vote_code TEXT,
    type_vote_label TEXT,
    majority_type TEXT,
    result_code TEXT,
    result_label TEXT,
    title TEXT,
    objet TEXT,
    source TEXT NOT NULL DEFAULT 'CIVIX, à partir des données open data de l''Assemblée nationale',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (legislature, numero)
);

CREATE TABLE deputy_votes (
    legislature INTEGER NOT NULL,
    numero_scrutin INTEGER NOT NULL,
    acteur_uid TEXT NOT NULL REFERENCES deputies(acteur_uid) ON DELETE CASCADE,
    scrutin_uid TEXT,
    position TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'CIVIX, à partir des données open data de l''Assemblée nationale',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (legislature, numero_scrutin, acteur_uid)
);
CREATE INDEX idx_deputy_votes_scrutin ON deputy_votes (legislature, numero_scrutin);
CREATE INDEX idx_deputy_votes_deputy ON deputy_votes (acteur_uid);
