# TODO — Pas de planète B

Suivi des chantiers en attente. Voir aussi `README.md` pour les points d'architecture/conventions.

---

## 🔴 Bloquant / infrastructure

- **Ingestion des températures bloquée** : Open-Meteo a silencieusement mis l'IP du VPS en liste noire (aucune erreur explicite, requêtes sans réponse — confirmé en testant la même requête depuis un navigateur personnel, qui fonctionne). France notamment n'a aucune donnée. À retenter après un délai (quelques jours), sinon envisager une clé API payante Open-Meteo. Voir `README.md`, section Maintenance, pour la commande de relance ciblée par pays.
- **Transfert de domaine `.fr` → `.com`** : en attente de la règle des 60 jours ICANN, finalisation prévue autour d'octobre 2026. Rien à faire avant cette date — vérifier ensuite que le nouveau registrar prend le relais avec les mêmes enregistrements DNS.
- **Vérification de domaine Brevo** : bloquée par le transfert de domaine en cours (DNS toujours géré par l'ancien registrar). Alternative temporaire déjà en place : expéditeur Gmail personnel.

## 🟢 Dette technique

- **Revalider l'application mobile (Capacitor)** sur un vrai appareil/émulateur — plusieurs montées de version majeures (Next.js, React, Express, ESLint) depuis le dernier test.
- **Contrôle automatique des migrations manquantes** : un script/étape CI comparant les fichiers présents dans `db/migrations/` avec ceux réellement appliqués en base éviterait qu'un saut de numérotation passe inaperçu.
- Sécurité, moyen/bas, non bloquants : pas de révocation globale des sessions admin, `npm audit`/Dependabot à automatiser, comparaison de jeton non "timing-safe".

## 🆕 Chantiers ouverts

- **Tester en conditions réelles le kit de communication PDF et la portée géographique des contenus proposés** (les deux gros chantiers les plus récents) : soumettre une proposition sur chacun des 5 formulaires publics (pétitions, ressources, idées enfants, debunk, relais scientifique) et vérifier l'apparition correcte côté admin (drapeaux, notes de soumission, filtre) ; générer un PDF/la page web du kit pour plusieurs pays et langues.
- **EcoIndex bloqué à B** : Performance Lighthouse remontée à 96 (bug d'hydratation React corrigé), mais DOM/requêtes déjà sous les cibles — pas de gain facile identifié. Une tentative de chargement différé (`next/dynamic`) sur `/decouverte` a été essayée puis **annulée** (dégradait la Performance au lieu de l'améliorer). Piste non essayée : chargement conditionné au défilement réel (`IntersectionObserver`), plus complexe, à réserver si vraiment nécessaire.
- **Search Console — doublons de contenu entre langues** : `hreflang` généré automatiquement pour toutes les pages (y compris les pages profondes comme chaque scrutin/député, hors périmètre du sitemap). Déployé récemment — à revérifier dans le rapport "Indexation des pages" d'ici quelques semaines pour confirmer que Google a bien réévalué ces pages.
- **Espagne, Congreso — nombre de votes limité à 20** (législature courante) : pas de pagination/export exposé côté source, un navigateur automatisé serait nécessaire. Écarté à l'origine faute de cette brique d'infrastructure — **le projet dispose maintenant de Playwright** (ajouté pour le kit PDF), ce qui change potentiellement le calcul. À réévaluer si prioritaire.
- **Suggestion de sources pour les parlements russe/japonais/chinois/hindi** (`/international`) : aucune source identifiée à ce jour.
- **Question de méthodologie à trancher** (`/pays/[code]`) : la comparaison entre pays de tailles très différentes (France vs États-Unis) peut biaiser la lecture — à clarifier dans le texte explicatif, en précisant quels indicateurs sont déjà par habitant.
- **Lien "voir le texte complet" des scrutins** : résolu pour États-Unis (Chambre), France, Italie (Chambre). Aucune solution trouvée pour Italie Sénat, Espagne Congreso, Espagne Sénat — limite des données sources, pas un manque d'effort.
- **Page Températures — efficacité pédagogique à retravailler** : plus proche d'un outil d'exploration pour public déjà convaincu que d'un outil pensé pour convaincre rapidement un novice sceptique. Pistes non engagées : warming stripes mondial affiché par défaut, accroche courte, mode simplifié masquant les détails techniques.

## 💡 Idées en suspens

- Notifications push natives pour l'app mobile (le suivi d'élu se fait aujourd'hui uniquement par email)
- Stockage externalisé (S3) à envisager si un vrai upload de fichiers est ajouté un jour
- Ajustement automatique de la hauteur de l'iframe du kit de communication web (`postMessage` entre l'iframe et la page) — actuellement une hauteur fixe généreuse, fonctionnelle mais pas parfaitement adaptative
