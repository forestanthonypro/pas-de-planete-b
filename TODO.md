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

## 🟡 Pull requests Dependabot en attente

- **Sans risque, à fusionner quand tu veux** : `express-rate-limit`, `helmet`, les paquets Capacitor (`@capacitor/android`, `@capacitor/core`, `@capacitor/cli`), les actions GitHub (`docker/build-push-action`, `actions/setup-node`, `actions/checkout`, `docker/login-action`).
- **À vérifier avant de fusionner** :
  - `csv-parse` (5.6 → 7.0) — deux versions majeures, vérifier l'usage dans `apps/api/src/ingest/`
  - `adm-zip` (0.5.18 → 0.6.0) — vérifier où il est utilisé
- **À fermer sans fusionner** (déjà testées, cassent le projet) :
  - PR `eslint` 8.57/9.39 → 10.8 (incompatibilité interne confirmée avec `eslint-config-next`, testée en conditions réelles) — on reste sur ESLint 9.x
- **Déjà traitée manuellement, à fermer si encore ouverte** : PR `eslint-config-next` 14→16 (fait dans un commit dédié)

## 🟢 Qualité de code (revue approfondie déjà faite, suite à prévoir)

- **Hook partagé `useApiFetch(url, deps)`** : élimine la duplication du pattern `loading/error/fetch` répété dans ~40 pages. Actuellement, la règle ESLint `react-hooks/set-state-in-effect` est désactivée globalement à cause de ce pattern — un hook dédié réglerait la duplication *et* permettrait de réactiver la règle proprement. Chantier à part entière, à faire calmement avec tests page par page (fort risque de régression si précipité).
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

*Dernière mise à jour : voir date du dernier commit de ce fichier.*
