# Problème connu — `next build` échouait sur `/404` et `/500`

**Statut : RÉSOLU (5 août 2026).**

## Symptôme

`next build` échouait systématiquement avec :

```
Error: <Html> should not be imported outside of pages/_document.
Read more: https://nextjs.org/docs/messages/no-document-import-in-page
Error occurred prerendering page "/fr/404". Read more: https://nextjs.org/docs/messages/prerender-error
Export encountered an error on /404: /fr/404, exiting the build.
```

## Cause réelle

**`NODE_ENV` valait `development` au moment d'exécuter `next build`**, hérité de `.env` (utilisé par `docker-compose.yml` pour le mode développement, où `NODE_ENV=development` est correct pour `npm run dev`). Le script `build` du `package.json` ne forçait pas explicitement `NODE_ENV=production`, donc la valeur du `.env` restait active pendant le build de production.

Next.js avertit explicitement de ce risque à chaque exécution (`⚠ You are using a non-standard "NODE_ENV" value in your environment. This creates inconsistencies...`) — un avertissement resté ignoré pendant toute l'investigation car il apparaissait aussi lors de builds qui semblaient par ailleurs fonctionner correctement. Dans ce projet précis, cette incohérence suffisait à casser le pipeline interne de rendu de `_document` : le composant interne `Html` de Next.js s'appuie sur un contexte React (`HtmlContext`) mis en place uniquement par le chemin de rendu prévu pour `_document.js` ; avec `NODE_ENV` incohérent, ce contexte n'était pas correctement propagé lors de l'export statique de `/404` (et `/500`), d'où l'erreur `<Html> should not be imported outside of pages/_document` — un message trompeur, puisque `_document.js` du projet n'a jamais eu de problème réel.

## Correctif

`apps/web/package.json`, script `build` :

```json
"build": "NODE_ENV=production next build"
```

Force `NODE_ENV=production` explicitement, indépendamment de ce que contient `.env` ou l'environnement appelant. Vérifié : le bug est reproductible à volonté en important `NODE_ENV=development` dans l'environnement puis en lançant l'ancien script (`next build` seul), et disparaît totalement avec ce correctif, y compris dans ces conditions.

## Chronologie de l'investigation (pour référence future)

Cette erreur, très générique dans son message, a fait explorer de nombreuses pistes avant de trouver la vraie cause — gardées ici car plusieurs sont des améliorations légitimes par ailleurs, même si elles n'étaient pas LA cause :

- **Versions de Next.js/React/Node** : reproduit à l'identique sur Next 14.2.35 → 16.3.0, React 18.3.1 → 19.2.8, Node 20 → 24. Aucune n'était en cause.
- **`node:20-alpine` (musl) vs `node:20-slim` (glibc)** : la migration vers `node:20-slim` avait semblé résoudre le problème début août (validée sur Next 15.5.22 à l'époque), mais c'était une coïncidence — le vrai facteur n'a jamais été isolé avant cette session.
- **Turbopack vs Webpack** : reproduit avec les deux.
- **Nombre de workers de génération statique** (`experimental.cpus`) : reproduit avec 1 comme avec 7 workers.
- **Bind mount Windows/WSL2 vs système de fichiers natif du conteneur** : reproduit dans les deux cas (testé en copiant le projet hors du bind mount, à l'intérieur du conteneur).
- **Configuration `i18n`** : reproduit avec et sans.
- **`_document.js` avec `getInitialProps`** : reproduit même simplifié au strict minimum.
- **`pages/404.js`** : reproduit même vidé de tout contenu, et même en le supprimant entièrement (`/_error` plantait alors à sa place).

**Deux améliorations de code légitimes faites en cours de route**, conservées bien qu'elles n'aient pas été la cause de ce bug précis :
- `components/Layout.js` : `useRouter()` était appelé à l'intérieur d'un `try/catch`, une violation des Rules of Hooks de React (`react.dev/warnings/invalid-hook-call-warning`) — corrigé en appelant le Hook normalement et en gérant l'absence de routeur après coup.
- `pages/_app.js` + `pages/404.js` : mécanisme `Component.noLayout` ajouté pour permettre à une page de s'exclure explicitement du `Layout` global — cohérent avec l'intention documentée dans `404.js` ("volontairement autonome, pas de Layout"), que `_app.js` ne respectait pas avant ce correctif.

## Leçon retenue

Toujours forcer explicitement `NODE_ENV` dans les scripts `build`/`start` d'un projet Next.js plutôt que de compter sur l'environnement appelant pour avoir la bonne valeur — particulièrement important dans un contexte où le même `.env` sert au développement (`NODE_ENV=development` légitime) et où `next build` peut être invoqué manuellement dans ce même environnement (via `docker compose exec`, par exemple), sans repasser par un pipeline CI qui aurait pu définir la variable correctement de son côté.
