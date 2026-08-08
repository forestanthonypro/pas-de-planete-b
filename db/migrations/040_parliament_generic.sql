-- Schéma générique pour les parlements étrangers (États-Unis en premier,
-- prévu aussi pour l'Italie et l'Espagne — mêmes types de données de base
-- confirmés côté sources officielles : élus, groupes/partis, votes par
-- appel nominal avec position de chaque élu).
--
-- Volontairement séparé du schéma français existant (deputies, an_groups,
-- scrutins, deputy_votes, deputy_follows) : la France reste inchangée,
-- ce nouveau schéma sert uniquement aux pays ajoutés à partir de
-- maintenant, avec country_code comme discriminant.
--
-- "chamber" utilise des valeurs génériques ('lower', 'upper') plutôt que
-- des noms spécifiques à un pays ('house'/'senate', 'camera'/'senato'...) —
-- les libellés affichés (« Chambre des représentants », « Camera dei
-- Deputati »...) sont gérés côté frontend via l'i18n existant (t()), pas
-- stockés en base, pour rester cohérent avec le fait que ce sont des
-- libellés d'interface fixes, pas du contenu éditorial.

CREATE TABLE IF NOT EXISTS parliament_groups (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  external_id TEXT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, slug)
);

CREATE TABLE IF NOT EXISTS parliament_members (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  chamber TEXT NOT NULL,
  external_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  group_id INTEGER REFERENCES parliament_groups(id) ON DELETE SET NULL,
  state_or_region TEXT,
  photo_url TEXT,
  official_url TEXT,
  in_office BOOLEAN NOT NULL DEFAULT true,
  term_start DATE,
  term_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, chamber, external_id)
);
CREATE INDEX IF NOT EXISTS idx_parliament_members_country_chamber
  ON parliament_members (country_code, chamber);

CREATE TABLE IF NOT EXISTS parliament_votes (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  chamber TEXT NOT NULL,
  external_id TEXT NOT NULL,
  question TEXT NOT NULL,
  bill_number TEXT,
  vote_date DATE,
  result TEXT,
  yes_count INTEGER NOT NULL DEFAULT 0,
  no_count INTEGER NOT NULL DEFAULT 0,
  abstain_count INTEGER NOT NULL DEFAULT 0,
  not_voting_count INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, chamber, external_id)
);
CREATE INDEX IF NOT EXISTS idx_parliament_votes_country_chamber_date
  ON parliament_votes (country_code, chamber, vote_date DESC);

CREATE TABLE IF NOT EXISTS parliament_member_votes (
  id SERIAL PRIMARY KEY,
  vote_id INTEGER NOT NULL REFERENCES parliament_votes(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES parliament_members(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  UNIQUE (vote_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_parliament_member_votes_member
  ON parliament_member_votes (member_id);

-- Votes citoyens anonymes sur les scrutins étrangers — même principe que
-- citizen_votes côté France : voter_hash est un identifiant technique
-- généré côté client, jamais relié à une identité (voir la politique de
-- confidentialité).
CREATE TABLE IF NOT EXISTS parliament_citizen_votes (
  id SERIAL PRIMARY KEY,
  vote_id INTEGER NOT NULL REFERENCES parliament_votes(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  position TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vote_id, voter_hash)
);

-- Suivi par email d'un élu étranger — même principe que deputy_follows.
CREATE TABLE IF NOT EXISTS parliament_member_follows (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES parliament_members(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, email)
);
