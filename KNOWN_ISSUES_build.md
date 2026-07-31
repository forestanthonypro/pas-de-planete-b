# Problème connu — `next build` échoue sur `/404` et `/500`

**Statut** : non résolu, documenté le 31/07/2026, à reprendre plus tard.

## Symptôme

`docker compose exec web npx next build` échoue systématiquement avec :

```
Error: <Html> should not be imported outside of pages/_document.
Error occurred prerendering page "/404" (et "/500", et leurs variantes /fr/, /en/)
```

## Ce qui a été éliminé comme cause (testé et confirmé sans effet)

- Le code du projet : reproduit à l'identique même avec les fichiers `_document.js` et `404.js` remis à leur version par défaut minimale de Next.js.
- La version de Next.js : reproduit sur 14.2.35, 15.5.21, et 16.2.12.
- Turbopack vs Webpack : reproduit avec les deux (`--webpack` inclus).
- Le cache `.next` (volume Docker `web-next-cache`) : reproduit même après suppression complète du volume et réinstallation à neuf.
- `node_modules` (volume `web-node-modules`) : idem.
- La configuration `i18n` dans `next.config.js` : reproduit même avec `i18n` entièrement désactivé.
- `output: "standalone"` : reproduit même désactivé.

## Piste restante, non testée

L'image Docker utilisée (`node:20-alpine`, basée sur `musl libc`) est connue pour causer des incompatibilités subtiles avec certains outils Node.js par rapport à la libc standard (`glibc`). Prochaine étape suggérée : tester avec l'image `node:20` standard (non-alpine) dans `docker-compose.yml`, au moins pour un build de test, afin d'isoler si le problème vient de la libc de l'image.

## Impact réel actuel

**Aucun impact sur le développement local** : `npm run dev` (utilisé par `docker-compose.yml` au quotidien) fonctionne parfaitement, avec ou sans les correctifs de sécurité/UI apportés en parallèle. Seul `next build` (utilisé pour un déploiement de production) échoue.

**Impact réel pour la mise en production** : `docker-compose.prod.yml` utilise des images construites via `docker/build-push-action` en CI (`.github/workflows/ci.yml`), qui lance probablement un `next build` en interne — donc ce problème bloquera potentiellement le déploiement en production tel quel. À vérifier/résoudre avant le premier déploiement réel.

## État du projet pendant l'investigation

Revenu sur `next@14.2.35` / `react@18.3.1` (dernière version patchée de la branche 14, avant sa fin de vie en octobre 2025) après avoir testé sans succès 15.5.21 et 16.2.12. Tous les autres correctifs de sécurité et d'interface faits en parallèle (rate limiting TOTP, Helmet, validation embedUrl, HSTS, bouton retour en haut, protection useT()/LanguageSwitcher contre l'absence de routeur, page 404 personnalisée, getServerSideProps sur les pages dynamiques) sont conservés et fonctionnels, indépendamment de ce bug de build.
