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
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.yml"
BASELINE=false
for arg in "$@"; do
  case "$arg" in
    --baseline) BASELINE=true ;;
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
