# TODO — Pas de planète B

Document de suivi des chantiers en attente, à garder à jour d'une session à l'autre.

---

## 🔴 Bloquant / infrastructure

- **Redirection du domaine secondaire `.fr` vers le `.com`** : tentée le 6 août, bloquée — impossible de modifier le DNS de ce domaine pour le moment côté hébergeur d'origine. La config Traefik pour cette redirection (routeur + middleware `redirectregex`) a été préparée mais volontairement pas commitée (aurait fait échouer l'obtention du certificat Let's Encrypt tant que le DNS ne pointe pas vers le VPS). À refaire dès que la modification DNS du `.fr` redevient possible.
- **Transfert de domaine en attente (règle des 60 jours ICANN)** : initié le 6 août 2026, se terminera automatiquement autour du **4-5 octobre 2026**. En attendant, la zone DNS active est celle du registrar d'origine (TTL réduit à 300s pour cette période transitoire).
  - **À faire début octobre 2026** : vérifier que le nouveau registrar prend bien le relais avec les mêmes enregistrements, confirmer la continuité de service.
- **Vérification de domaine Brevo** : à retenter dès maintenant, pas besoin d'attendre la fin du transfert — prouvé le 9 août que les modifications DNS fonctionnent déjà normalement malgré le blocage de transfert (testé avec la configuration email OVH, DNS toujours géré par PlanetHoster en attendant).
  - Alternative temporaire pour tester le circuit : une adresse Gmail personnelle comme expéditeur (pas `ik.me`, bloqué par sa politique DMARC).
- **Backfill historique des températures (1950-2025) en cours sur le VPS** : lancé le 14 août, cadencé automatiquement pour respecter le quota Open-Meteo (~10-21h de traitement actif au total selon la profondeur retenue). Rien à faire, juste laisser tourner — voir `apps/api/src/ingest/temperatures.js` pour le détail du cadencement. Le repère mondial (`world_benchmarks`, clé `temperature_deviation_world`) peut être rafraîchi à tout moment sans attendre la fin via `POST /api/admin/ingest/temperature-benchmark` (calcul interne, pas d'appel Open-Meteo).

## 🟢 Dette technique / suivi

- **Revérifier l'application mobile (Capacitor)** — plusieurs montées de version importantes ont eu lieu depuis le dernier test (Next.js 16, React 19, Express 5, ESLint 9, refactor complet de l'API + ajout de la fonctionnalité internationale). À valider concrètement sur un vrai appareil/émulateur.
- **Contrôle automatique des migrations manquantes** : idée soulevée après la découverte de la migration `035_content_translations.sql` jamais appliquée (saut de numérotation `034`→`036` passé inaperçu plusieurs semaines). Un script/étape CI qui compare les fichiers de migration présents avec ceux réellement appliqués en base éviterait qu'un futur saut de numérotation cause un bug silencieux similaire.
- Pas de révocation globale des sessions admin, `npm audit`/Dependabot à automatiser, comparaison de jeton non "timing-safe" — points de sécurité connus, moyen/bas, non bloquants (voir aussi `README.md`, section Sécurité).

## 🆕 Chantiers ouverts

1. **Espagne, Congreso — nombre de votes limité à 20** (législature courante uniquement, contrairement aux autres chambres internationales) : la page `/opendata/votaciones` n'expose ni pagination ni export en masse pour la législature en cours — confirmé par un développeur tiers ayant buté sur le même problème (dépôt GitHub `slopezmenend/civis-api`). Un sélecteur de législature existe (`_votaciones_legislatura`) mais fonctionne uniquement côté JavaScript (appel AJAX après chargement de page) — testé et confirmé inutilisable via un simple `fetch()`. Pour aller plus loin, il faudrait un navigateur automatisé (Puppeteer/Playwright), une brique d'infrastructure nouvelle pour le projet. Décision prise le 13 août : ne pas engager ce chantier pour l'instant.

2. **Espagne, Sénat — maintenance mensuelle manuelle requise** (procédure récurrente, pas un bug) : `senado.es` bloque (403 Forbidden, Akamai) toute requête venant d'une adresse IP de datacenter — VPS et GitHub Actions concernés. Solution en place depuis le 13 août : script `refresh-spain-senate-prod.ps1` (racine du dépôt), à lancer une fois par mois depuis un PC avec une connexion résidentielle normale. Voir `README.md`, section "Maintenance mensuelle", pour la procédure complète.

