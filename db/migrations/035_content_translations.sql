-- Table générique de traductions pour le contenu géré en admin (débunk,
-- interviews, paysans, ressources×2, charte×2, idées enfants, pétitions).
-- Le français reste toujours la donnée "source" dans les tables existantes ;
-- cette table ne stocke que les variantes dans les 7 autres langues, en
-- overlay (voir apps/api/src/lib/translations.js : mergeTranslations,
-- applyTranslations).
--
-- content_id est un TEXT (pas un entier) : dans la quasi-totalité des cas
-- c'est le "slug" de la fiche source (idField par défaut dans
-- mergeTranslations), pas une clé primaire numérique.

CREATE TABLE IF NOT EXISTS content_translations (
  id SERIAL PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  locale TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_id, field_name, locale)
);

-- Accélère mergeTranslations(), qui filtre par (content_type, locale) sans
-- passer par content_id — un ordre de colonnes différent de la contrainte
-- unique ci-dessus, donc pas couvert par son index automatique.
CREATE INDEX IF NOT EXISTS idx_content_translations_type_locale
  ON content_translations (content_type, locale);
