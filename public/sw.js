/* PokeRPG asset worker. No cachea HTML, RSC ni acciones autenticadas. */
const VERSION = "pokerpg-static-v1";
const PRECACHE = [
  "/logo.png",
  "/loaders/pokeball-loader-transparent.webp",
  "/audio/battle/wild-battle.m4a",
  "/audio/battle/boss-battle.m4a",
  "/audio/battle/victory.m4a",
  "/audio/battle/sfx/hit.wav",
  "/audio/battle/sfx/damage.wav",
  "/audio/battle/sfx/heal.wav",
  "/audio/battle/sfx/faint.wav",
  "/audio/battle/sfx/sendOut.wav"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("pokerpg-static-") && key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode === "navigate") return;
  const url = new URL(request.url);
  const isStatic =
    request.destination === "image" ||
    request.destination === "audio" ||
    request.destination === "font" ||
    (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"));
  if (!isStatic) return;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      const fresh = fetch(request).then((response) => {
        if (response.ok || response.type === "opaque") void cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || fresh;
    }),
  );
});
