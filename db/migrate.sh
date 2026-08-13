#!/bin/bash
# Applique les fichiers db/migrations/*.sql non encore appliqués, dans
# l'ordre, en gardant la trace de ce qui l'a déjà été (table _migrations).
#
# Usage :
#   ./db/migrate.sh                              # local (docker-compose.yml)
#   ./db/migrate.sh docker-compose.prod.yml       # production
#   ./db/migrate.sh docker-compose.prod.yml --baseline
#     # Marque toutes les migrations existantes comme déjà appliquées SANS
#     # les rejouer — à utiliser une seule fois sur une base où elles ont
#     # déjà été appliquées manuellement (ex: premier déploiement du
#     # 6 août 2026, fait à la main avant que ce script existe).
#   ./db/migrate.sh docker-compose.prod.yml --check
#     # Vérifie qu'aucune migration n'est en attente, SANS rien appliquer.
#     # Échoue (code de sortie 1) et liste les fichiers manquants s'il y en
#     # a. Utile en vérification manuelle à tout moment, ou comme étape CI
#     # distincte pour une confirmation visible et séparée du déploiement
#     # lui-même (ajouté le 10 août 2026, après la découverte d'une
#     # migration restée non appliquée plusieurs semaines sans que
#     # personne ne le remarque).
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.yml"
BASELINE=false
CHECK=false
for arg in "$@"; do
  case "$arg" in
    --baseline) BASELINE=true ;;
    --check) CHECK=true ;;
    *.yml) COMPOSE_FILE="$arg" ;;
  esac
done

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PGUSER="${POSTGRES_USER:-pdpb}"
PGDB="${POSTGRES_DB:-pasdeplaneteb}"

psql_exec() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1 "$@"
}

echo "Fichier compose : $COMPOSE_FILE | Base : $PGDB (utilisateur $PGUSER)"

psql_exec -c "
CREATE TABLE IF NOT EXISTS _migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"

if [ "$BASELINE" = true ]; then
  echo "Mode --baseline : marquage des migrations existantes comme déjà appliquées, sans les rejouer."
  for f in db/migrations/*.sql; do
    name=$(basename "$f")
    psql_exec -c "INSERT INTO _migrations (filename) VALUES ('$name') ON CONFLICT DO NOTHING;" > /dev/null
  done
  echo "Baseline posée sur $(ls db/migrations/*.sql | wc -l) fichier(s)."
  exit 0
fi

if [ "$CHECK" = true ]; then
  echo "Mode --check : vérification des migrations en attente (rien n'est appliqué)."
  pending=()
  for f in db/migrations/*.sql; do
    name=$(basename "$f")
    already=$(psql_exec -tAc "SELECT 1 FROM _migrations WHERE filename = '$name'")
    if [ "$already" != "1" ]; then
      pending+=("$name")
    fi
  done
  if [ "${#pending[@]}" -eq 0 ]; then
    echo "✅ Aucune migration en attente — tous les fichiers de db/migrations/ sont bien enregistrés comme appliqués."
    exit 0
  else
    echo "❌ ${#pending[@]} migration(s) présente(s) dans db/migrations/ mais PAS enregistrée(s) comme appliquée(s) :"
    for name in "${pending[@]}"; do
      echo "   - $name"
    done
    echo "Lance ./db/migrate.sh (sans --check) pour les appliquer."
    exit 1
  fi
fi

applied_count=0
for f in db/migrations/*.sql; do
  name=$(basename "$f")
  already=$(psql_exec -tAc "SELECT 1 FROM _migrations WHERE filename = '$name'")
  if [ "$already" = "1" ]; then
    continue
  fi
  echo "▶  Application de $name..."
  if psql_exec < "$f"; then
    psql_exec -c "INSERT INTO _migrations (filename) VALUES ('$name');" > /dev/null
    echo "✅ $name appliquée"
    applied_count=$((applied_count + 1))
  else
    echo "❌ ÉCHEC sur $name — arrêt. Corrige le fichier ou la base avant de relancer (aucune migration suivante n'a été tentée)."
    exit 1
  fi
done

if [ "$applied_count" -eq 0 ]; then
  echo "Rien à faire, toutes les migrations sont déjà appliquées."
else
  echo "$applied_count nouvelle(s) migration(s) appliquée(s) avec succès."
fi
