// Service worker minimal, écrit à la main (pas de Workbox ni autre
// librairie — cohérent avec l'écoconception du projet). Stratégie simple :
// les pages/assets statiques sont mis en cache pour un chargement plus
// rapide et un usage hors-ligne partiel ; les appels à l'API restent
// toujours en réseau (les données doivent rester à jour, jamais servies
// depuis un cache périmé).

const CACHE_NAME = "pdpb-cache-v1";
const PRECACHE_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
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

  // Pour le reste (pages, scripts, styles) : cache d'abord, réseau en secours,
  // et on met à jour le cache silencieusement en arrière-plan.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
