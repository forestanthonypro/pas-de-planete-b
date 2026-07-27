-- Députés de l'Assemblée nationale et leurs votes sur les scrutins publics,
-- source NosDéputés.fr (Regards Citoyens), à partir des données officielles
-- de l'Assemblée nationale et du Journal Officiel.
--
-- Limite volontaire de périmètre : la 17e législature (depuis juillet 2024)
-- a déjà dépassé 8000 scrutins (contre ~4000-4400 pour des législatures
-- précédentes sur 5 ans complètes, probablement lié à l'instabilité politique
-- actuelle). On se limite volontairement aux scrutins les plus récents
-- (~200) plutôt qu'à tout l'historique, pour rester gérable.

CREATE TABLE IF NOT EXISTS deputies (
    slug TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    group_acronym TEXT,
    group_name TEXT,
    department TEXT,
    circo_name TEXT,
    circo_number INTEGER,
    profession TEXT,
    mandate_start DATE,
    url_an TEXT,
    source TEXT NOT NULL DEFAULT 'NosDéputés.fr (Regards Citoyens), à partir de l''Assemblée nationale et du Journal Officiel',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scrutins (
    legislature INTEGER NOT NULL,
    numero INTEGER NOT NULL,
    scrutin_date DATE,
    title TEXT,
    result TEXT,
    votes_pour INTEGER,
    votes_contre INTEGER,
    votes_abstention INTEGER,
    source TEXT NOT NULL DEFAULT 'NosDéputés.fr (Regards Citoyens), à partir de l''Assemblée nationale et du Journal Officiel',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (legislature, numero)
);

CREATE TABLE IF NOT EXISTS deputy_votes (
    deputy_slug TEXT NOT NULL REFERENCES deputies(slug) ON DELETE CASCADE,
    legislature INTEGER NOT NULL,
    scrutin_numero INTEGER NOT NULL,
    position TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (deputy_slug, legislature, scrutin_numero),
    FOREIGN KEY (legislature, scrutin_numero) REFERENCES scrutins(legislature, numero) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_deputy_votes_scrutin ON deputy_votes (legislature, scrutin_numero);
CREATE INDEX IF NOT EXISTS idx_deputy_votes_deputy ON deputy_votes (deputy_slug);
