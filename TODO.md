# TODO — Pas de planète B

Document de suivi des chantiers en attente, à garder à jour d'une session à l'autre.

---

## 🔴 Bloquant / infrastructure

- ✅ **Déploiement de production** — **terminé** (6 août 2026). VPS actif, DNS propagé, le site tourne réellement en production sur `docker-compose.prod.yml` (Traefik + Let's Encrypt + PostgreSQL/PostGIS + API + web). Migrations appliquées manuellement lors de ce premier déploiement (pas de script `migrate` automatisé dans le projet — voir point qualité de code ci-dessous, à envisager pour la suite).
  - Bug rencontré et corrigé au passage : l'image `traefik:v3.1` embarquait un client Docker interne trop ancien (API 1.24) pour le Docker Engine récent installé sur le nouveau VPS (exige API ≥ 1.40) — Traefik ne découvrait aucun conteneur. Résolu en passant à `traefik:v3.7` dans `docker-compose.prod.yml`.
- ✅ **`deploy-production` dans `ci.yml`** — **implémenté pour de vrai** (6 août 2026), remplace l'ancien placeholder `echo "TODO"`. Connexion SSH automatique au serveur (clé dédiée, secret GitHub `PRODUCTION_SSH_KEY`), `git pull` + `docker compose pull && up -d` + nettoyage des vieilles images. Le job `deploy-staging` a été désactivé (commenté, pas supprimé) : pas de serveur de staging distinct à ce jour, à réactiver le jour où un vrai environnement de staging existe.
- ✅ **Nom de domaine** : décision finale prise (voir avec Anthony pour le détail, volontairement pas précisé ici). Site accessible en HTTPS avec certificat Let's Encrypt valide.
- **⚠️ Transfert de domaine en attente (règle des 60 jours ICANN)** : un transfert de registrar a été initié le 6 août 2026, mais bloqué automatiquement — un domaine ne peut pas être transféré avant 60 jours après sa création (règle ICANN standard, rien d'anormal). Le transfert se terminera automatiquement autour du **4-5 octobre 2026**. En attendant, **la zone DNS active et faisant autorité est celle du registrar d'origine** (les enregistrements `A`/`CNAME`/`MX` y ont été recréés manuellement le 6 août, TTL réduit à 300s pour cette période transitoire). Cause d'une panne du 6 août : la zone DNS d'origine avait été vidée automatiquement au lancement du transfert, provoquant un `SERVFAIL` généralisé jusqu'à sa reconstruction.
  - **À faire début octobre 2026, une fois le transfert effectif** : vérifier que le nouveau registrar prend bien le relais avec les mêmes enregistrements (déjà préparés dans sa zone DNS lors de la tentative du 5-6 août, à revérifier/recréer si besoin), et confirmer la continuité de service sans nouvelle interruption.
- ✅ **`CORS_ORIGIN`** en production : réglé sur le domaine réel.
- ✅ **Secrets GitHub `API_URL` et `INGEST_TOKEN`** : mis à jour avec les vraies valeurs de production — le job `environmental-audit` fonctionne maintenant de bout en bout (mesure EcoIndex + Lighthouse envoyée à l'API après chaque déploiement).
- **Vérification de domaine Brevo** : toujours à faire sur le domaine définitif. Attendre si possible la fin du transfert de domaine (voir point ci-dessus) pour éviter de configurer ça deux fois.
  - Alternative temporaire pour tester le circuit en attendant : utiliser une adresse Gmail personnelle comme expéditeur (pas `ik.me`, qui bloque à cause de sa politique DMARC stricte).
- **Mentions légales** : compléter les champs `[À COMPLÉTER]` (nom/raison sociale de l'association, adresse du siège, SIRET, directeur·rice de publication, email de contact).

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
- **Script de migration automatisé** pour `apps/api` : actuellement aucun `npm run migrate`, les fichiers `db/migrations/*.sql` doivent être appliqués manuellement un par un lors de chaque déploiement sur une base neuve (fait à la main pour le premier déploiement de production le 6 août 2026). À automatiser (ex: intégrer un outil comme `node-pg-migrate` ou un script minimal qui applique les fichiers non encore appliqués, avec une table de suivi des migrations déjà passées) pour fiabiliser les futurs déploiements sur un nouvel environnement.
- ✅ **Bug de build `/404`** — **résolu** (5 août 2026). Cause réelle : `NODE_ENV=development` restait actif pendant `next build` (hérité du `.env` de dev), ce que Next.js signale comme risquant de créer des incohérences — corrigé en forçant `NODE_ENV=production` explicitement dans le script `build`. Projet à jour sur Next.js 16.3.0, React 19.2.8, Node 24 (Node 20 était en fin de vie). Chronologie complète de l'investigation dans `KNOWN_ISSUES_build.md`. Deux améliorations de code faites au passage, conservées : `Layout.js` (`useRouter()` ne viole plus les Rules of Hooks) et mécanisme `Component.noLayout` (`_app.js`/`404.js`) pour exclure une page du `Layout` global.

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
- Stockage externalisé (type S3, souvent inclus gratuitement selon l'hébergeur) à envisager si un jour un vrai upload de fichiers est ajouté (ex. photos pour les pétitions), plutôt que de charger le disque du VPS

---

*Dernière mise à jour : 5 août 2026 — voir aussi la date du dernier commit de ce fichier.*
