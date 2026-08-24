-- Support de l'import en masse de lieux ressources (OpenStreetMap,
-- DATAtourisme et sources associées — voir apps/api/src/scripts/
-- importResourceLocations.js) : 4 catégories, ~66 000 lieux dans le
-- monde. Contrairement aux soumissions publiques (submitted_publicly),
-- ce sont des données ouvertes/institutionnelles importées par l'admin,
-- publiées directement (decision produit du 24/08/2026) — d'où le besoin
-- de tracer la provenance et la licence, absent jusqu'ici du schéma.
--
-- OpenStreetMap est sous licence ODbL 1.0, qui impose attribution et
-- partage à l'identique : license_attribution est affiché publiquement
-- sur chaque fiche concernée (voir ressources/index.js), pas seulement
-- conservé en base à titre informatif.

ALTER TABLE resource_locations
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS license_attribution TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT;

CREATE INDEX IF NOT EXISTS idx_resource_locations_source_name ON resource_locations (source_name);

-- Les 4 catégories du fichier source. Slugs choisis pour rester stables
-- même si le libellé français est un jour reformulé.
INSERT INTO resource_categories (name, slug) VALUES
  ('Jardin partagé', 'jardin-partage'),
  ('Marché local / producteurs', 'marche-local-producteurs'),
  ('Recyclerie / ressourcerie', 'recyclerie-ressourcerie'),
  ('Vente directe / producteur', 'vente-directe-producteur')
ON CONFLICT (slug) DO NOTHING;

-- Traductions des 4 catégories dans les 7 autres langues du site (le
-- français reste la donnée source dans resource_categories.name — voir
-- lib/translations.js). content_id = slug de la catégorie.
INSERT INTO content_translations (content_type, content_id, field_name, locale, value) VALUES
  ('resource_category', 'jardin-partage', 'name', 'en', 'Shared garden'),
  ('resource_category', 'marche-local-producteurs', 'name', 'en', 'Local farmers'' market'),
  ('resource_category', 'recyclerie-ressourcerie', 'name', 'en', 'Recycling center'),
  ('resource_category', 'vente-directe-producteur', 'name', 'en', 'Direct-from-producer sales'),

  ('resource_category', 'jardin-partage', 'name', 'es', 'Huerto comunitario'),
  ('resource_category', 'marche-local-producteurs', 'name', 'es', 'Mercado local de productores'),
  ('resource_category', 'recyclerie-ressourcerie', 'name', 'es', 'Punto de reciclaje'),
  ('resource_category', 'vente-directe-producteur', 'name', 'es', 'Venta directa del productor'),

  ('resource_category', 'jardin-partage', 'name', 'it', 'Orto condiviso'),
  ('resource_category', 'marche-local-producteurs', 'name', 'it', 'Mercato dei produttori locali'),
  ('resource_category', 'recyclerie-ressourcerie', 'name', 'it', 'Centro di riciclaggio'),
  ('resource_category', 'vente-directe-producteur', 'name', 'it', 'Vendita diretta dal produttore'),

  ('resource_category', 'jardin-partage', 'name', 'ru', 'Общественный сад'),
  ('resource_category', 'marche-local-producteurs', 'name', 'ru', 'Местный рынок производителей'),
  ('resource_category', 'recyclerie-ressourcerie', 'name', 'ru', 'Пункт переработки'),
  ('resource_category', 'vente-directe-producteur', 'name', 'ru', 'Прямая продажа от производителя'),

  ('resource_category', 'jardin-partage', 'name', 'ja', '共同菜園'),
  ('resource_category', 'marche-local-producteurs', 'name', 'ja', '地元生産者市場'),
  ('resource_category', 'recyclerie-ressourcerie', 'name', 'ja', 'リサイクルセンター'),
  ('resource_category', 'vente-directe-producteur', 'name', 'ja', '生産者直売'),

  ('resource_category', 'jardin-partage', 'name', 'zh', '共享花园'),
  ('resource_category', 'marche-local-producteurs', 'name', 'zh', '本地农产品市场'),
  ('resource_category', 'recyclerie-ressourcerie', 'name', 'zh', '回收站'),
  ('resource_category', 'vente-directe-producteur', 'name', 'zh', '生产者直销'),

  ('resource_category', 'jardin-partage', 'name', 'hi', 'साझा उद्यान'),
  ('resource_category', 'marche-local-producteurs', 'name', 'hi', 'स्थानीय उत्पादक बाज़ार'),
  ('resource_category', 'recyclerie-ressourcerie', 'name', 'hi', 'पुनर्चक्रण केंद्र'),
  ('resource_category', 'vente-directe-producteur', 'name', 'hi', 'उत्पादक से सीधी बिक्री')
ON CONFLICT (content_type, content_id, field_name, locale) DO UPDATE SET value = EXCLUDED.value;
