# TODO — Pas de planète B

Document de suivi des chantiers en attente, à garder à jour d'une session à l'autre.

---

## 🔴 Bloquant / infrastructure

- **Redirection du domaine secondaire `.fr` vers le `.com`** : tentée le 6 août, bloquée — impossible de modifier le DNS de ce domaine pour le moment côté hébergeur d'origine. La config Traefik pour cette redirection (routeur + middleware `redirectregex`) a été préparée mais volontairement pas commitée (aurait fait échouer l'obtention du certificat Let's Encrypt tant que le DNS ne pointe pas vers le VPS). À refaire dès que la modification DNS du `.fr` redevient possible.
- **Transfert de domaine en attente (règle des 60 jours ICANN)** : initié le 6 août 2026, se terminera automatiquement autour du **4-5 octobre 2026**. En attendant, la zone DNS active est celle du registrar d'origine (TTL réduit à 300s pour cette période transitoire).
  - **À faire début octobre 2026** : vérifier que le nouveau registrar prend bien le relais avec les mêmes enregistrements, confirmer la continuité de service.
- **Vérification de domaine Brevo** : toujours à faire sur le domaine définitif. Attendre si possible la fin du transfert de domaine pour éviter de configurer ça deux fois.
  - Alternative temporaire pour tester le circuit : une adresse Gmail personnelle comme expéditeur (pas `ik.me`, bloqué par sa politique DMARC).

## 🟡 Pull requests Dependabot en attente

- **Sans risque, à fusionner quand tu veux** : `express-rate-limit`, `helmet`, les paquets Capacitor, les actions GitHub.
- **À vérifier avant de fusionner** : `csv-parse` (5.6 → 7.0, deux versions majeures), `adm-zip` (0.5.18 → 0.6.0).
- **À fermer sans fusionner** (déjà testées, cassent le projet) : ESLint 8.57/9.39 → 10.8.0 (incompatibilité confirmée avec `eslint-config-next`).

## 🟢 Dette technique / suivi

- **Revérifier l'application mobile (Capacitor)** — plusieurs montées de version importantes ont eu lieu depuis le dernier test (Next.js 16, React 19, Express 5, ESLint 9, refactor complet de l'API + ajout de la fonctionnalité internationale). À valider concrètement sur un vrai appareil/émulateur.
- **Correspondance des sénateurs américains (GovTrack) fragile** : rattachée par nom + État plutôt que par identifiant fiable (GovTrack utilise un ID interne, pas le `bioguideId` de Congress.gov). ~97% de correspondance en pratique, mais un raffinement futur possible : importer aussi le `bioguideId` via le dépôt GitHub `congress-legislators` pour un lien exact.
- **Contrôle automatique des migrations manquantes** : idée soulevée après la découverte de la migration `035_content_translations.sql` jamais appliquée (saut de numérotation `034`→`036` passé inaperçu plusieurs semaines). Un script/étape CI qui compare les fichiers de migration présents avec ceux réellement appliqués en base éviterait qu'un futur saut de numérotation cause un bug silencieux similaire.
- **Repasser sur tout le contenu déjà "traduit" avant le 8 août 2026** (débunk, interviews, paysans, ressources, charte, idées enfants) — la table `content_translations` n'a jamais existé avant cette date (migration manquante), donc toute traduction censée avoir été enregistrée avant a probablement échoué silencieusement. Relancer la traduction automatique (bouton admin) sur chacun.
- **Newsletter sans double opt-in RGPD** — contrairement au suivi de député/élu, qui l'a. Non bloquant, le texte de la politique de confidentialité reste honnête sur l'état actuel, mais à corriger pour aligner le comportement réel sur les bonnes pratiques.
- **Désabonnement newsletter sans jeton de vérification**, pas de révocation globale des sessions admin, `npm audit`/Dependabot à automatiser, comparaison de jeton non "timing-safe" — points de sécurité connus, moyen/bas, non bloquants (voir aussi `README.md`, section Sécurité).

## 🆕 Chantiers ouverts

