# TODO — Pas de planète B

Document de suivi des chantiers en attente, à garder à jour d'une session à l'autre.

---

## 🔴 Bloquant / infrastructure

- **Bug de build Next.js sur `/404`** — **devenu bloquant pour le déploiement** (le VPS est commandé, voir ci-dessous). `next build` échoue avec `<Html> should not be imported outside of pages/_document`. Corrigé une première fois début août (migration `node:20-alpine` → `node:20-slim`) pour Next.js 15.x, mais **réapparu à l'identique après la montée en version vers Next.js 16.2.12**, alors que le projet est déjà sur `node:20-slim` — la piste musl/Alpine est donc définitivement écartée. Forcer Webpack au lieu de Turbopack ne règle pas non plus le problème. Chronologie complète, recherche (bug générique non résolu de Next.js, tickets `vercel/next.js` ouverts depuis la v13) et pistes de correctif non testées (retirer `getInitialProps` de `_document.js` pour isoler la cause ; ajouter un `getStaticProps` vide à `pages/404.js`) dans `KNOWN_ISSUES_build.md`. **À résoudre avant le premier déploiement de production**, sans quoi le pipeline CI (`docker/build-push-action`, qui exécute `next build` en interne) échouera.
- **VPS PlanetHoster HybridCloud** : commandé le 5 août 2026 (2 CPU, 4 GB RAM, 40 GB SSD NVMe, datacenter France + Suisse — Paris/Lausanne, ~40€/mois). Statut au moment de la commande : "En attente" (probablement paiement à finaliser — vérifier la facture dans l'espace client). Une fois "Actif", récupérer l'IP + accès SSH (envoyés par email selon PlanetHoster), puis configurer le DNS et redéployer `docker-compose.prod.yml` dessus.
  - *(Remplace le VPS Digital Forest, racheté par PlanetHoster — le blocage DNS qui empêchait la vérification Brevo et la finalisation du VPS chez Digital Forest devrait être résolu par cette migration.)*
- **Nom de domaine** : décision prise — **`pasdeplaneteb.com`** en domaine principal. Le `.fr` (déjà possédé ailleurs) sera transféré plus tard ; prévoir à ce moment-là soit une redirection `.fr → .com`, soit une gestion des deux domaines dans `CORS_ORIGIN`.
- **Vérification de domaine Brevo** : à refaire sur `pasdeplaneteb.com` (et non plus `.fr`) une fois le DNS configuré chez PlanetHoster. Devrait se dérouler sans le blocage rencontré chez Digital Forest.
  - Alternative temporaire pour tester le circuit en attendant : utiliser une adresse Gmail personnelle comme expéditeur (pas `ik.me`, qui bloque à cause de sa politique DMARC stricte).
- **`CORS_ORIGIN`** en production : à régler avec `https://pasdeplaneteb.com` une fois le VPS actif (actuellement en localhost).
- **Mentions légales** : compléter les champs `[À COMPLÉTER]` (nom/raison sociale de l'association, adresse du siège, SIRET, directeur·rice de publication, email de contact).
- **Secret GitHub `API_URL`** : à mettre à jour avec `https://pasdeplaneteb.com` (ou sous-domaine API dédié) une fois le déploiement fait.

## 🟡 Pull requests Dependabot en attente

- **Sans risque, à fusionner quand tu veux** : `express-rate-limit`, `helmet`, les paquets Capacitor (`@capacitor/android`, `@capacitor/core`, `@capacitor/cli`), les actions GitHub (`docker/build-push-action`, `actions/setup-node`, `actions/checkout`, `docker/login-action`).
- **À vérifier avant de fusionner** :
  - `csv-parse` (5.6 → 7.0) — deux versions majeures, vérifier l'usage dans `apps/api/src/ingest/`
  - `adm-zip` (0.5.18 → 0.6.0) — vérifier où il est utilisé
- **À fermer sans fusionner** (déjà testées, cassent le projet) :
  - PR `eslint` 8.57/9.39 → 10.8.0 (incompatibilité interne confirmée avec `eslint-config-next`, testée en conditions réelles) — on reste sur ESLint 9.x. Rescannée par Dependabot sous PR #5 après le commit manuel — à fermer si encore ouverte.
- **Déjà traitée manuellement, à fermer si encore ouverte** : PR `eslint-config-next` 14→16 (fait dans un commit dédié), rescannée par Dependabot sous PR #14.

## 🟢 Qualité de code

- ✅ **Hook partagé `useApiFetch(path, options)`** — **terminé** (5 août 2026), documenté dans `README.md`. Éliminait la duplication du pattern `loading/error/fetch` répétée dans ~40 pages. Converti page par page, testé (validation JSX + lint réel ESLint 9 + `eslint-plugin-react-hooks` à chaque lot) :
  - Lot 1 : `co2.js` (page pilote, hook conçu et validé ici)
  - Lot 2 (batch2, 22 fichiers) : pages publiques (`debunk`, `deputes` [détail + liste], `groupes`, `interviews`, `paysans`, `scrutins` [détail + liste], `eau`, `energie`, `especes`, `incendies`, `pollution`, `vegetation`) + pages admin (`settings`, `charte/item-edit`, `idees-enfants/edit`, `interviews/edit`, `paysans/edit`, `ressources/location-edit`, `ressources/online-edit`, `ContentTranslationsEditor.js`) — GET de chargement convertis, POST/PUT de sauvegarde volontairement laissés en `fetch` brut.
  - Lot 3 : `pays/[code].js` (5 août 2026) — le plus gros fichier du site (~800 lignes), 6 fetch bruts convertis. Bug d'encodage mojibake (UTF-8/CP1252 double-encodé via `Out-File`/`Get-Content` PowerShell côté transcription, pas dans le fichier source) trouvé et corrigé au passage.
  - Bug rencontré et corrigé à deux reprises (`energie.js` et `pays/[code].js`) : une valeur dérivée type `const x = data ?? []` recréait un nouveau tableau à chaque rendu tant que la donnée n'était pas chargée, invalidant inutilement des `useMemo`/`useEffect` qui en dépendaient — stabilisé partout avec `useMemo(() => data ?? [], [data])`, et vérifié qu'aucune valeur dérivée n'est utilisée avant sa propre déclaration.
- **`useCallback` sur les fonctions `build*Chart`** dans `apps/web/pages/pays/[code].js` (`buildWaterChart`, `buildStressChart`, `buildEnergyMixChart`...) : 2 avertissements `exhaustive-deps` actuellement ignorés sans risque, mais une vraie correction demande d'envelopper ces fonctions dans `useCallback` avec les bonnes dépendances, sans casser les graphiques.

## 🆕 Nouvelles fonctionnalités demandées (à faire)

1. **Revérifier que l'application mobile (Capacitor) fonctionne toujours** — plusieurs montées de version importantes ont eu lieu depuis le dernier test (Next.js 16, React 19, Express 5, ESLint 9, refactor complet de l'API). Aucune régression attendue en théorie, mais à valider concrètement sur un vrai appareil/émulateur.
2. **Section RGPD dédiée** pour les utilisateurs — à définir précisément (page à part ? section dans les mentions légales/confidentialité existantes ? droits d'accès/suppression/export des données ?).
3. **Page "Pétitions"** — nouveau type de contenu à créer, sur le modèle déjà établi (débunk, paysans, ressources...) :
   - Recenser des pétitions en cours ou clôturées via un lien + une description
   - Formulaire public de proposition (lien + description), modéré avant publication — même mécanisme que les ressources/paysans (`published = false` par défaut, badge "Proposé par le public" en admin)
   - Prise en charge du multilingue via le système de traductions de contenu déjà en place (`content_translations`, `ContentTranslationsEditor`)
   - Anti-bot par piège à bots (honeypot), comme pour les autres formulaires publics

## 💡 Idées en suspens (mentionnées, pas encore engagées)

- Analytics respectueux de la vie privée (Matomo ou Plausible, hébergés)
- Notifications push natives pour l'app mobile (actuellement le suivi de député se fait uniquement par email)
- Stockage externalisé (N0C Storage S3, inclus gratuitement avec le VPS PlanetHoster) à envisager si un jour un vrai upload de fichiers est ajouté (ex. photos pour les pétitions), plutôt que de charger le disque du VPS

---

*Dernière mise à jour : 5 août 2026 — voir aussi la date du dernier commit de ce fichier.*
