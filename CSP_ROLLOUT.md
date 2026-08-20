# Déploiement progressif de la Content Security Policy

## État livré

La politique est envoyée avec `Content-Security-Policy-Report-Only`. Elle
signale ce qu'elle aurait bloqué, mais ne bloque aucune ressource. Ne pas
renommer cet en-tête en `Content-Security-Policy` avant la fin de la recette.

Les violations sont reçues par `POST https://api.pasdeplaneteb.com/api/csp-report`
et apparaissent dans les logs API sous la forme `CSP_VIOLATION {...}`.

## Vérification après déploiement

1. Vérifier l'en-tête :

   ```sh
   curl -I https://pasdeplaneteb.com
   ```

2. Surveiller les rapports pendant au moins 7 jours :

   ```sh
   docker compose -f docker-compose.prod.yml logs api | grep CSP_VIOLATION
   ```

3. Parcourir au minimum, sur ordinateur et mobile :

   - accueil et changement de langue ;
   - cartes OpenStreetMap (énergie, incendies, ressources, fiches pays) ;
   - graphiques et fiches pays ;
   - vidéos YouTube et podcasts Spotify/Apple ;
   - kit de communication et son iframe API ;
   - connexion, navigation, édition et déconnexion administrateur ;
   - formulaire de contact, newsletter, votes et propositions ;
   - mode application/PWA et écran de démarrage ;
   - suivi Matomo sur `stats.pasdeplaneteb.com`.

4. Dans les outils de développement du navigateur, rechercher
   `Content Security Policy` dans la console et contrôler l'onglet Réseau.

## Passage en mode bloquant

Après une période sans violation légitime inexpliquée, remplacer uniquement
la clé `Content-Security-Policy-Report-Only` par `Content-Security-Policy` dans
`apps/web/next.config.js`, redéployer, puis refaire toute la recette.

`'unsafe-inline'` reste provisoirement nécessaire pour les scripts d'amorçage
Next.js, Matomo et les nombreux styles React inline. Une étape ultérieure peut
introduire des nonces pour les scripts, puis migrer les styles inline vers des
classes afin de retirer ces exceptions.
