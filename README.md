# Pas de planète B

Application de sensibilisation au changement climatique — site web, application mobile et API, construites autour de sources de données officielles.

## Stack technique

- **Web** : Next.js (Turbopack), React 19
- **API** : Node 24, Express 5
- **Base de données** : PostgreSQL/PostGIS
- **Reverse proxy (production)** : Traefik v3, certificats Let's Encrypt automatiques
- **Multilingue** : 8 langues (fr, en, es, it, ru, ja, zh, hi)
- **Conteneurisation** : Docker Compose (dev et production)

## Démarrage local

```bash
cp .env.example .env
docker compose up --build
./db/migrate.sh
```

- Site web : http://localhost:3000
- API : http://localhost:4000/health
- Administration : http://localhost:3000/admin (protégée par code TOTP, voir `apps/web/components/AdminAuthGate.js`)

**Les migrations créent uniquement la structure des tables, pas les données.** Sans lancer les scripts d'ingestion, les pages du site n'auront rien à afficher :

```bash
docker compose exec api npm run ingest:co2
docker compose exec api npm run ingest:deputies
docker compose exec api npm run ingest:an-groups
docker compose exec api npm run ingest:scrutins
docker compose exec api npm run ingest:power-plants
docker compose exec api npm run ingest:species
docker compose exec api npm run ingest:vegetation
docker compose exec api npm run ingest:water
docker compose exec api npm run ingest:electricity
docker compose exec api npm run ingest:species-threatened
docker compose exec api npm run ingest:pollution
docker compose exec api npm run ingest:world-benchmarks
docker compose exec api npm run ingest:fires   # nécessite FIRMS_MAP_KEY dans .env
docker compose exec api node src/scripts/ingest-us-congress.js   # nécessite CONGRESS_GOV_API_KEY dans .env
docker compose exec api node src/ingest/temperatures.js          # long (voir "Maintenance" plus bas)
```

## Structure du dépôt

```
apps/
  api/     API Node/Express (ingestion + service de données)
  web/     Site web Next.js
  mobile/  Application mobile Capacitor (coquille native chargeant le site web en direct)
db/
  migrations/  Migrations SQL, appliquées dans l'ordre numéroté par migrate.sh
docker-compose.yml       usage local
docker-compose.prod.yml  usage production (Traefik, TLS, HSTS)
```

## Architecture de l'API

Organisée en modules par domaine, pas un fichier unique :
- `src/lib/` : utilitaires transverses (`db.js`, `auth.js`, `rateLimits.js`, `slug.js`, `translations.js`, `scopeCodes.js`...)
- `src/routes/` : une route par domaine fonctionnel
- `src/scripts/` : scripts d'ingestion réutilisables en CLI et depuis une route API protégée

Pour ajouter une route, étendre le fichier de domaine concerné dans `src/routes/` plutôt qu'agrandir un fichier central.

## Migrations de base de données

```bash
./db/migrate.sh                          # local
./db/migrate.sh docker-compose.prod.yml  # production
./db/migrate.sh docker-compose.prod.yml --check     # vérifie sans appliquer
./db/migrate.sh docker-compose.prod.yml --baseline  # marque l'existant comme déjà appliqué, sans le rejouer
```

Nouvelle migration : créer `db/migrations/0XX_description.sql` avec le numéro suivant. Le déploiement en production les applique automatiquement.

**Sur Windows sans Git Bash/WSL**, appliquer le SQL directement :
```powershell
Get-Content "db\migrations\0XX_fichier.sql" -Raw | docker compose exec -T postgres psql -U pdpb -d pasdeplaneteb
```

⚠️ Un saut de numérotation (fichier jamais créé) peut passer inaperçu — la fonctionnalité concernée échoue silencieusement. En cas de comportement incohérent entre code et base, comparer `\dt` avec le contenu réel de `db/migrations/`, ou lancer `--check`.

## Conventions front-end à connaître

