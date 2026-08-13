# TODO — Pas de planète B

Document de suivi des chantiers en attente, à garder à jour d'une session à l'autre.

---

## 🔴 Bloquant / infrastructure

- **Redirection du domaine secondaire `.fr` vers le `.com`** : tentée le 6 août, bloquée — impossible de modifier le DNS de ce domaine pour le moment côté hébergeur d'origine. La config Traefik pour cette redirection (routeur + middleware `redirectregex`) a été préparée mais volontairement pas commitée (aurait fait échouer l'obtention du certificat Let's Encrypt tant que le DNS ne pointe pas vers le VPS). À refaire dès que la modification DNS du `.fr` redevient possible.
- **Transfert de domaine en attente (règle des 60 jours ICANN)** : initié le 6 août 2026, se terminera automatiquement autour du **4-5 octobre 2026**. En attendant, la zone DNS active est celle du registrar d'origine (TTL réduit à 300s pour cette période transitoire).
  - **À faire début octobre 2026** : vérifier que le nouveau registrar prend bien le relais avec les mêmes enregistrements, confirmer la continuité de service.
- **Vérification de domaine Brevo** : à retenter dès maintenant, pas besoin d'attendre la fin du transfert — prouvé le 9 août que les modifications DNS fonctionnent déjà normalement malgré le blocage de transfert (testé avec la configuration email OVH, DNS toujours géré par PlanetHoster en attendant).
  - Alternative temporaire pour tester le circuit : une adresse Gmail personnelle comme expéditeur (pas `ik.me`, bloqué par sa politique DMARC).

## 🟢 Dette technique / suivi

- **Revérifier l'application mobile (Capacitor)** — plusieurs montées de version importantes ont eu lieu depuis le dernier test (Next.js 16, React 19, Express 5, ESLint 9, refactor complet de l'API + ajout de la fonctionnalité internationale). À valider concrètement sur un vrai appareil/émulateur.
- **Correspondance des sénateurs américains (GovTrack)** : correctif déployé le 10 août (appariement exact par `bioguideId` via la table `congress-legislators`, repli automatique sur nom+état si absent) — **à confirmer à la prochaine ingestion réelle** en lisant le log `[diagnostic] Colonnes disponibles dans l'export CSV GovTrack`, le nom exact de la colonne GovTrack n'a pas pu être vérifié directement (site bloquant l'accès automatisé).
- **Contrôle automatique des migrations manquantes** : idée soulevée après la découverte de la migration `035_content_translations.sql` jamais appliquée (saut de numérotation `034`→`036` passé inaperçu plusieurs semaines). Un script/étape CI qui compare les fichiers de migration présents avec ceux réellement appliqués en base éviterait qu'un futur saut de numérotation cause un bug silencieux similaire.
- Pas de révocation globale des sessions admin, `npm audit`/Dependabot à automatiser, comparaison de jeton non "timing-safe" — points de sécurité connus, moyen/bas, non bloquants (voir aussi `README.md`, section Sécurité).

## 🆕 Chantiers ouverts

