# Pas de planète B

Application de sensibilisation au changement climatique — site web, application mobile et API, construites autour de sources de données officielles.

## Démarrage local

```bash
cp .env.example .env
docker compose up --build
```

- Site web : http://localhost:3000
- API : http://localhost:4000/health
- Base de données PostGIS : localhost:5432
- Administration éditoriale : http://localhost:3000/admin (protégée par code TOTP, voir `apps/web/components/AdminAuthGate.js`)

## Structure du dépôt

```
apps/
  api/     API Node/Express (ingestion + service de données)
  web/     Site web Next.js
  mobile/  Application mobile Capacitor (coquille native Android/iOS
           chargeant le site web en direct — voir capacitor.config.json)
db/
  migrations/  Migrations SQL PostgreSQL, appliquées dans l'ordre numéroté
infra/
  traefik/ Configuration du reverse-proxy pour la production
docker-compose.yml       usage local (build à chaud, hot-reload)
docker-compose.prod.yml  usage production (images pré-construites, Traefik, TLS, HSTS)
KNOWN_ISSUES_build.md    bug de build Next.js documenté (voir plus bas)
```

## Sécurité

Un audit de sécurité complet a été mené (voir l'historique de commits) :

- Authentification admin par code TOTP (Google Authenticator/Authy), sessions en base avec expiration
- Rate limiting : strict sur la vérification TOTP et les routes d'écriture publiques (newsletter, votes, suggestions), global sur toute l'API
- En-têtes de sécurité HTTP (Helmet), HSTS + redirection HTTPS forcée en production
- Validation stricte des domaines autorisés pour les contenus intégrés (`embedUrl`)
- CORS restreint à une liste explicite d'origines (`CORS_ORIGIN`, séparées par virgules)
- Votes citoyens anonymes (UUID côté client, jamais liés à IP/email), droit à l'oubli implémenté

Points restants à traiter (moyen/bas, non bloquants) : désabonnement newsletter sans jeton de vérification, absence de double opt-in RGPD, pas de révocation globale des sessions admin, `npm audit`/Dependabot à automatiser, comparaison de jeton non "timing-safe".

## Application mobile (Capacitor)

Le dossier `apps/mobile` enveloppe le site web dans une coquille native Android (iOS à venir, nécessite un Mac). En développement, l'app charge le site via `server.url` dans `capacitor.config.json`, pointé sur l'IP réseau locale de la machine de dev (pas `localhost`, qui désignerait l'appareil lui-même).

```bash
cd apps/mobile
npx cap sync android
npx cap open android   # ouvre Android Studio
```

**Piège Windows connu** : Gradle échoue si le chemin du projet contient des caractères accentués ou des espaces (ex: `Pas de planète B`). Copier le dossier `apps/mobile` vers un chemin neutre (ex: `C:\pdpb-mobile`) avant d'ouvrir Android Studio — une jonction/raccourci ne suffit pas, il faut une vraie copie (`robocopy`).

## Réglages du site

La table `site_settings` (clé/valeur) permet d'activer/désactiver des fonctionnalités depuis `/admin/settings` sans déploiement — actuellement : affichage du bloc d'inscription newsletter (désactivé par défaut tant que l'envoi réel des emails n'est pas configuré avec un service tiers).

## Déploiement

Le pipeline CI (`.github/workflows/ci.yml`) construit et pousse les images vers GitHub Container Registry (GHCR) à chaque merge sur `main`, déploie automatiquement en staging, puis attend une validation manuelle avant la production (via un "environment" GitHub protégé — à configurer dans Settings > Environments).

En production, sur le serveur choisi :

```bash
cp .env.example .env   # avec des secrets de production distincts de ceux du développement local
docker compose -f docker-compose.prod.yml up -d
```

Changer d'hébergeur = changer l'IP cible du déploiement SSH en CI, rien d'autre : tout tourne en conteneurs portables.

Après le premier déploiement, mettre à jour les secrets GitHub `INGEST_TOKEN` et `API_URL` (Settings > Secrets and variables > Actions) avec les vraies valeurs de production, sans quoi les workflows d'ingestion automatisée (`refresh-data.yml`, `refresh-fires.yml`) échoueront.

## Historique de build résolu

`next build` échouait auparavant sur les pages `/404` et `/500` lors des tentatives de mise à jour vers Next.js 15/16 (`<Html> should not be imported outside of pages/_document`). Cause identifiée : l'image Docker `node:20-alpine` (musl libc) était incompatible avec le compilateur natif de Next.js 15+ — pas un problème de code applicatif. Résolu en passant à `node:20-slim` (Debian, glibc) sur `apps/web/Dockerfile` et `docker-compose.yml`. Détails complets dans `KNOWN_ISSUES_build.md`. Le projet tourne maintenant sur Next.js 15.x.

## Licence

Ce projet est distribué sous licence **GNU Affero General Public License v3.0 (AGPL-3.0)** — voir le fichier [`LICENSE`](./LICENSE) à la racine du dépôt pour le texte complet.

Choix motivé par l'esprit transparence/données ouvertes du projet : contrairement à une licence permissive (MIT), l'AGPL garantit que toute personne qui modifie le code et le fait tourner sur un serveur public (site web, API) doit rendre ses propres modifications disponibles aux utilisateurs de ce service — pas seulement en cas de distribution d'un fichier. Ça empêche qu'une version dérivée fermée (associative ou commerciale) s'écarte du principe d'ouverture du projet d'origine.
