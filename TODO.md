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
- **Correspondance des sénateurs américains (GovTrack)** : correctif déployé le 10 août (appariement exact par `bioguideId` via la table `congress-legislators`, repli automatique sur nom+état si absent) — **confirmé fonctionnel le 14 août** : colonnes de l'export CSV GovTrack `person, state, district, vote, name, party` (la colonne `person` existe bien), et surtout **99/100 sénateurs appariés** sur les votes récemment traités (quasi-parfait, contre ~97% approximatif avant). ✅ Résolu.
- **Contrôle automatique des migrations manquantes** : idée soulevée après la découverte de la migration `035_content_translations.sql` jamais appliquée (saut de numérotation `034`→`036` passé inaperçu plusieurs semaines). Un script/étape CI qui compare les fichiers de migration présents avec ceux réellement appliqués en base éviterait qu'un futur saut de numérotation cause un bug silencieux similaire.
- Pas de révocation globale des sessions admin, `npm audit`/Dependabot à automatiser, comparaison de jeton non "timing-safe" — points de sécurité connus, moyen/bas, non bloquants (voir aussi `README.md`, section Sécurité).

## 🆕 Chantiers ouverts

1. **Italie / Espagne — parlements étrangers** — les 6 chambres sont opérationnelles en production, volume de votes augmenté et bug de traduction corrigé (session du 13 août, soir) :

   **✅ Complètement à jour** :
   - **Italie, Chambre des députés** (`ingest-italy-camera.js`) — 399 députés + **200 votes** (limite augmentée de 20 à 200, testé : ~6min22s en local, confortable sous la limite CI/CD de 10min).
   - **Italie, Sénat** (`ingest-italy-senate.js`) — 244 sénateurs + **200 votes**, confirmé en local **et en production** (14 août). Correctif de casse confirmé des deux côtés (`SELECT DISTINCT result` n'affiche plus que `Approvato`/`Respinto`, en majuscule). 32/200 votes ont un résultat `NULL` (~16%) : légitime, certains votes procéduraux n'ont pas de champ `esito` renseigné côté Sénat lui-même, pas un bug de notre ingestion.
   - **Espagne, Sénat** (`ingest-spain-senate.js`) — 265 sénateurs + **161 votes** (15 séances au lieu de 3). Committé et déployé en production via `refresh-spain-senate-prod.ps1`.
   - **Espagne, Congreso de los Diputados** (`ingest-spain-congress.js`) — 350 députés + 20 votes.

   **🔴 Limite connue et non résolue — Espagne, Congreso** (nombre de votes) :
   - Reste à 20 votes (législature courante uniquement), contrairement aux autres chambres. La page `/opendata/votaciones` n'expose ni pagination ni export en masse pour la législature en cours — confirmé par un développeur tiers ayant buté sur le même problème (dépôt GitHub `slopezmenend/civis-api`).
   - Un sélecteur de législature existe (`_votaciones_legislatura`, valeurs XV à X) mais **fonctionne uniquement côté JavaScript** (appel AJAX déclenché après chargement de page) — testé et confirmé : le paramètre d'URL `?currentLegislatura=XIV` n'a aucun effet sur le HTML brut renvoyé par le serveur (mêmes 20 votes qu'avec XV). Un simple `fetch()` ne peut donc pas l'exploiter.
   - **Pour aller plus loin, il faudrait un navigateur automatisé** (Puppeteer/Playwright) capable d'exécuter le JavaScript de la page — une brique d'infrastructure nouvelle pour le projet, non mise en place. Décision prise le 13 août : ne pas engager ce chantier pour l'instant, rester à 20 votes pour cette chambre.

   **⚠️ Espagne, Sénat — automatisation mensuelle manuelle requise** (à cause du blocage réseau, indépendant du point ci-dessus) :
   - `senado.es` bloque (403 Forbidden, Akamai) toute requête venant d'une adresse IP de datacenter — VPS **et** GitHub Actions (Microsoft Azure) sont concernés. Aucune IP de datacenter/cloud testée n'a fonctionné (VPS direct, Cloudflare Workers) — seule une connexion résidentielle passe.
   - **Solution en place et testée avec succès le 13 août** : script `refresh-spain-senate-prod.ps1` (racine du dépôt), à lancer **une fois par mois** depuis un PC avec une connexion résidentielle normale. Entièrement automatique une fois lancé (authentification par clé SSH dédiée `~/.ssh/pdpb_auto`, sans phrase secrète). Voir `README.md`, section "Maintenance mensuelle", pour la procédure complète.

   **Point d'infrastructure découvert en passant** : l'API de production répond sur `https://api.pasdeplaneteb.com`, **pas** sur `https://pasdeplaneteb.com/api/...` (sous-domaine dédié, pas un chemin) — à garder en tête pour toute commande `curl` manuelle future.

2. **Suggestion utilisateur affichée sur `/international`** pour les pays sans source de données identifiée (russe, japonais, chinois, hindi actuellement listés) : mécanisme de contact déjà en place, mais aucune source n'a encore été proposée/évaluée pour ces pays.

### International — bugs restants

1. ~~Fiche scrutin US, lien "voir le texte complet"~~ — **résolu et confirmé le 14 août** (`ingest-us-congress.js`) : construit maintenant un vrai lien vers la page du texte de loi sur Congress.gov (`https://www.congress.gov/bill/{congress}th-congress/{type}/{numéro}`, ex. `.../house-bill/8595`, `.../house-concurrent-resolution/89`), vérifié sur les votes fraîchement ingérés. Repli sur l'ancien lien si aucun numéro de loi n'est associé au vote (motions procédurales).
2. ~~Chiffre "sur l'ensemble des X scrutins de la législature"~~ — **résolu**, confirmé le 14 août : 8434 scrutins en base pour la législature 17, période du 8 octobre 2024 au 21 juillet 2026 sans trou apparent, cohérent avec le commentaire du code ("8000+ scrutins"). Le mécanisme (`SELECT COUNT(*) FROM scrutins WHERE legislature = 17`) est simple et fiable ; le chiffre erroné observé auparavant était bien lié à l'ingestion incomplète déjà corrigée le 9 août, rien de spécifique à la France.

### Clarté pédagogique restante — page résumé pays (`/pays/[code]`)

3. **Question de méthodologie à trancher/expliquer** : la comparaison ne risque-t-elle pas d'être biaisée par la taille du pays (France, petit pays, vs États-Unis) ? Par exemple pour le CO2/la pollution, un pays avec une population/économie comparable en taille aux USA consommerait-il proportionnellement autant ? À clarifier dans le texte explicatif (indicateurs déjà par habitant pour certains, à vérifier/préciser lesquels le sont et lesquels ne le sont pas).

### SEO / Google Search Console

5. **Vérifier l'amélioration de l'indexation dans quelques semaines** — le 9 août, Search Console signalait : `www.pasdeplaneteb.com` en 404 (corrigé, redirection Traefik ajoutée), pages `?section=...` vues comme doublons sans canonique (corrigé, balise `<link rel="canonical">` ajoutée), et 12 pages "explorées mais non indexées" (sitemap.xml créé et soumis pour accélérer la ré-exploration). Repasser sur le rapport "Indexation des pages" d'ici 2-3 semaines pour confirmer que ces 3 correctifs ont bien fait effet.

## 💡 Idées en suspens (mentionnées, pas encore engagées)

- Notifications push natives pour l'app mobile (actuellement le suivi de député/élu se fait uniquement par email)
- Stockage externalisé (type S3) à envisager si un jour un vrai upload de fichiers est ajouté (ex. photos pour les pétitions), plutôt que de charger le disque du VPS

---

*Dernière mise à jour : 13 août 2026 (soir) — voir aussi la date du dernier commit de ce fichier.*
