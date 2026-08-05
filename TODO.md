# TODO — Pas de planète B

Document de suivi des chantiers en attente, à garder à jour d'une session à l'autre.

---

## 🔴 Bloquant / infrastructure

- **VPS Digital Forest** : toujours en attente d'IP fonctionnelle. Le panneau de gestion du domaine affiche une erreur ("problème de récupération des serveurs DNS") et l'option "Serveurs DNS personnalisés" est cochée avec des champs vides — potentiellement la cause du blocage. À corriger : repasser sur "Serveurs DNS par défaut", puis configurer la zone DNS chez Digital Forest.
- **Vérification de domaine Brevo** (`pasdeplaneteb.fr`) : même blocage DNS que ci-dessus. Tant que ce n'est pas fait, les emails (newsletter, suivi de député) échouent silencieusement côté Brevo (erreur confirmée : *"Sending has been rejected because the sender you used no-reply@pasdeplaneteb.fr is not valid"*). Résoudre le DNS réglera les deux problèmes en même temps.
  - Alternative temporaire pour tester le circuit en attendant : utiliser une adresse Gmail personnelle comme expéditeur (pas `ik.me`, qui bloque à cause de sa politique DMARC stricte).
- **`CORS_ORIGIN`** en production : à régler avec la vraie URL une fois le VPS/domaine finalisés (actuellement en localhost).
- **Mentions légales** : compléter les champs `[À COMPLÉTER]` (nom/raison sociale de l'association, adresse du siège, SIRET, directeur·rice de publication, email de contact).
- **Secret GitHub `API_URL`** : à mettre à jour avec la vraie URL de prod une fois le déploiement fait.
- **Build Next.js échoue sur `/404`** (découvert le 5 août 2026, indépendant du chantier `useApiFetch` en cours à ce moment-là) :
  ```
  Error: <Html> should not be imported outside of pages/_document.
  Error occurred prerendering page "/fr/404".
  Export encountered an error on /404: /fr/404, exiting the build.
  ```
  Le lint passe et `npm run dev` fonctionne — seul `npm run build` (Next.js 16.2.12 / Turbopack) échoue à l'étape de génération statique. Pistes à vérifier : contenu de `pages/_document.js` (export correct de `<Html>`), un import transitif de `next/document` déclenché depuis `pages/404.js` ou un composant partagé (Layout, etc.), et compatibilité `next/document` + Turbopack en 16.x (possible régression ne touchant que le build de prod).

## 🟡 Pull requests Dependabot en attente

- **Sans risque, à fusionner quand tu veux** : `express-rate-limit`, `helmet`, les paquets Capacitor (`@capacitor/android`, `@capacitor/core`, `@capacitor/cli`), les actions GitHub (`docker/build-push-action`, `actions/setup-node`, `actions/checkout`, `docker/login-action`).
- **À vérifier avant de fusionner** :
  - `csv-parse` (5.6 → 7.0) — deux versions majeures, vérifier l'usage dans `apps/api/src/ingest/`
  - `adm-zip` (0.5.18 → 0.6.0) — vérifier où il est utilisé
- **À fermer sans fusionner** (déjà testées, cassent le projet) :
  - PR `eslint` 8.57/9.39 → 10.8.0 (incompatibilité interne confirmée avec `eslint-config-next`, testée en conditions réelles) — on reste sur ESLint 9.x. Rescannée par Dependabot sous PR #5 après le commit manuel — à fermer si encore ouverte.
- **Déjà traitée manuellement, à fermer si encore ouverte** : PR `eslint-config-next` 14→16 (fait dans un commit dédié), rescannée par Dependabot sous PR #14.

## 🟢 Qualité de code

- ✅ **Hook partagé `useApiFetch(path, options)`** — **terminé** (5 août 2026). Éliminait la duplication du pattern `loading/error/fetch` répétée dans ~40 pages. Converti page par page, testé (validation JSX + lint réel ESLint 9 + `eslint-plugin-react-hooks` à chaque lot) :
  - Lot 1 : `co2.js` (page pilote, hook conçu et validé ici)
  - Lot 2 (batch2, 22 fichiers) : pages publiques (`debunk`, `deputes` [détail + liste], `groupes`, `interviews`, `paysans`, `scrutins` [détail + liste], `eau`, `energie`, `especes`, `incendies`, `pollution`, `vegetation`) + pages admin (`settings`, `charte/item-edit`, `idees-enfants/edit`, `interviews/edit`, `paysans/edit`, `ressources/location-edit`, `ressources/online-edit`, `ContentTranslationsEditor.js`) — GET de chargement convertis, POST/PUT de sauvegarde volontairement laissés en `fetch` brut.
  - Bug attrapé et corrigé pendant la conversion : le pattern `const x = data ?? []` recréait un nouveau tableau à chaque rendu tant que la donnée n'était pas chargée, invalidant inutilement des `useMemo`/`useEffect` (dont un vrai bug d'ordre de déclaration dans `energie.js`, corrigé). Partout stabilisé avec `useMemo(() => data ?? [], [data])`.
  - Reste (si des pages existent en dehors de ce périmètre, à vérifier au prochain passage) : `pays/[code].js` n'a pas été traité dans ce chantier — voir point suivant.
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

---

*Dernière mise à jour : 5 août 2026 — voir aussi la date du dernier commit de ce fichier.*
