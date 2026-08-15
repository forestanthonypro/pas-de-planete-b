// Service worker minimal, écrit à la main (pas de Workbox ni autre
// librairie — cohérent avec l'écoconception du projet).
//
// IMPORTANT : incrémenter CACHE_NAME à chaque modification de ce fichier
// (v2, v3...) — c'est ce qui déclenche le nettoyage automatique de
// l'ancien cache à l'activation. L'oubli de ce détail (nom figé sur
// "pdpb-cache-v1" depuis la création) combiné à la stratégie de cache
// d'avant (voir plus bas) est ce qui a rendu le site coincé sur d'anciens
// fichiers JS pendant des heures de débogage le 9 août 2026, malgré
// rechargements forcés et vidage de cache navigateur.
//
// self.skipWaiting() retiré le 15 août 2026 — volontairement. Il forçait
// un nouveau service worker à prendre le contrôle de la page **en cours
// de chargement**, pas seulement des visites suivantes. Sur une toute
// première visite (aucun service worker actif au départ — exactement ce
// que mesure l'audit EcoIndex en CI, et ce que vit un vrai premier
// visiteur), ça provoquait un double téléchargement de chaque fichier
// JS/JSON encore en cours de chargement au moment de l'activation : une
// fois via le chargement normal de la page, une seconde fois via le
// service worker qui interceptait et refaisait la requête lui-même —
// visible dans DevTools comme deux entrées réseau par fichier, l'une avec
// pour initiateur le tag <script>, l'autre "sw.js". Ce doublement a fait
// chuter l'EcoIndex du site de A à C (84 requêtes mesurées au lieu de
// ~40-45 attendues). Sans skipWaiting(), un nouveau service worker
// attend la prochaine navigation pour prendre le contrôle — comportement
// standard des navigateurs, qui évite ce doublement. Le nettoyage de
// cache versionné ci-dessous (CACHE_NAME) reste suffisant à lui seul pour
// éviter que du contenu périmé reste servi indéfiniment aux visiteurs
// récurrents — ce n'était pas skipWaiting() qui réglait ce problème-là.
const CACHE_NAME = "pdpb-cache-v3";
const PRECACHE_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jamais de cache pour l'API : les chiffres doivent toujours être à jour.
  if (url.pathname.startsWith("/api/")) return;

  // Fichiers Next.js à nom hashé (/_next/static/...) : le hash change dès
  // que le contenu change, donc une même URL ne pointe JAMAIS vers un
  // contenu périmé — cache agressif sans risque (cache d'abord, réseau en
  // secours uniquement si absent du cache).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Pour tout le reste (pages HTML, manifest, icônes...) : réseau en
  // priorité pour garantir la fraîcheur — le cache ne sert que de secours
  // hors-ligne, jamais servi en premier si le réseau répond. C'est
  // l'inverse de l'ancienne stratégie ("cache d'abord, mise à jour
  // silencieuse en arrière-plan"), qui obligeait à recharger deux fois
  // pour voir un changement.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
