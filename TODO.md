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
- **Espagne, Congreso — backfill historique des votes en cours** : mécanisme de navigation par date découvert et implémenté (site Liferay, paramètres `targetLegislatura`/`targetDate` en simple GET — pas besoin de Playwright finalement, contrairement à ce qui était supposé). Le workflow GitHub Actions **"Backfill historique — Espagne Congreso"** (déclenchement manuel, onglet Actions) a été lancé le 20 août et boucle automatiquement jusqu'à couvrir toute la XV législature.
  - **À vérifier en priorité à la reprise** : le workflow a-t-il terminé ? (`done: true` dans les logs, ou re-déclencher s'il s'est arrêté avant — la reprise est automatique, basée sur la base de données)
  - **Ensuite**, lancer la vérification des trous de numérotation de séance (un cas déjà observé lors du test : séance 190 absente entre 191 et 189, cause non déterminée) :
    ```
    docker compose -f docker-compose.prod.yml exec api node src/scripts/ingest-spain-congress.js --check-gaps
    ```
  - Une fois complet, mettre à jour ce point du TODO (le retirer) et vérifier `/etat-des-donnees` (déjà câblé automatiquement, aucune action attendue de ce côté).
- **Suggestion de sources pour les parlements russe/japonais/chinois/hindi** (`/international`) : aucune source identifiée à ce jour.
- **Lien "voir le texte complet" des scrutins** : résolu pour États-Unis (Chambre), France, Italie (Chambre). Aucune solution trouvée pour Italie Sénat, Espagne Congreso, Espagne Sénat — limite des données sources, pas un manque d'effort.
- **Search Console — deux nouvelles catégories à surveiller** (repéré le 20 août, distinct du chantier hreflang déjà résolu) : "Page en double sans URL canonique sélectionnée par l'utilisateur" (251 pages) et "Explorée, actuellement non indexée" (454 pages) — dominées par les pages profondes multilingues (`/deputes/PA###`, `/scrutins/17/###`, `/international/[pays]/scrutins/###`). Hypothèse la plus probable : Google regroupe ces variantes de langue comme quasi-doublons (les chiffres/noms propres ne changent pas selon la langue de l'interface), même avec hreflang et canonical auto-référent corrects des deux côtés — comportement assez attendu sur un gros site multilingue à fort volume de pages profondes, pas forcément un bug à corriger. **À revérifier dans 1-2 semaines** : si les chiffres diminuent avec le temps (rattrapage naturel du crawl), rien à faire ; s'ils augmentent, envisager de limiter la traduction/indexation des pages les moins consultées (vieux scrutins étrangers peu visités, traduits dans les 8 langues).

## 💡 Idées en suspens

- **Notifications push natives pour l'app mobile** — discuté le 20 août, piste à trancher (rien codé) :
  - Le suivi d'élu se fait aujourd'hui uniquement par email (double opt-in RGPD, fonctionnel)
  - 4 pistes envisagées : (1) push comme canal en plus de l'email pour le suivi d'élu déjà existant — recommandé, effort modéré, réutilise la logique déjà en place ; (2) notifications génériques "nouveau contenu publié" — écarté, pas de système de préférences visiteur pour filtrer, risque de bruit ; (3) alertes anticipatives ("votre élu vote cette semaine") — séduisant mais demande un nouveau chantier de données (agenda législatif à venir, pas ingéré aujourd'hui) ; (4) alertes sur seuils (pétition qui atteint un palier) — secondaire, complexité de suivi de seuils
  - **Décision en attente côté Anthony** avant de coder quoi que ce soit — si feu vert sur la piste 1, prochaine étape technique : Capacitor + Firebase Cloud Messaging (Android priorisé, l'app semble surtout ciblée Android pour l'instant)
- Stockage externalisé (S3) à envisager si un vrai upload de fichiers est ajouté un jour
- Ajustement automatique de la hauteur de l'iframe du kit de communication web (`postMessage` entre l'iframe et la page) — actuellement une hauteur fixe généreuse, fonctionnelle mais pas parfaitement adaptative