- **Chargement de données (`GET`)** : passer par le hook partagé `useApiFetch` (`apps/web/lib/useApiFetch.js`), pas des `fetch` dupliqués. Les `POST`/`PUT`/`DELETE` de sauvegarde restent en `fetch` brut dans les gestionnaires d'événements.
- **`CountrySelect`** attend une prop **`preferredLang`** (pas `locale`) — sans elle, les noms de pays restent figés en français.
- **Menus déroulants au-dessus d'une carte Leaflet** : Leaflet utilise des z-index internes allant jusqu'à ~700-1000. Toujours vérifier qu'un menu déroulant superposé (`CountrySelect` avec `raised`, `ScopeMultiSelect`...) a un z-index nettement supérieur (1000+).
- **`toLocaleString()` sans locale explicite** (`value.toLocaleString(undefined, ...)`) produit un résultat différent entre le rendu serveur et le navigateur du visiteur → erreur d'hydratation React. Toujours passer une locale explicite (voir `lib/dateLocale.js`, fonction `localeTag()`).
- **`Math.random()`/mélange aléatoire pendant le rendu initial** (`useState(() => shuffle(...))`) cause la même erreur d'hydratation. Toujours initialiser avec une valeur stable, mélanger seulement après montage (`useEffect`).
- **Jamais de Hook dans un `try/catch`** (`useRouter()` lève une exception plutôt que de renvoyer `null` dans certains contextes) — exposer la donnée via un contexte React alimenté par une source qui ne plante jamais.
- **Jamais lire `window`/`document`/`navigator` pendant le rendu** — décalage d'hydratation garanti. Toujours dans un `useEffect`.
- **CSS Leaflet** non chargé globalement (écoconception) — chaque page avec une carte l'injecte elle-même à la demande (voir `pages/ressources/index.js` pour le patron), et appelle `invalidateSize()` dans un `setTimeout(0)` après création de la carte.

## Fonctionnalité internationale (parlements étrangers)

Schéma générique séparé du schéma français existant (`deputies`, `an_groups`, `scrutins`). Six chambres intégrées : États-Unis (Chambre + Sénat), Espagne (Congreso + Sénat), Italie (Chambre + Sénat).

- Tables génériques avec `country_code` : `parliament_members`, `parliament_groups`, `parliament_votes`, `parliament_member_votes`, `parliament_citizen_votes`, `parliament_member_follows`.
- Routes génériques (`/api/parliament/:country/...`) — un seul jeu de routes pour tous les pays.
- Ajouter un pays : le schéma/routes/pages sont déjà génériques, seul un script d'ingestion est à écrire.
- Libellés de chambre centralisés dans `lib/parliamentChamberLabels.js` — jamais codés en dur dans une page.

## Kit de communication (PDF + page web)

Génère à la demande une fiche PDF de 2 pages par pays (climat + ressources/biodiversité), toujours recalculée avec les données actuelles — jamais un fichier figé.

