# Pas de planète B

Application de sensibilisation au changement climatique — site web, application mobile et API, construites autour de sources de données officielles.

## Stack technique

- **Web** : Next.js 16.3.0 (Turbopack), React 19.2.8
- **API** : Node 24, Express 5
- **Base de données** : PostgreSQL/PostGIS 16-3.4
- **Reverse proxy (production)** : Traefik v3.7, certificats Let's Encrypt automatiques
- **Qualité de code** : ESLint 9.39.5, `eslint-config-next` 16.3.0
- **Multilingue** : 8 langues (français, anglais, espagnol, italien, russe, japonais, chinois, hindi)
- **Conteneurisation** : Docker Compose (dev et production)

## Démarrage local

```bash
cp .env.example .env
docker compose up --build
./db/migrate.sh
```

- Site web : http://localhost:3000
- API : http://localhost:4000/health
- Base de données PostGIS : localhost:5432
- Administration éditoriale : http://localhost:3000/admin (protégée par code TOTP, voir `apps/web/components/AdminAuthGate.js`)

**Les migrations créent uniquement la structure des tables, pas les données.** Sans lancer les scripts d'ingestion, les pages du site n'auront rien à afficher (graphiques vides, listes vides) — pas un bug, juste une base neuve sans contenu :

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
```

## Structure du dépôt

```
apps/
  api/     API Node/Express (ingestion + service de données)
  web/     Site web Next.js
  mobile/  Application mobile Capacitor (coquille native Android/iOS
           chargeant le site web en direct — voir capacitor.config.json)
db/
  migrations/  Migrations SQL PostgreSQL, appliquées dans l'ordre numéroté
  migrate.sh   Script d'application des migrations (voir section dédiée)