3. **Suggestion de sources pour les pays sans données** (`/international`) : russe, japonais, chinois, hindi actuellement listés comme non couverts. Mécanisme de contact déjà en place, mais aucune source n'a encore été proposée/évaluée pour ces pays.

4. **Question de méthodologie à trancher/expliquer** (page résumé pays, `/pays/[code]`) : la comparaison ne risque-t-elle pas d'être biaisée par la taille du pays (France, petit pays, vs États-Unis) ? Par exemple pour le CO2/la pollution, un pays avec une population/économie comparable en taille aux USA consommerait-il proportionnellement autant ? À clarifier dans le texte explicatif (indicateurs déjà par habitant pour certains, à vérifier/préciser lesquels le sont et lesquels ne le sont pas).

5. **Vérifier l'amélioration de l'indexation Google Search Console dans quelques semaines** — le 9 août, Search Console signalait : `www.pasdeplaneteb.com` en 404 (corrigé), pages `?section=...` vues comme doublons sans canonique (corrigé), et 12 pages "explorées mais non indexées" (sitemap.xml créé et soumis). Repasser sur le rapport "Indexation des pages" d'ici 2-3 semaines pour confirmer que ces 3 correctifs ont bien fait effet.

6. **Lien "voir le texte complet" des scrutins — bilan par chambre (14 août)** :
   - **✅ Résolu** : États-Unis (Chambre, `ingest-us-congress.js` — vrai lien Congress.gov via `legislationType`+`legislationNumber`), France (`ingest/scrutins.js` — dossier législatif via `dossierRef`, 31% des scrutins, colonne `dossier_legislatif_url`), Italie Chambre (`ingest-italy-camera.js` — acte parlementaire via `ocd:rif_aic`, 45% des votes).
   - **🔴 Aucune solution trouvée** (limite structurelle des données source, pas un manque d'effort) : Italie Sénat (le chemin existe techniquement — `osr:oggetto` → `osr:relativoA` → DDL — mais la page finale n'a pas de titre lisible affiché, et nécessite 3 sauts SPARQL), Espagne Congreso (JSON du vote sans aucun identifiant structuré de dossier, juste du texte libre), Espagne Sénat (même limite que le Congreso). Pour ces 3 chambres, le lien continue de pointer vers la page/le fichier du vote lui-même (résultats), pas vers le texte voté — pas de piste supplémentaire identifiée à ce stade.

7. **Nouvelle page Températures (14 août) — suites à donner une fois le backfill terminé** :
   - **Automatiser le rafraîchissement mensuel** (`refresh-data.yml`) : volontairement pas encore fait — tant que le backfill initial (1950-2025, tous pays) n'est pas fini, un déclenchement automatique tenterait de tout refaire et dépasserait largement le timeout d'une Action GitHub. Une fois le backfill terminé, les runs suivants ne récupèrent qu'une seule année par pays (léger, rapide) — sûr à automatiser à ce moment-là.
   - **Repasser `/etat-des-donnees` de `freq_manual` à `freq_monthly`** pour la source Températures, en cohérence avec l'automatisation ci-dessus une fois en place.
   - **Efficacité pédagogique à retravailler** : la page actuelle (warming stripes + canicules/vagues de froid + tableau + détails méthodologiques) est plus proche d'un outil d'exploration pour public déjà convaincu/curieux que d'un outil pensé pour convaincre un novice sceptique rapidement — nécessite de choisir un pays avant de rien voir, plusieurs graphiques à la fois, indice "100 = moyenne mondiale" pas forcément intuitif. Pistes évoquées non engagées : warming stripes mondial affiché par défaut avant tout choix de pays, phrase d'accroche courte au-dessus du graphique, mode "vue simplifiée" masquant les détails techniques par défaut. Décision à prendre sur si convaincre les sceptiques est vraiment l'objectif prioritaire de cette page précise (vs. rigueur/transparence, l'autre axe déjà bien servi).

## 💡 Idées en suspens (mentionnées, pas encore engagées)

- Notifications push natives pour l'app mobile (actuellement le suivi de député/élu se fait uniquement par email)
- Stockage externalisé (type S3) à envisager si un jour un vrai upload de fichiers est ajouté (ex. photos pour les pétitions), plutôt que de charger le disque du VPS

---

*Dernière mise à jour : 14 août 2026 (ajout du chantier Températures) — voir aussi la date du dernier commit de ce fichier.*
