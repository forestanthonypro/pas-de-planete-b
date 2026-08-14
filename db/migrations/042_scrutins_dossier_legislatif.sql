-- Ajoute un lien direct vers le dossier législatif (texte de loi voté)
-- sur assemblee-nationale.fr, quand disponible dans les données source
-- (champ objet.dossierLegislatif.dossierRef du JSON, présent pour ~31%
-- des scrutins — les votes sur un texte complet plutôt que sur un
-- article/amendement isolé). Repli sur le lien "analyse du scrutin"
-- existant côté frontend quand NULL, comme pour les votes internationaux
-- sans numéro de loi associé (voir ingest-us-congress.js, billTextUrl).
ALTER TABLE scrutins ADD COLUMN IF NOT EXISTS dossier_legislatif_url TEXT;
