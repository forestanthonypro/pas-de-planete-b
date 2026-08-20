# Notifications push — installation et exploitation

## Fonctionnement

- Web Push standard + VAPID, compatible PWA Android/ordinateur et PWA ajoutée à l'écran d'accueil sur iOS/iPadOS.
- Préférences anonymes propres à chaque appareil, protégées par un jeton aléatoire stocké haché en base.
- Ciblage par `scope_codes` pour pétitions, débunks, idées et « On devient tous paysans ».
- Ciblage individuel des députés français et des élus internationaux.
- Événements créés transactionnellement par PostgreSQL au premier passage brouillon → publié ou lors de l'insertion d'un vote.
- Envoi asynchrone par worker, déduplication SQL, verrouillage `SKIP LOCKED`, reprises exponentielles et révocation sur HTTP 404/410.
- Traduction : langue de l'appareil → anglais. Le contenu source français n'est utilisé que pour la locale `fr`.

## Installation locale

Après extraction du ZIP à la racine du dépôt :

```powershell
docker compose down
docker compose up -d
docker compose exec api npm test
docker compose exec web npm run lint
docker compose exec web npm run build
```

La migration `051_push_notifications.sql` doit être appliquée avec le même mécanisme que les migrations existantes du projet.

## Clés VAPID

Générer une paire une seule fois :

```powershell
docker compose run --rm api npx web-push generate-vapid-keys
```

Ajouter dans le `.env` local et celui du VPS :

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@pasdeplaneteb.com
```

La clé privée ne doit jamais être committée. Ne pas régénérer la paire après mise en service : les abonnements existants deviendraient inutilisables.

## Déploiement

```bash
git pull --ff-only origin main
docker compose -f docker-compose.prod.yml pull
# appliquer la migration 051 avec la procédure habituelle
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f notifications-worker
```

Vérifications :

```bash
curl -s https://api.pasdeplaneteb.com/api/push/public-key
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --since=10m notifications-worker
```

La page utilisateur est `/notifications`. Sur iPhone/iPad, le site doit être ajouté à l'écran d'accueil avant la demande d'autorisation.

## Règles éditoriales

- Une portée vide n'envoie aucune notification ciblée.
- Pour une diffusion mondiale, sélectionner explicitement `WORLD` dans l'administration.
- La première publication crée l'événement ; dépublier puis republier ne renvoie pas la même notification.
- Une traduction absente utilise l'anglais. Si l'anglais éditorial est également absent, le worker envoie un libellé anglais générique sans exposer le texte français.

## Limites et prochaine étape

La page `/notifications` gère les sujets géographiques. Les boutons « suivre les notifications push de cet élu » pourront appeler les mêmes routes avec `deputy_uid` ou `member_id`; le backend et les événements de votes sont déjà prévus par cette livraison.