1. **Italie / Espagne — parlements étrangers** :
   - **Italie (Sénat)** : script d'ingestion écrit et **testé avec succès** (`apps/api/src/scripts/ingest-italy-senate.js`) — 244 sénateurs + 20 votes + 2743 positions individuelles ingérés au deuxième essai réel (composition par groupe vérifiée cohérente avec la réalité politique actuelle). `dati.camera.it` (Chambre) reste bloquée par un CAPTCHA (Cloudflare) même côté serveur — confirmé en testant depuis le conteneur API, pas juste une limitation de mes propres outils. En revanche, `dati.senato.it` (Sénat) répond normalement, **et surtout expose un vrai endpoint SPARQL** (`https://dati.senato.it/sparql`, Virtuoso v6 — assez ancien, ne supporte pas `UNION`+`BIND`, d'où 3 requêtes séparées par vote plutôt qu'une seule). Identifiants numériques stables dans les URI (`http://dati.senato.it/senatore/NNN`), appariement fiable comme pour les États-Unis.
     - **Reste à faire** : route API admin (`/api/admin/ingest/italy-senate`), automatisation mensuelle (GitHub Actions), pages frontend `/international/it/...` (réutilisent déjà les pages génériques existantes), traduction des noms de groupes italiens dans les 8 langues.
     - **Chambre des députés (Camera)** : toujours hors périmètre — sa page de téléchargement classique est bloquée, mais une source tierce mentionne qu'elle aurait aussi un endpoint SPARQL fonctionnel (non vérifié). À explorer si on veut compléter l'Italie avec les deux chambres.
   - **Espagne** : script d'ingestion écrit et **testé avec succès** le 10 août (`apps/api/src/scripts/ingest-spain-congress.js`) — 350 députés + 20 votes ingérés au premier essai réel (après correction d'un piège d'URLs relatives vs absolues dans le HTML). Appariement par nom complet exact (fiable, contrairement au Sénat US). Chambre basse uniquement pour l'instant (Congreso de los Diputados), Sénat espagnol hors périmètre.
     - **Fait le 10 août** : route API admin (`/api/admin/ingest/spain-congress`), automatisation mensuelle (GitHub Actions), Espagne ajoutée aux pays disponibles sur `/international` (pages génériques déjà réutilisables), traduction des 9 groupes parlementaires espagnols dans les 8 langues.
     - **Limitation connue** : la page d'index des votes n'affiche par défaut que la séance la plus récente — pas de vrai historique complet pour l'instant, la navigation par date/séance n'a pas été explorée.
2. **Suggestion utilisateur affichée sur `/international`** pour les pays sans source de données identifiée (russe, japonais, chinois, hindi actuellement listés) : mécanisme de contact déjà en place, mais aucune source n'a encore été proposée/évaluée pour ces pays.

### International — bugs restants

1. **Fiche scrutin US, lien "voir le texte complet"** : renvoie actuellement vers la page de résultats du vote (`source_url`), pas vers le texte du projet de loi lui-même. Voir si Congress.gov/GovTrack exposent un lien direct vers le texte, distinct du lien vers le résultat du vote.
2. **Chiffre "sur l'ensemble des X scrutins de la législature"** : probablement résolu côté US — le chiffre est dynamique (`stats.total`, vraie valeur en base) et reflétait simplement l'ingestion incomplète d'avant le correctif du bug de session (9 août). À reconfirmer côté US maintenant que l'ingestion est complète, **et à vérifier côté France avec une capture d'écran** (le mécanisme est aussi dynamique là-bas, cause du chiffre faux encore incertaine).

### Clarté pédagogique restante — page résumé pays (`/pays/[code]`)

3. **Question de méthodologie à trancher/expliquer** : la comparaison ne risque-t-elle pas d'être biaisée par la taille du pays (France, petit pays, vs États-Unis) ? Par exemple pour le CO2/la pollution, un pays avec une population/économie comparable en taille aux USA consommerait-il proportionnellement autant ? À clarifier dans le texte explicatif (indicateurs déjà par habitant pour certains, à vérifier/préciser lesquels le sont et lesquels ne le sont pas).

### SEO / Google Search Console

5. **Vérifier l'amélioration de l'indexation dans quelques semaines** — le 9 août, Search Console signalait : `www.pasdeplaneteb.com` en 404 (corrigé, redirection Traefik ajoutée), pages `?section=...` vues comme doublons sans canonique (corrigé, balise `<link rel="canonical">` ajoutée), et 12 pages "explorées mais non indexées" (sitemap.xml créé et soumis pour accélérer la ré-exploration). Repasser sur le rapport "Indexation des pages" d'ici 2-3 semaines pour confirmer que ces 3 correctifs ont bien fait effet.

## 💡 Idées en suspens (mentionnées, pas encore engagées)

- Notifications push natives pour l'app mobile (actuellement le suivi de député/élu se fait uniquement par email)
- Stockage externalisé (type S3) à envisager si un jour un vrai upload de fichiers est ajouté (ex. photos pour les pétitions), plutôt que de charger le disque du VPS

---

*Dernière mise à jour : 13 août 2026 — voir aussi la date du dernier commit de ce fichier.*
