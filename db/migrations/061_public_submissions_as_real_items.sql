-- Aligne charte et idées-enfants sur le principe des 5 autres rubriques à
-- soumission publique (débunk, interviews, paysans, pétitions,
-- ressources) : une proposition devient directement une entrée réelle
-- (non publiée, submitted_publicly=true), modifiable via la page
-- d'édition existante avant publication — plutôt qu'un texte libre à part
-- qui, une fois publié, restait une simple ligne de liste au lieu d'un
-- vrai bloc votable (👍 J'adhère / 🤔 À nuancer).
--
-- L'ancien système (charter_suggestions / future_idea_suggestions) est
-- conservé tel quel, rien n'est supprimé — les éventuelles suggestions
-- déjà en attente y restent accessibles depuis l'admin.

ALTER TABLE future_ideas
  ADD COLUMN IF NOT EXISTS submitted_publicly BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitter_email TEXT,
  ADD COLUMN IF NOT EXISTS submission_notes TEXT;

ALTER TABLE charter_items
  ADD COLUMN IF NOT EXISTS submitted_publicly BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitter_email TEXT,
  ADD COLUMN IF NOT EXISTS submission_notes TEXT;

-- section_id est obligatoire sur charter_items — un visiteur ne peut pas
-- raisonnablement choisir parmi les sections éditoriales existantes, donc
-- toute proposition publique atterrit dans cette section par défaut,
-- à trier/déplacer ensuite par l'admin (le formulaire d'édition permet
-- déjà de changer la section).
INSERT INTO charter_sections (name, display_order)
SELECT 'Boîte à idées (à trier)', COALESCE(MAX(display_order), 0) + 1
FROM charter_sections
WHERE NOT EXISTS (SELECT 1 FROM charter_sections WHERE name = 'Boîte à idées (à trier)');
