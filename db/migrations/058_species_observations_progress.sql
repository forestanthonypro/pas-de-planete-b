-- Suivi de progression pour l'ingestion par tranches (mode --resume, utilisé
-- en production via GitHub Actions toutes les 20 minutes — voir
-- .github/workflows/refresh-species-observations.yml). Avec jusqu'à 10
-- villes par pays, un cycle complet peut prendre 1h-1h30 : trop long pour
-- un seul appel HTTP, d'où ce découpage en tranches de 15 minutes qui
-- reprennent automatiquement là où la précédente s'est arrêtée.
--
-- Ligne unique (id=1). "phase" indique où en est le cycle en cours :
-- 'countries' (pays), 'places' (villes), ou 'done' (cycle terminé, en
-- attente du prochain). La reprise ne nécessite aucun curseur explicite :
-- on considère qu'un pays/lieu appartient au cycle en cours s'il a été
-- mis à jour après cycle_started_at (voir *_coverage.updated_at) — un
-- pays/lieu pas encore mis à jour ce cycle-ci est simplement repris.
--
-- Seedée avec phase='done' et une date très ancienne pour que la toute
-- première exécution en mode --resume démarre immédiatement un nouveau
-- cycle plutôt que de considérer qu'il n'y a rien à faire.

CREATE TABLE IF NOT EXISTS species_observations_progress (
  id INTEGER PRIMARY KEY DEFAULT 1,
  phase TEXT NOT NULL DEFAULT 'countries',
  cycle_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO species_observations_progress (id, phase, cycle_started_at)
VALUES (1, 'done', now() - interval '999 days')
ON CONFLICT (id) DO NOTHING;
