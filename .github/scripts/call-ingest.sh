#!/usr/bin/env bash
# Appelle un endpoint d'ingestion de l'API avec quelques nouvelles tentatives,
# limitées aux échecs qui surviennent AVANT que l'API ait commencé à traiter :
#   - curl 6  : le nom d'hôte n'a pas pu être résolu (panne DNS passagère du
#               runner, constatée le 25 novembre 2026) ;
#   - curl 7  : connexion impossible ;
#   - curl 22 : erreur HTTP (ex. 502 du proxy), seulement si elle survient en
#               moins de 30 s — une erreur survenue après une longue attente
#               signifie que l'ingestion a démarré, on ne la relance pas.
# Un dépassement de --max-time (curl 28) n'est JAMAIS rejoué : on ne relance
# pas une ingestion de 20 minutes qui a peut-être abouti.
#
# Usage : INGEST_TOKEN=... call-ingest.sh <url> [max-time-secondes]
# Variables : RETRY_DELAY (secondes entre deux tentatives, 60 par défaut).
set -u

url="${1:?usage: call-ingest.sh <url> [max-time]}"
max_time="${2:-}"
delay="${RETRY_DELAY:-60}"
attempts=3

for attempt in $(seq 1 "$attempts"); do
  start=$SECONDS
  args=(-f -X POST "$url" -H "x-ingest-token: ${INGEST_TOKEN:?INGEST_TOKEN manquant}")
  if [ -n "$max_time" ]; then args+=(--max-time "$max_time"); fi

  curl "${args[@]}" && exit 0
  code=$?
  elapsed=$((SECONDS - start))

  transient=false
  if [ "$code" -eq 6 ] || [ "$code" -eq 7 ]; then transient=true; fi
  if [ "$code" -eq 22 ] && [ "$elapsed" -lt 30 ]; then transient=true; fi

  if [ "$transient" = true ] && [ "$attempt" -lt "$attempts" ]; then
    echo "Échec transitoire (curl $code après ${elapsed}s) : tentative $((attempt + 1))/$attempts dans ${delay}s" >&2
    sleep "$delay"
    continue
  fi
  echo "Échec définitif (curl $code après ${elapsed}s, tentative $attempt/$attempts)" >&2
  exit "$code"
done
