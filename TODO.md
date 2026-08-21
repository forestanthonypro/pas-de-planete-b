# TODO — Pas de planète B

Suivi des chantiers en attente. Voir aussi `README.md` pour les points d'architecture/conventions.

---

## 🔴 Bloquant / infrastructure

- **CSP en mode Report-Only — période d'observation en cours** : déployée suite à l'audit de sécurité du 20 août. Surveiller les logs API (`docker compose -f docker-compose.prod.yml logs api | grep CSP_VIOLATION`) pendant au moins 7 jours, parcourir le site en suivant la checklist de `CSP_ROLLOUT.md`, puis seulement basculer `Content-Security-Policy-Report-Only` en `Content-Security-Policy` dans `apps/web/next.config.js` si aucune violation légitime inexpliquée.
- **Transfert de domaine `.fr` → `.com`** : en attente de la règle des 60 jours ICANN, finalisation prévue autour d'octobre 2026. Rien à faire avant cette date — vérifier ensuite que le nouveau registrar prend le relais avec les mêmes enregistrements DNS.
- **Vérification de domaine Brevo** : bloquée par le transfert de domaine en cours (DNS toujours géré par l'ancien registrar). Alternative temporaire déjà en place : expéditeur Gmail personnel.
- **Mettre à jour `next` dès la sortie du correctif de sécurité critique du 26 août 2026** (annoncé par Vercel pour les lignes 16.3 et 15.5 — actuellement en 16.3.1). Vérifier `https://nextjs.org/blog/upcoming-nextjs-security-release-august-2026` et appliquer dès disponibilité.
- **`docker compose pull` régulier à instaurer** : `traefik:v3.7`, `node:24-slim` et `postgis/postgis:16-3.4` sont des tags flottants — ils ne se mettent à jour que sur un `pull` explicite, jamais sur un simple redémarrage. Envisager de l'automatiser (mensuel) via un workflow, sur le modèle de `npm-audit.yml` déjà en place.

## 🆕 Chantiers ouverts

- **Ingestion des températures — rattrapage en cours, automatisation à faire ensuite** : le blocage IP Open-Meteo s'est levé de lui-même. Backfill relancé le 20 août pour les 68 pays encore manquants (`co2_emissions` sert de référence : 215 pays au total, 147 déjà complets avant ce rattrapage). Une fois les 68 confirmés complets (`SELECT country_code FROM co2_emissions WHERE country_code NOT IN (SELECT DISTINCT country_code FROM country_temperatures)` doit ne plus rien renvoyer), l'automatisation n'est **pas** un simple ajout de job dans `refresh-data.yml` : `ingestTemperatures()` (`apps/api/src/ingest/temperatures.js`) recharge tout l'historique 1950→aujourd'hui pour un pays tant que le compte d'années ne correspond pas — donc chaque nouvelle année déclencherait l'équivalent du backfill complet (~10-20h) pour les 215 pays. Il faut d'abord l'adapter au même principe que le backfill Espagne (`spain-congress-historical-backfill.yml`) : tranches bornées en durée par appel HTTP, flag `done`, rappelées en boucle par un workflow — avant de programmer un cron annuel dessus.
- **EcoIndex bloqué à B** : Performance Lighthouse remontée à 96 sur `/decouverte` (bug d'hydratation React corrigé), mais un contrôle plus large le 21 août montre 43 sur `/impact` — cause identifiée : `lib/useT.js` importe statiquement les 8 fichiers `lib/i18n/*.json` (796 Ko cumulés), donc chaque page charge et exécute les 8 langues côté client peu importe celle du visiteur. Poids réseau correct une fois gzippé (d'où le bon EcoIndex), mais coût de parsing/exécution JS important (TBT/TTI), qui plombe spécifiquement Performance. Le site utilise déjà le routage i18n natif de Next.js (une URL par langue via `router.locale`), donc la vraie correction — ne charger que le dictionnaire de la langue courante via `getStaticProps`, côté serveur — est architecturalement saine, mais touche potentiellement les 40 pages qui ont chacune leur propre `getStaticProps`. Reporté le 21 août, pas de calendrier fixé.
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

## 🆕 Chantiers ouverts (suite)

- **Notifications Web Push — reste avant diffusion large** : le système est fonctionnel de bout en bout (déclenchement, worker, réception navigateur, testé sur pétitions et votes de député) et intégré à la navigation (icône dans la barre du haut, bannière d'incitation, encart de renvoi vers les fiches élus depuis `/notifications`). Clés VAPID de production générées et déployées le 20 août (rappel technique : `docker compose restart` ne suffit pas après un changement dans `.env`, il faut `docker compose up -d` pour recréer le conteneur avec les nouvelles variables). Reste :
  - Test réel en PWA sur iOS (écran d'accueil) — seul environnement pas encore testé
  - Quelques jours d'observation en conditions réelles avant diffusion large, comme prévu initialement
  - **Capacitor + Firebase Cloud Messaging** (push natif mobile) : reporté à la publication de l'appli sur les stores. La table `notification_events` (événements transactionnels, déduplication) est agnostique du canal d'envoi — un futur worker FCM pourra s'y brancher sans refonte.

## 💡 Idées en suspens

- Stockage externalisé (S3) à envisager si un vrai upload de fichiers est ajouté un jour
- Ajustement automatique de la hauteur de l'iframe du kit de communication web (`postMessage` entre l'iframe et la page) — actuellement une hauteur fixe généreuse, fonctionnelle mais pas parfaitement adaptative
