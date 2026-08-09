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

### Navigation / général

4. **Bouton ou pictogramme "Accueil"** — actuellement pas de retour rapide à la page d'accueil depuis les pages profondes du site.
5. **Page d'accueil, section Démocratie** : remplacer le libellé "Démocratie (France)" par simplement "Démocratie" (la carte mène désormais au hub France, pas directement aux pages françaises — le "(France)" n'a plus lieu d'être vu le sélecteur de pays disponible séparément).

### International — bugs et textes incorrects

6. **Fiche scrutin US, lien "voir le texte complet"** : renvoie actuellement vers la page de résultats du vote (`source_url`), pas vers le texte du projet de loi lui-même. Voir si Congress.gov/GovTrack exposent un lien direct vers le texte, distinct du lien vers le résultat du vote.
7. **Texte "sur le site de l'Assemblée nationale"** affiché à tort sur les fiches de scrutin internationales (US notamment) — texte copié depuis la version française sans être adapté au pays.
8. **Chiffre "sur l'ensemble des 362 scrutins de la législature"** : faux à la fois pour la France et pour les États-Unis (nombre codé en dur, ne reflète pas le vrai total actuel dans aucun des deux cas) — recalculer dynamiquement depuis la base plutôt que d'afficher une valeur figée.
9. **Traduire les résultats de vote** ("Passed", "Failed", "Agreed to", "Elected Speaker name"...) dans les 8 langues, **y compris en français** — actuellement affichés tels quels en anglais, non traduits nulle part.

### Bugs mobile — page résumé pays (`/pays/[code]`)

10. **Section biodiversité plante sur mobile.**
11. **Carte des incendies plante aussi sur mobile** (distinct du bug desktop déjà corrigé le 8 août — celui-ci semble spécifique au mobile).

### Clarté pédagogique — page résumé pays (`/pays/[code]`)

Plusieurs textes/explications à reformuler pour être compréhensibles par quelqu'un sans bagage technique :

12. **Carte résumé pays sur la page d'accueil** : la description ("voir un résumé", comparaison mondiale et avec un pays) est mal formulée, à clarifier.
13. **Phrase "La couleur identifie le pays (voir la légende au-dessus du graphique), rien d'autre — elle ne veut jamais dire bon ou mauvais"** : mal dite, à reformuler.
14. **"Chaque métrique est ramenée à un indice où 100 = moyenne mondiale"** : préciser que cette explication concerne uniquement le premier graphique (comparaison mondiale), pas les graphiques suivants qui ont chacun leur propre échelle/logique.
15. **Stress hydrique** : explication trop technique, à simplifier pour un non-initié complet.
16. **Déforestation, indice "60% de la moyenne mondiale"** : incompréhensible pour un novice tel quel — envisager une comparaison au pays lui-même (évolution dans le temps) plutôt qu'à une moyenne mondiale abstraite, ou en tout cas mieux expliquer pourquoi "60".
17. **Espèces menacées, "0,66% du total mondial"** : la ligne de référence à 100% (utilisée pour les autres métriques) n'a pas de sens ici et prête à confusion — à clarifier ou retirer cette référence pour cette ligne spécifique.
18. **Graphique CO2** : ni la courbe bleue ni l'orange ne sont clairement identifiées/expliquées — clarifier ce que chacune représente.
19. **Tableau de comparaison mondiale (7 rubriques)** : l'année de référence des données n'est indiquée nulle part.
20. **Question de méthodologie à trancher/expliquer** : la comparaison ne risque-t-elle pas d'être biaisée par la taille du pays (France, petit pays, vs États-Unis) ? Par exemple pour le CO2/la pollution, un pays avec une population/économie comparable en taille aux USA consommerait-il proportionnellement autant ? À clarifier dans le texte explicatif (indicateurs déjà par habitant pour certains, à vérifier/préciser lesquels le sont et lesquels ne le sont pas).
21. **"Total Mt"** : préciser que "Mt" signifie mégatonnes (million de tonnes) — pas évident pour tout le monde.

## 💡 Idées en suspens (mentionnées, pas encore engagées)

- Notifications push natives pour l'app mobile (actuellement le suivi de député/élu se fait uniquement par email)
- Stockage externalisé (type S3) à envisager si un jour un vrai upload de fichiers est ajouté (ex. photos pour les pétitions), plutôt que de charger le disque du VPS

---

*Dernière mise à jour : 9 août 2026 — voir aussi la date du dernier commit de ce fichier.*