docker-compose.yml       usage local (build à chaud, hot-reload)
docker-compose.prod.yml  usage production (images pré-construites, Traefik, TLS, HSTS)
KNOWN_ISSUES_build.md    référence technique sur un bug de build Next.js déjà résolu
```

## Architecture de l'API

L'API (`apps/api`) est organisée en modules par domaine plutôt qu'un fichier unique :
- `src/lib/` : utilitaires transverses (`db.js`, `auth.js`, `rateLimits.js`, `slug.js`, `embedValidation.js`, `validators.js`, `translations.js`, `errors.js`, `sanitizeHtml.js`)
- `src/routes/` : une route par domaine fonctionnel (`auth.js`, `environmentalData.js`, `parliamentary.js`, `parliamentGeneric.js`, `parliamentCitizenVotes.js`, `parliamentMemberFollows.js`, `citizenVotes.js`, `newsletter.js`, `deputyFollows.js`, `contentTranslations.js`, `translate.js`, `debunk.js`, `interviews.js`, `paysans.js`, `resources.js`, `charter.js`, `futureIdeas.js`, `settings.js`, `petitions.js`)
- `src/scripts/` : scripts d'ingestion réutilisables à la fois en CLI (`node src/scripts/xxx.js`) et importés depuis une route API protégée (voir `ingest-us-congress.js` pour le patron à suivre)

Pour ajouter une nouvelle route, créer/étendre le fichier de domaine concerné dans `src/routes/` plutôt que d'agrandir un fichier central.

## Migrations de base de données

Les fichiers `db/migrations/*.sql` sont numérotés et appliqués dans l'ordre par `db/migrate.sh`, qui garde la trace de ce qui a déjà été appliqué (table `_migrations`) — plus besoin de les rejouer un par un à la main.

```bash
./db/migrate.sh                          # local (docker-compose.yml)
./db/migrate.sh docker-compose.prod.yml  # production
```

Sur une base où des migrations ont déjà été appliquées manuellement (sans passer par ce script), poser une base de référence sans les rejouer :

```bash
./db/migrate.sh docker-compose.prod.yml --baseline
```

Pour ajouter une nouvelle migration : créer un fichier `db/migrations/0XX_description.sql` avec le numéro suivant. Le déploiement en production applique automatiquement les migrations manquantes.

**Sur Windows sans Git Bash/WSL**, `migrate.sh` n'est pas directement exécutable — appliquer le contenu SQL directement :
```powershell
Get-Content "db\migrations\0XX_fichier.sql" -Raw | docker compose exec -T postgres psql -U pdpb -d pasdeplaneteb
```

**⚠️ Point de vigilance appris à la dure (session du 8 août 2026)** : un saut de numérotation dans `db/migrations/` (ex. `034` → `036`, fichier `035` jamais créé) peut passer inaperçu pendant des semaines — la fonctionnalité concernée échoue silencieusement (erreurs 500 en arrière-plan, sans que l'interface ne le signale). Si un comportement semble incohérent entre le code et la base, vérifier en premier lieu la liste des migrations avec `\dt` et comparer au contenu réel de `db/migrations/`.

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

**Point de vigilance** : si une valeur dérivée d'un `data` potentiellement `null` (ex. `const x = data ?? []`) est elle-même utilisée comme dépendance d'un `useMemo`/`useEffect`, l'envelopper dans son propre `useMemo(() => data ?? [], [data])` — sinon un nouveau tableau est recréé à chaque rendu tant que la donnée n'est pas chargée, ce qui invalide inutilement les hooks qui en dépendent.

**Autre piège récurrent (graphiques Chart.js)** : le `useEffect` qui dessine un graphique doit inclure `locale` dans son tableau de dépendances dès qu'il utilise `t()` pour ses libellés — sinon la légende ne se met pas à jour au changement de langue du site (repéré et corrigé sur 6 pages le 9 août 2026).

## Sélecteur de pays (`CountrySelect` / `useCountrySelector`)

Le composant `apps/web/components/CountrySelect.js` attend une prop **`preferredLang`** (pas `locale`) pour traduire les noms de pays via `lib/countryNames.js` — un piège facile (le nom de prop semble interchangeable avec `locale` mais ne l'est pas ; sans `preferredLang`, les noms de pays restent figés en français quelle que soit la langue du site). Toujours passer `preferredLang={locale}` explicitement.

Le hook `apps/web/lib/useCountrySelector.js` centralise le motif répété sur les pages avec un sélecteur de pays simple (état + détection automatique du pays par défaut + chargement de la liste) :

```javascript
const { countryCode, setCountryCode, countries, selectedCountryName } = useCountrySelector("/api/co2/countries", { locale });
```

`apps/web/lib/useCountriesList.js` isole juste le chargement de la liste, pour les pages où le pays vient d'ailleurs qu'un état local (ex. `pays/[code].js`, où il vient de l'URL).

**Cartes Leaflet + sélecteur de pays adjacent** : le menu déroulant de `CountrySelect` passe par défaut derrière une carte Leaflet (dont les tuiles/contrôles montent à un z-index de 700-1000). Passer le prop `raised` à `CountrySelect` pour élever son menu au-dessus (z-index 1100, volontairement au-dessus des contrôles Leaflet à 1000).

## Fonctionnalité internationale (parlements étrangers)

Depuis le 8 août 2026, le site couvre aussi les parlements d'autres pays (États-Unis en premier), via un schéma générique **séparé** du schéma français existant (`deputies`, `an_groups`, `scrutins`... jamais touchés) :

- **Tables** (`db/migrations/040_parliament_generic.sql`, `041_parliament_member_follows_optin.sql`) : `parliament_members`, `parliament_groups`, `parliament_votes`, `parliament_member_votes`, `parliament_citizen_votes`, `parliament_member_follows`, toutes avec une colonne `country_code`.
- **Routes API génériques** (`routes/parliamentGeneric.js`, `parliamentCitizenVotes.js`, `parliamentMemberFollows.js`) : `/api/parliament/:country/members`, `/groups`, `/votes`, `/votes/:id`, `/votes/search`, `/votes/stats`, plus le vote citoyen et le suivi par email — un seul jeu de routes pour tous les pays.
- **Pages** (`pages/international/`) : sélecteur de pays, hub par pays (4 cartes : élus/groupes/scrutins/mes votes), listes, fiches détail, vote citoyen, suivi par email.
- **Ingestion** : spécifique à chaque pays (voir `src/scripts/ingest-us-congress.js` pour les États-Unis — sources : Congress.gov pour les membres et les votes de la Chambre, GovTrack pour les votes du Sénat, Congress.gov ne les exposant pas). Chaque script d'ingestion pays exporte une fonction réutilisable (appelée par une route API protégée pour le rafraîchissement mensuel programmé) tout en restant utilisable en CLI pour les tests.
- **Ajouter un nouveau pays** (Italie/Espagne notamment, sources déjà identifiées — voir `TODO.md`) : le schéma, les routes et les pages sont déjà génériques, seul un nouveau script d'ingestion est à écrire.

Les libellés de chambre (« Chambre des représentants »/« Sénat » pour les États-Unis, génériques « chambre basse »/« chambre haute » sinon) sont centralisés dans `apps/web/lib/parliamentChamberLabels.js` — ne jamais coder en dur `t("international.chamber_lower")` directement dans une page, toujours passer par `chamberLabelKey(country, chamber)`.

## Traduction automatique du contenu admin

Le contenu éditorial (débunk, interviews, paysans, ressources, charte, idées enfants, pétitions, pages légales) peut être traduit automatiquement depuis l'admin via l'API Google Cloud Translation (`GOOGLE_TRANSLATE_API_KEY` dans `.env`, clé restreinte à cette seule API dans Google Cloud Console). Route `POST /api/admin/translate` (`routes/translate.js`), avec un paramètre `format` (`"text"` par défaut, `"html"` pour le contenu réellement HTML comme les pages légales — ne jamais mettre `"html"` sur un champ texte simple, Google renverrait des entités HTML non décodées).

Le HTML collé dans l'éditeur WYSIWYG (`SimpleWysiwygEditor.js`) est nettoyé à la saisie (retrait des styles en ligne, balises non sémantiques) et une seconde fois côté serveur avant enregistrement (`lib/sanitizeHtml.js`) — filet de sécurité en plus du nettoyage client, pas une dépendance lourde type DOMPurify.

## Hooks React : ne jamais envelopper un Hook dans un `try/catch`

`useRouter()` (et d'autres Hooks Next.js) lèvent une exception plutôt que de renvoyer `null` quand le contexte nécessaire est absent (ex: pendant la génération statique d'une page qui n'a pas de contexte routeur complet). Le réflexe d'envelopper l'appel dans un `try/catch` est **incorrect** : ça viole les Rules of Hooks de React (un Hook doit être appelé de façon strictement identique à chaque rendu) et peut provoquer des décalages d'hydratation serveur/client difficiles à diagnostiquer (l'erreur affichée ne pointe généralement pas vers la vraie cause).

La bonne approche : exposer la donnée nécessaire via un contexte React alimenté depuis une source qui ne lève jamais d'exception (ex: `lib/LocaleContext.js`, alimenté par la prop `router` de `_app.js`, jamais par le Hook `useRouter()` directement), puis consommer ce contexte via `useContext()` — qui retombe silencieusement sur une valeur par défaut en l'absence de Provider, sans jamais planter.

De la même façon, ne jamais lire `window`/`document`/`navigator` **pendant le rendu** d'un composant — ça produit un HTML différent entre le serveur (pas de `window`) et le client, donc un décalage d'hydratation. Toujours partir d'une valeur par défaut identique des deux côtés, et ne lire l'API navigateur que dans un `useEffect` (voir `components/ShareButtons.js` pour un exemple).

## Cartes Leaflet

Le CSS de Leaflet n'est **pas** chargé globalement (retiré de `_app.js` pour l'écoconception) — chaque page qui affiche une carte doit l'injecter elle-même à la demande, une seule fois :

```javascript
if (!document.getElementById("leaflet-css")) {
  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "/vendor/leaflet.css";
  document.head.appendChild(link);
}
```

Sans ce CSS, la carte s'affiche visuellement cassée (tuiles débordant sur toute la page, sans le positionnement contrôlé par Leaflet) — bug rencontré et corrigé sur plusieurs pages (`energie.js`, `incendies.js`, `pays/[code].js`) faute de cet oubli.

Après la création de la carte (`L.map(...)`) et le `fitBounds`/`setView`, toujours appeler `invalidateSize()` dans un `setTimeout(0)` — sans ça, Leaflet peut calculer sa grille de tuiles avant que le conteneur ait sa taille finale (mise en page pas encore stabilisée), et le rendu reste figé, aléatoirement correct ou cassé selon le moment exact du montage.

## Écoconception / performance : conventions à respecter

- **Liens de navigation persistante** (`Layout.js`, page d'accueil) : toujours `<Link prefetch={false}>`.
- **CSS de dépendances tierces** (ex: `leaflet/dist/leaflet.css`) : jamais d'import global dans `_app.js` — copier dans `public/vendor/` (auto-hébergé) et injecter dynamiquement au moment précis où le composant qui en a besoin s'affiche.
- **`browserslist`** dans `apps/web/package.json` : cible des navigateurs modernes pour éviter la transpilation inutile.
- **`<title>`/meta description** : définis par défaut dans `_app.js` (`DefaultHead`).

Mesure régulièrement via [ecoindex.fr](https://www.ecoindex.fr) et [PageSpeed Insights](https://pagespeed.web.dev).

## Sécurité

- Authentification admin par code TOTP, sessions en base avec expiration
- Page `/admin` bloquée à l'indexation/crawl (`robots.txt` + `<meta name="robots" content="noindex, nofollow">`) — un formulaire de connexion sans contexte visuel clair peut être classé "page trompeuse" par Google Safe Browsing, comme rencontré le 8 août 2026
- Rate limiting : strict sur la vérification TOTP (5 tentatives/15 min) et les routes d'écriture publiques, global sur toute l'API
- En-têtes de sécurité HTTP (Helmet), HSTS + redirection HTTPS forcée en production
- CORS restreint à une liste explicite d'origines (`CORS_ORIGIN`)
- Votes citoyens anonymes (UUID côté client, jamais liés à IP/email), droit à l'oubli implémenté

Points connus restants (moyen/bas, non bloquants — voir `TODO.md`) : désabonnement newsletter sans jeton de vérification, absence de double opt-in RGPD sur la newsletter, pas de révocation globale des sessions admin, `npm audit`/Dependabot à automatiser, comparaison de jeton non "timing-safe".

## RGPD / vie privée

Politique de confidentialité complète sur `/confidentialite`, éditable par langue depuis `/admin/settings`. Le site ne pose aucun cookie de suivi ni outil de mesure d'audience à ce jour (hors Matomo auto-hébergé, cookieless).

## Application mobile (Capacitor)

Le dossier `apps/mobile` enveloppe le site web dans une coquille native Android (iOS à venir, nécessite un Mac).

```bash
cd apps/mobile
npx cap sync android
npx cap open android
```

**Piège Windows connu** : Gradle échoue si le chemin du projet contient des caractères accentués ou des espaces. Copier `apps/mobile` vers un chemin neutre avant d'ouvrir Android Studio.

## Multilingue

Le site est disponible en 8 langues (`apps/web/lib/i18n/*.json`, via `useT()`). Toutes les chaînes d'interface passent par `t("section.cle")` — jamais de texte français codé en dur.

**Points d'attention pour tout nouveau texte affiché** :
- La langue active vient toujours de `router.locale` (via `useT()`)
- Les données provenant directement de la base (types de combustible, groupes d'espèces, noms de pays, libellés de chambre parlementaire) ne passent pas par `useT()` — elles ont leurs propres fonctions de traduction (`lib/fuelTypes.js`, `lib/speciesGroups.js`, `lib/countryNames.js`, `lib/parliamentChamberLabels.js`) qui doivent couvrir les 8 langues
- Le formatage des dates/nombres doit utiliser `localeTag(locale)` (`lib/dateLocale.js`), jamais `"fr-FR"` codé en dur

Qualité des traductions : espagnol/italien avec un bon niveau de confiance ; russe/japonais/chinois/hindi générées avec plus d'incertitude sur le vocabulaire civique/institutionnel spécifique — une relecture par un locuteur natif est recommandée avant une large diffusion.

### Contenu géré en admin (traductions par langue)

Le contenu éditorial reste rédigé en français dans les tables habituelles, avec une table générique `content_translations` (type de contenu + identifiant + nom du champ + langue) qui stocke les variantes dans les 7 autres langues, en overlay. Le composant admin `ContentTranslationsEditor` gère l'édition, avec traduction automatique disponible (voir section dédiée plus haut). Les routes publiques fusionnent automatiquement la traduction disponible, avec repli silencieux sur le français si absente.

Pour ajouter ce mécanisme à un nouveau type de contenu : déclarer ses champs traduisibles dans `TRANSLATABLE_FIELDS` (`apps/api/src/lib/translations.js`), merger les traductions dans la/les route(s) de lecture publique, puis ajouter `<ContentTranslationsEditor>` à la page d'édition admin.

Les pages légales suivent un principe similaire mais plus simple : une clé par langue directement dans `site_settings`, éditable depuis `/admin/settings`.

## Réglages du site

La table `site_settings` (clé/valeur) permet d'activer/désactiver des fonctionnalités depuis `/admin/settings` sans déploiement.

## Suivi personnalisé (par email)

Depuis la fiche d'un député (France) ou d'un élu étranger (`deputy_follows` / `parliament_member_follows`), possibilité de s'inscrire pour recevoir un email à chaque nouveau vote enregistré — double opt-in RGPD dans les deux cas. L'envoi passe par `apps/api/src/emailSender.js` (API Brevo si `BREVO_API_KEY` renseignée, sinon log console). Digests envoyés via des routes protégées par jeton d'ingestion, déclenchées par des workflows GitHub programmés.

## Transparence des données (`/etat-des-donnees`)

Page publique listant chaque source de données ingérée automatiquement, sa fraîcheur, sa fréquence de mise à jour programmée, et un lien vers la page du site qui l'utilise. Alimentée par `GET /api/meta/last-updated` — à étendre à chaque nouvelle source de données ajoutée au site (voir `pages/etat-des-donnees.js`, tableau `SOURCE_KEYS`).

## Hébergement

VPS avec accès SSH root complet et Docker/Docker Compose installés — compatible tel quel avec `docker-compose.prod.yml`.

## Déploiement

Le pipeline CI (`.github/workflows/ci.yml`), à chaque push sur `main` : lint + tests, build et push des images, puis déploiement automatique en production par SSH (`git pull` + `docker compose pull && up -d` + application des migrations manquantes + nettoyage des anciennes images).

Le rafraîchissement des données (`.github/workflows/refresh-data.yml`) tourne mensuellement pour la plupart des sources (le 1er du mois), toutes les 6h pour les incendies (`refresh-fires.yml`, quasi temps réel) — voir `/etat-des-donnees` pour le détail par source.

Secrets GitHub requis : `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_SSH_KEY`, `API_URL`, `INGEST_TOKEN`. Variable `PRODUCTION_URL` pour le job de mesure d'impact environnemental.

Pour un premier déploiement manuel sur un nouveau serveur :

```bash
git clone <url-ssh-du-depot>
cd pas-de-planete-b
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d
./db/migrate.sh docker-compose.prod.yml
```

**Note technique importante** : les variables `NEXT_PUBLIC_*` sont figées dans le JavaScript au moment du build (`next build`), pas lues au runtime du conteneur — reçues via `ARG` de build dans le `Dockerfile`, transmis par `ci.yml`.

## Notes Windows / PowerShell

Points récurrents rencontrés en développant depuis Windows, à garder en tête pour gagner du temps :

- **Chemins de fichiers avec crochets** (ex. `pages/pays/[code].js`) : PowerShell interprète `[...]` comme une classe de caractères par défaut dans `Get-Content`/`Select-String`/etc. — toujours utiliser `-LiteralPath` (ou `-Path` avec le paramètre concerné qui le supporte) pour ces fichiers précis.
- **`curl` sous PowerShell** est un alias vers `Invoke-WebRequest`, dont la syntaxe diffère du vrai curl (`-H` ne fonctionne pas pareil). Utiliser `curl.exe` explicitement pour la syntaxe Unix classique, ou la syntaxe native `Invoke-WebRequest -Headers @{ "x-header" = "valeur" }`.
- **Redirection `<` non supportée** par PowerShell (contrairement à bash) — utiliser `Get-Content fichier.sql -Raw | commande` à la place de `commande < fichier.sql`.
- **`node --watch`** (utilisé en développement pour l'API) ne recharge pas toujours correctement après une modification de fichier faite depuis l'hôte Windows monté dans Docker — en cas de comportement qui ne change pas malgré un fichier modifié confirmé, faire `docker compose up -d --force-recreate <service>` plutôt que de chercher ailleurs.
- **Fins de ligne CRLF vs LF** : le dépôt utilise des fins de ligne Windows (CRLF) une fois converti par Git sur cette machine — un script Node qui construit une chaîne multi-lignes à comparer/remplacer dans un fichier existant (`content.includes(...)`) peut échouer silencieusement si la chaîne de comparaison utilise `\n` seul. Normaliser (`content.replace(/\r\n/g, "\n")`) avant comparaison, ou préférer une approche par ancres courtes/position (`indexOf`) plutôt qu'un long bloc multi-lignes exact pour les modifications automatisées de fichiers existants.
- **Affichage de caractères accentués dans le terminal** (`Ã©`, `â€”`...) : généralement un artefact d'affichage PowerShell, pas une vraie corruption du fichier — vérifier avec `notepad fichier` ou VS Code avant de conclure à un problème d'encodage réel.

## Licence

Ce projet est distribué sous licence **GNU Affero General Public License v3.0 (AGPL-3.0)** — voir le fichier [`LICENSE`](./LICENSE) à la racine du dépôt pour le texte complet.

Choix motivé par l'esprit transparence/données ouvertes du projet : contrairement à une licence permissive (MIT), l'AGPL garantit que toute personne qui modifie le code et le fait tourner sur un serveur public doit rendre ses propres modifications disponibles aux utilisateurs de ce service.
