-- Notes de soumission — le texte brut fourni par un visiteur qui propose
-- une entrée Debunk ou Relais scientifique, gardé à part des champs
-- éditoriaux vérifiés (reality, description...). Jamais affiché
-- publiquement, uniquement visible en admin le temps de la relecture —
-- évite qu'un contenu non vérifié se retrouve un jour affiché si la
-- bascule "published" est actionnée par erreur avant relecture complète.
-- Cohérent avec le principe déjà en place sur ces deux rubriques : on
-- écrit toujours notre propre résumé, jamais une reprise telle quelle.
ALTER TABLE debunk_entries ADD COLUMN IF NOT EXISTS submission_notes TEXT;
ALTER TABLE science_relays ADD COLUMN IF NOT EXISTS submission_notes TEXT;