1. **Italie / Espagne — parlements étrangers** : sources de données officielles identifiées (`dati.camera.it` pour l'Italie, `congreso.es/es/datos-abiertos` pour l'Espagne, formats confirmés compatibles avec le schéma générique `parliament_*`), mais ingestion pas commencée — mis de côté volontairement pour se concentrer sur les États-Unis d'abord. Le gros du travail (schéma, routes API génériques, pages, vote citoyen, suivi email) est déjà réutilisable tel quel ; il ne reste que l'ingestion spécifique à chaque pays à écrire.
2. **Vérifier l'issue de la demande de réexamen Google Safe Browsing** — la page `/admin` avait été flaguée "page trompeuse" ; correctif (`robots.txt` + `noindex`) déployé et réexamen demandé le 8 août. Confirmer que le bandeau "Site dangereux" a bien disparu dans Chrome.
3. **Suggestion utilisateur affichée sur `/international`** pour les pays sans source de données identifiée (russe, japonais, chinois, hindi actuellement listés) : mécanisme de contact déjà en place, mais aucune source n'a encore été proposée/évaluée pour ces pays.

### International — bugs restants

1. **Fiche scrutin US, lien "voir le texte complet"** : renvoie actuellement vers la page de résultats du vote (`source_url`), pas vers le texte du projet de loi lui-même. Voir si Congress.gov/GovTrack exposent un lien direct vers le texte, distinct du lien vers le résultat du vote.
2. **Chiffre "sur l'ensemble des X scrutins de la législature"** : probablement résolu côté US — le chiffre est dynamique (`stats.total`, vraie valeur en base) et reflétait simplement l'ingestion incomplète d'avant le correctif du bug de session (9 août). À reconfirmer côté US maintenant que l'ingestion est complète, **et à vérifier côté France avec une capture d'écran** (le mécanisme est aussi dynamique là-bas, cause du chiffre faux encore incertaine).

### Clarté pédagogique restante — page résumé pays (`/pays/[code]`)

3. **Carte résumé pays sur la page d'accueil** : la description ("voir un résumé", comparaison mondiale et avec un pays) est mal formulée, à clarifier.
4. **Graphique CO2** : ni la courbe bleue ni l'orange ne sont clairement identifiées/expliquées — clarifier ce que chacune représente.
5. **Tableau de comparaison mondiale (7 rubriques)** : l'année de référence des données n'est indiquée nulle part.
6. **Question de méthodologie à trancher/expliquer** : la comparaison ne risque-t-elle pas d'être biaisée par la taille du pays (France, petit pays, vs États-Unis) ? Par exemple pour le CO2/la pollution, un pays avec une population/économie comparable en taille aux USA consommerait-il proportionnellement autant ? À clarifier dans le texte explicatif (indicateurs déjà par habitant pour certains, à vérifier/préciser lesquels le sont et lesquels ne le sont pas).

### Technique

7. **Service worker résistant au cache-busting normal** — pendant le débogage du 9 août, un service worker actif a continué à servir d'anciens fichiers JS malgré `docker compose --force-recreate`, vidage de `.next/cache`, fermeture/réouverture d'onglet, et même "Unregister" manuel (il se réenregistre aussitôt). Seule la navigation privée (sans service worker préexistant) contournait le problème de façon fiable. À revoir : la stratégie de cache du service worker (`public/sw.js`) devrait normalement versionner son cache et s'auto-remplacer proprement à chaque nouveau déploiement (`skipWaiting()` + `clients.claim()` + invalidation du cache par version), sans qu'un `Unregister` manuel soit nécessaire ni même suffisant.

### SEO / Google Search Console

8. **Vérifier l'amélioration de l'indexation dans quelques semaines** — le 9 août, Search Console signalait : `www.pasdeplaneteb.com` en 404 (corrigé, redirection Traefik ajoutée), pages `?section=...` vues comme doublons sans canonique (corrigé, balise `<link rel="canonical">` ajoutée), et 12 pages "explorées mais non indexées" (sitemap.xml créé et soumis pour accélérer la ré-exploration). Repasser sur le rapport "Indexation des pages" d'ici 2-3 semaines pour confirmer que ces 3 correctifs ont bien fait effet.

## 💡 Idées en suspens (mentionnées, pas encore engagées)

- Notifications push natives pour l'app mobile (actuellement le suivi de député/élu se fait uniquement par email)
- Stockage externalisé (type S3) à envisager si un jour un vrai upload de fichiers est ajouté (ex. photos pour les pétitions), plutôt que de charger le disque du VPS

---

*Dernière mise à jour : 9 août 2026 (fin de session) — voir aussi la date du dernier commit de ce fichier.*
