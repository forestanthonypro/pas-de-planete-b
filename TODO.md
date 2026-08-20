# TODO — Pas de planète B

Suivi des chantiers en attente. Voir aussi `README.md` pour les points d'architecture/conventions.

---

## 🔴 Bloquant / infrastructure

- **CSP en mode Report-Only — période d'observation en cours** : déployée suite à l'audit de sécurité du 20 août. Surveiller les logs API (`docker compose -f docker-compose.prod.yml logs api | grep CSP_VIOLATION`) pendant au moins 7 jours, parcourir le site en suivant la checklist de `CSP_ROLLOUT.md`, puis seulement basculer `Content-Security-Policy-Report-Only` en `Content-Security-Policy` dans `apps/web/next.config.js` si aucune violation légitime inexpliquée.
- **Ingestion des températures bloquée** : Open-Meteo a silencieusement mis l'IP du VPS en liste noire (aucune erreur explicite, requêtes sans réponse — confirmé en testant la même requête depuis un navigateur personnel, qui fonctionne). France notamment n'a aucune donnée. À retenter après un délai (quelques jours), sinon envisager une clé API payante Open-Meteo. Voir `README.md`, section Maintenance, pour la commande de relance ciblée par pays.
- **Transfert de domaine `.fr` → `.com`** : en attente de la règle des 60 jours ICANN, finalisation prévue autour d'octobre 2026. Rien à faire avant cette date — vérifier ensuite que le nouveau registrar prend le relais avec les mêmes enregistrements DNS.
- **Vérification de domaine Brevo** : bloquée par le transfert de domaine en cours (DNS toujours géré par l'ancien registrar). Alternative temporaire déjà en place : expéditeur Gmail personnel.

## 🆕 Chantiers ouverts

- **EcoIndex bloqué à B** : Performance Lighthouse remontée à 96 (bug d'hydratation React corrigé), mais DOM/requêtes déjà sous les cibles — pas de gain facile identifié. Une tentative de chargement différé (`next/dynamic`) sur `/decouverte` a été essayée puis **annulée** (dégradait la Performance au lieu de l'améliorer). Piste non essayée : chargement conditionné au défilement réel (`IntersectionObserver`), plus complexe, à réserver si vraiment nécessaire.
- **Espagne, Congreso — nombre de votes limité à 20** (législature courante) : pas de pagination/export exposé côté source, un navigateur automatisé serait nécessaire. Écarté à l'origine faute de cette brique d'infrastructure — **le projet dispose maintenant de Playwright** (ajouté pour le kit PDF), ce qui change potentiellement le calcul. À réévaluer si prioritaire.
- **Suggestion de sources pour les parlements russe/japonais/chinois/hindi** (`/international`) : aucune source identifiée à ce jour.
- **Lien "voir le texte complet" des scrutins** : résolu pour États-Unis (Chambre), France, Italie (Chambre). Aucune solution trouvée pour Italie Sénat, Espagne Congreso, Espagne Sénat — limite des données sources, pas un manque d'effort.

## 💡 Idées en suspens

- Notifications push natives pour l'app mobile (le suivi d'élu se fait aujourd'hui uniquement par email)
- Stockage externalisé (S3) à envisager si un vrai upload de fichiers est ajouté un jour
- Ajustement automatique de la hauteur de l'iframe du kit de communication web (`postMessage` entre l'iframe et la page) — actuellement une hauteur fixe généreuse, fonctionnelle mais pas parfaitement adaptative
