# Pas de planète B

Application de sensibilisation au changement climatique — app mobile, site web et API, construites autour de sources de données officielles.

## Démarrage local

```bash
cp .env.example .env
docker compose up --build
```

- Site web : http://localhost:3000
- API : http://localhost:4000/health
- Base de données PostGIS : localhost:5432

## Structure du dépôt

```
apps/
  api/     API Node/Express (ingestion + service de données)
  web/     Site web Next.js
infra/
  traefik/ Configuration du reverse-proxy pour la production
docker-compose.yml       usage local (build à chaud, hot-reload)
docker-compose.prod.yml  usage production (images pré-construites, Traefik, TLS)
```

## Déploiement

Le pipeline CI (`.github/workflows/ci.yml`) construit et pousse les images vers GitHub Container Registry (GHCR) à chaque merge sur `main`, déploie automatiquement en staging, puis attend une validation manuelle avant la production (via un "environment" GitHub protégé — à configurer dans Settings > Environments).

En production, sur le serveur choisi (voir la discussion sur l'hébergement vert) :

```bash
cp .env.example .env   # avec les vraies valeurs de production
docker compose -f docker-compose.prod.yml up -d
```

Changer d'hébergeur = changer l'IP cible du déploiement SSH en CI, rien d'autre : tout tourne en conteneurs portables.

## Licence

À définir — une licence copyleft (AGPL-3.0) est cohérente avec l'esprit transparence/données ouvertes du projet, mais MIT reste une option plus permissive si vous voulez faciliter la réutilisation par d'autres associations. À trancher avant le premier commit public.
