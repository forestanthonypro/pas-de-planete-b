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
KNOWN_ISSUES_build.md    historique du bug de build Next.js, résolu (voir plus bas)
```

## Architecture de l'API

L'API (`apps/api`) est organisée en modules par domaine plutôt qu'un fichier unique :
- `src/lib/` : utilitaires transverses (`db.js`, `auth.js`, `rateLimits.js`, `slug.js`, `embedValidation.js`, `validators.js`, `translations.js`, `errors.js`)
- `src/routes/` : une route par domaine fonctionnel (`auth.js`, `environmentalData.js`, `parliamentary.js`, `citizenVotes.js`, `newsletter.js`, `deputyFollows.js`, `contentTranslations.js`, `debunk.js`, `interviews.js`, `paysans.js`, `resources.js`, `charter.js`, `futureIdeas.js`, `settings.js`)

Basé sur **Express 5**. Pour ajouter une nouvelle route, créer/étendre le fichier de domaine concerné dans `src/routes/` plutôt que d'agrandir un fichier central.

## Migrations de base de données

Les fichiers `db/migrations/*.sql` sont numérotés et appliqués dans l'ordre par `db/migrate.sh`, qui garde la trace de ce qui a déjà été appliqué (table `_migrations`) — plus besoin de les rejouer un par un à la main.

```bash
./db/migrate.sh                          # local (docker-compose.yml)
./db/migrate.sh docker-compose.prod.yml  # production
```

Sur une base où les migrations existantes ont déjà été appliquées manuellement (ex: avant que ce script existe), poser une base de référence sans rejouer les fichiers :

```bash
./db/migrate.sh docker-compose.prod.yml --baseline
```

Pour ajouter une nouvelle migration : créer un fichier `db/migrations/0XX_description.sql` avec le numéro suivant, puis relancer `./db/migrate.sh` (local) ou l'inclure dans le déploiement pour qu'elle s'applique en production.

## Récupération de données côté client (`useApiFetch`)

Les pages du site web utilisent un hook partagé plutôt que de dupliquer le pattern `fetch` + `loading`/`error`/`data` :

```javascript
const { data, loading, error } = useApiFetch("/api/mon-endpoint", {
  transform: (rows) => (Array.isArray(rows) ? rows : []), // optionnel
  errorMessage: t("ma_section.erreur"),                    // optionnel
  headers: { Authorization: `Bearer ${sessionToken}` },     // optionnel, pages admin
  deps: [autreDependance],                                  // optionnel, en plus du chemin
});
```

Passer `null` comme chemin désactive le fetch (utile tant qu'une dépendance requise, ex. `router.query`, n'est pas encore disponible). Convention du projet : **les GET de chargement passent par `useApiFetch`** ; **les POST/PUT/DELETE de sauvegarde restent en `fetch` brut** dans les gestionnaires d'événements (pas d'abstraction pour les mutations). Le hook lui-même est dans `apps/web/lib/useApiFetch.js`.

Point de vigilance récurrent : si une valeur dérivée d'un `data` potentiellement `null` (ex. `const x = data ?? []`) est elle-même utilisée comme dépendance d'un `useMemo`/`useEffect`, l'envelopper dans son propre `useMemo(() => data ?? [], [data])` — sinon un nouveau tableau est recréé à chaque rendu tant que la donnée n'est pas chargée, ce qui invalide inutilement les hooks qui en dépendent (bug rencontré et corrigé à plusieurs reprises lors de la conversion de ~27 pages vers ce hook, cf. historique de commits).

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

## Multilingue

Le site est disponible en 8 langues : français (source), anglais, espagnol, italien, russe, japonais, chinois, hindi (`apps/web/lib/i18n/*.json`, via le hook `useT()`). Toutes les chaînes d'interface passent par `t("section.cle")` — jamais de texte français codé en dur dans les composants.

**Points d'attention récurrents**, déjà rencontrés plusieurs fois et à vérifier systématiquement pour tout nouveau texte affiché :
- La langue active doit toujours venir de `router.locale` (via `useT()`), jamais de l'ancien mécanisme `detectPreferredLanguage()` (détection navigateur, jamais connecté au sélecteur de langue) — supprimé partout, mais rester vigilant en cas de copier-coller de code ancien.
- Les données provenant directement de la base (types de combustible, groupes d'espèces, noms de pays) ne passent pas par `useT()` — elles ont leurs propres fonctions de traduction (`lib/fuelTypes.js`, `lib/speciesGroups.js`, `lib/countryNames.js`) qui doivent couvrir les 8 langues, pas seulement fr/en.
- Le formatage des dates/nombres (`toLocaleDateString`, `toLocaleString`) doit utiliser `localeTag(locale)` (`lib/dateLocale.js`), jamais `"fr-FR"` codé en dur.

Qualité des traductions : espagnol/italien avec un bon niveau de confiance (langues romanes proches du français) ; russe/japonais/chinois/hindi générées avec plus d'incertitude sur le vocabulaire civique/institutionnel spécifique — une relecture par un locuteur natif est recommandée avant une large diffusion, en particulier sur les pages légales.

### Contenu géré en admin (traductions par langue)

Le contenu éditorial (débunk, relais scientifique, "on devient tous paysans", ressources, charte éthique, idées enfants) reste rédigé en français dans les tables habituelles, avec une table générique `content_translations` (clé : type de contenu + identifiant + nom du champ + langue) qui stocke les variantes dans les 7 autres langues, en overlay. Le composant admin réutilisable `ContentTranslationsEditor` (`apps/web/components/ContentTranslationsEditor.js`) gère l'édition ; chaque page d'édition admin l'intègre pour ses champs traduisibles spécifiques. Les routes publiques (`GET /api/xxx?locale=...`) fusionnent automatiquement la traduction disponible, avec repli silencieux sur le français si absente.

Pour ajouter ce mécanisme à un nouveau type de contenu : déclarer ses champs traduisibles dans `TRANSLATABLE_FIELDS` (apps/api/src/index.js), merger les traductions dans la/les route(s) de lecture publique, puis ajouter `<ContentTranslationsEditor>` à la page d'édition admin correspondante.

Les pages légales (mentions légales, confidentialité) suivent un principe similaire mais plus simple : une clé par langue directement dans `site_settings` (`mentions_legales_content_en`, etc.), éditable depuis `/admin/settings` avec un petit éditeur WYSIWYG.

## Réglages du site

La table `site_settings` (clé/valeur) permet d'activer/désactiver des fonctionnalités depuis `/admin/settings` sans déploiement :
- Affichage du bloc d'inscription newsletter (désactivé par défaut tant que l'envoi réel des emails n'est pas configuré avec un service tiers — voir section suivante)
- Contenu des pages légales, par langue (voir section Multilingue ci-dessus)

## Suivi personnalisé des députés (par email)

Depuis la fiche d'un député, possibilité de s'inscrire pour recevoir un email à chaque nouveau vote enregistré (`deputy_follows`, double opt-in RGPD — l'inscription envoie un email de confirmation, rien n'est actif avant confirmation). L'envoi effectif passe par `apps/api/src/emailSender.js`, qui utilise l'API Brevo si `BREVO_API_KEY` est renseignée dans `.env`, et se contente de logger le contenu dans la console sinon (permet de développer/tester sans compte Brevo). Les digests sont envoyés via une route protégée par jeton d'ingestion (`POST /api/admin/deputy-follows/send-digests`), déclenchée quotidiennement par le workflow GitHub `send-deputy-digests.yml`.

## Transparence des données (`/etat-des-donnees`)

Page publique listant chaque source de données ingérée automatiquement, sa fraîcheur (code couleur : vert < 14 jours, orange < 60 jours, rouge au-delà), et un lien vers la page du site qui l'utilise. Alimentée par `GET /api/meta/last-updated`, à étendre à chaque nouvelle source de données ajoutée au site.

## Hébergement

VPS avec accès SSH root complet et Docker/Docker Compose installés — compatible tel quel avec `docker-compose.prod.yml`, aucune adaptation de code nécessaire. Changer d'hébergeur ne demande de modifier que l'IP cible du déploiement SSH en CI, tout tourne en conteneurs portables.

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

`next build` échouait auparavant sur les pages `/404`/`/500` (`<Html> should not be imported outside of pages/_document`). Cause réelle : `NODE_ENV` restait sur `development` (hérité de `.env`, légitime pour `npm run dev`) au moment d'exécuter `next build`, ce que Next.js signale comme risquant de créer des incohérences — dans ce projet, ça suffisait à casser le pipeline interne de rendu de `_document`. Résolu en forçant `NODE_ENV=production` explicitement dans le script `build` (`apps/web/package.json`), indépendamment du contenu de `.env`. Projet à jour sur **Next.js 16.3.0 (Turbopack)**, **React 19.2.8** et **Node 24**. Détails complets et chronologie de l'investigation dans `KNOWN_ISSUES_build.md`.

## Licence

Ce projet est distribué sous licence **GNU Affero General Public License v3.0 (AGPL-3.0)** — voir le fichier [`LICENSE`](./LICENSE) à la racine du dépôt pour le texte complet.

Choix motivé par l'esprit transparence/données ouvertes du projet : contrairement à une licence permissive (MIT), l'AGPL garantit que toute personne qui modifie le code et le fait tourner sur un serveur public (site web, API) doit rendre ses propres modifications disponibles aux utilisateurs de ce service — pas seulement en cas de distribution d'un fichier. Ça empêche qu'une version dérivée fermée (associative ou commerciale) s'écarte du principe d'ouverture du projet d'origine.

