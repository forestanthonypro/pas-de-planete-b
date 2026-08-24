-- Jusqu'ici, species_observation_places ne contenait que 4 lieux pilotes
-- codés en dur (Paris, Lozère, Bamako, Mumbai). L'ingestion couvre
-- désormais automatiquement la capitale de chaque pays déjà suivi par le
-- site (via countries.dev, gratuit et sans clé — données GeoNames CC BY
-- 4.0), en complément des lieux pilotes existants qui restent inchangés.
--
-- is_auto distingue les deux origines : false pour les lieux choisis à la
-- main (contexte rédigé, souvent hors capitale — ex. Lozère pour un
-- contexte rural/montagnard volontairement différent de Paris), true pour
-- les capitales ajoutées automatiquement. Permet, si besoin plus tard, de
-- traiter différemment l'affichage ou la maintenance des deux catégories.

ALTER TABLE species_observation_places
  ADD COLUMN IF NOT EXISTS is_auto BOOLEAN NOT NULL DEFAULT false;