- `apps/api/src/lib/kitTemplate.js` : gabarit HTML partagé, rendu à la fois en PDF (Playwright/Chromium headless) et en page web (`/kit-communication/[code]`, dans une iframe isolée pour éviter toute collision de style).
- `apps/api/src/lib/kitLabels*.js` : libellés du document dans les 8 langues.
- Génération d'image de prévisualisation (`og-image`) pour un aperçu correct au partage sur les réseaux sociaux.
- **Chromium sur Alpine** : le binaire embarqué par défaut dans `playwright` ne fonctionne pas (glibc vs musl) — utiliser `playwright-core` pointé vers le Chromium installé via `apk` (voir `Dockerfile` de l'API, variable `CHROMIUM_PATH`).

## Portée géographique des contenus proposés (pétitions, ressources, debunk, relais scientifique, idées enfants)

Chaque contenu proposé par un visiteur peut être associé à un ou plusieurs pays, continents, ou "International/Monde".

- Colonne `scope_codes TEXT[]` sur les 6 tables concernées (`db/migrations/046_scope_codes.sql`) — codes ISO 3166-1 alpha-3 pour un pays, ou l'un des 8 codes fixes définis dans `apps/api/src/lib/scopeCodes.js` / `apps/web/lib/scopes.js` (à garder synchronisés).
- Composant partagé `ScopeMultiSelect` (formulaires + filtres) et `ScopeBadges` (affichage des drapeaux).
- Filtrage via `?scopes=FRA,EUR` sur les routes de liste publiques (opérateur `&&` PostgreSQL sur tableau, index GIN).
- Debunk et Relais scientifique n'avaient auparavant aucune soumission publique — `submission_notes` garde le contexte brut fourni par le visiteur séparé du contenu éditorial vérifié (jamais affiché publiquement tant que non relu).

## Traduction automatique du contenu admin

Contenu éditorial traduisible via l'API Google Cloud Translation (`GOOGLE_TRANSLATE_API_KEY`). Route `POST /api/admin/translate`, paramètre `format` (`"text"` ou `"html"` pour les pages légales).

Le contenu reste rédigé en français dans les tables habituelles ; une table générique `content_translations` stocke les variantes dans les 7 autres langues. Pour ajouter ce mécanisme à un nouveau type de contenu : déclarer ses champs dans `TRANSLATABLE_FIELDS` (`lib/translations.js`), fusionner dans la route de lecture publique, ajouter `<ContentTranslationsEditor>` à la page d'édition admin.

## Écoconception / performance

- Liens de navigation persistante : `<Link prefetch={false}>`.
- CSS de dépendances tierces (Leaflet...) : jamais d'import global, injection dynamique au moment du besoin.
- Le chargement différé (`next/dynamic`) d'un composant systématiquement affiché n'apporte pas de gain réel et peut même dégrader le score Performance (décalage de mise en page, requête supplémentaire mal placée) — utile seulement pour du contenu réellement conditionnel.
- Mesurer via [ecoindex.fr](https://www.ecoindex.fr) et [PageSpeed Insights](https://pagespeed.web.dev).

## Sécurité

- Authentification admin par code TOTP, sessions en base avec expiration
- `/admin` non indexable (`robots.txt` + meta `noindex`)
- Rate limiting strict sur la vérification TOTP et les routes d'écriture publiques
- En-têtes de sécurité (Helmet), HSTS + HTTPS forcé en production
- CORS restreint à une liste explicite d'origines
- Votes citoyens anonymes (UUID côté client), droit à l'oubli implémenté
- Formulaires publics protégés par piège à robots (champ caché) + limite de fréquence

Points connus non bloquants : désabonnement newsletter sans jeton de vérification, pas de double opt-in RGPD newsletter, pas de révocation globale des sessions admin, comparaison de jeton non "timing-safe".

## RGPD / vie privée

Politique de confidentialité éditable par langue depuis `/admin/settings`. Aucun cookie de suivi ni outil de mesure d'audience (hors Matomo auto-hébergé, cookieless).

## Application mobile (Capacitor)

```bash
cd apps/mobile
npx cap sync android
npx cap open android
```

**Piège Windows connu** : Gradle échoue si le chemin du projet contient des caractères accentués ou des espaces — copier `apps/mobile` vers un chemin neutre avant d'ouvrir Android Studio. À revalider sur un vrai appareil, pas testé depuis plusieurs montées de version majeures du projet.

## Multilingue

`apps/web/lib/i18n/*.json`, via `useT()`. Toutes les chaînes d'interface passent par `t("section.cle")`.

- Les données venant directement de la base (types de combustible, groupes d'espèces, noms de pays, libellés de chambre) ne passent pas par `useT()` — elles ont leurs propres fonctions de traduction (`lib/fuelTypes.js`, `lib/speciesGroups.js`, `lib/countryNames.js`, `lib/parliamentChamberLabels.js`).
- Formatage dates/nombres : toujours `localeTag(locale)` (`lib/dateLocale.js`), jamais une locale codée en dur.
- Qualité des traductions : espagnol/italien fiables ; russe/japonais/chinois/hindi à faire relire par un locuteur natif sur le vocabulaire spécifique avant large diffusion.

## Suivi personnalisé (par email)

Depuis la fiche d'un élu (France ou international), inscription pour recevoir un email à chaque nouveau vote — double opt-in RGPD. Envoi via `apps/api/src/emailSender.js` (Brevo si `BREVO_API_KEY` renseignée, sinon log console).

## Transparence des données (`/etat-des-donnees`)

Page publique listant chaque source ingérée, sa fraîcheur, sa fréquence de mise à jour. Alimentée par `GET /api/meta/last-updated` — à étendre à chaque nouvelle source (voir `pages/etat-des-donnees.js`, tableau `SOURCE_KEYS`).

## Maintenance récurrente (manuelle)

Deux sources bloquent les requêtes venant d'IP de datacenter (VPS et GitHub Actions) — à relancer manuellement depuis une connexion résidentielle, une fois par mois :

```powershell
.\refresh-spain-senate-prod.ps1   # senado.es (Sénat espagnol)
.\refresh-italy-senate-prod.ps1   # dati.senato.it (Sénat italien)
```

Prérequis pour les deux : conteneur API local actif (`docker compose up`), clé SSH dédiée `~/.ssh/pdpb_auto` (sans phrase secrète — une phrase secrète bloque le script silencieusement sous PowerShell).

**Ingestion des températures** (`apps/api/src/ingest/temperatures.js`) : couvre 1950 à aujourd'hui, cadencée pour respecter le quota Open-Meteo, peut prendre plusieurs heures pour l'ensemble des pays. Reprise automatique si interrompue (pays déjà complets ignorés). Cibler un seul pays : `TEMPERATURES_COUNTRY_CODE=FRA`. **Point de vigilance** : Open-Meteo peut bloquer silencieusement une IP après un usage cumulé important (aucune erreur explicite, la requête reste simplement sans réponse) — vérifier depuis un navigateur personnel si le blocage est confirmé côté VPS avant de conclure à un bug côté code.

## Déploiement

Pipeline CI (`.github/workflows/ci.yml`) à chaque push sur `main` : lint + tests, build, push des images, déploiement SSH automatique (migrations incluses).

Rafraîchissement des données (`.github/workflows/refresh-data.yml`) : mensuel pour la plupart des sources, toutes les 6h pour les incendies.

Secrets GitHub requis : `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_SSH_KEY`, `API_URL`, `INGEST_TOKEN`, `PRODUCTION_URL`.

Premier déploiement manuel :
```bash
git clone <url-ssh-du-depot>
cd pas-de-planete-b
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d
./db/migrate.sh docker-compose.prod.yml
```

**Les variables `NEXT_PUBLIC_*` sont figées au moment du build**, pas lues au runtime — reçues via `ARG` de build dans le `Dockerfile`.

## Notes Windows / PowerShell

- **Chemins avec crochets** (`pages/pays/[code].js`) : utiliser `-LiteralPath` avec `Get-Content`/`Select-String`.
- **`curl` sous PowerShell** est un alias vers `Invoke-WebRequest` (syntaxe différente) — utiliser `curl.exe` pour la syntaxe Unix classique.
- **Redirection `<`** non supportée — utiliser `Get-Content fichier | commande`.
- **Fins de ligne CRLF** : un script qui compare une chaîne multi-lignes construite avec `\n` peut échouer silencieusement sur ce dépôt. Normaliser ou utiliser une ancre courte (`indexOf`) plutôt qu'un bloc exact.

## Licence

**GNU Affero General Public License v3.0 (AGPL-3.0)** — voir [`LICENSE`](./LICENSE). Choix motivé par l'esprit transparence/données ouvertes : contrairement à une licence permissive, l'AGPL garantit que toute personne qui modifie le code et le fait tourner sur un serveur public doit rendre ses modifications disponibles aux utilisateurs de ce service.
