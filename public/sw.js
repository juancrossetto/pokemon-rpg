/* PokeRPG asset worker. No cachea HTML, RSC ni acciones autenticadas. */
/*
  v2 — arregla que los sprites dejaran de verse en el móvil.

  Tres defectos, los tres del mismo camino:

  1. **Se cacheaban respuestas opacas.** Los GIF de batalla (Showdown) y los
     sprites de PokeAPI se piden cross-origin sin CORS, así que la respuesta es
     `opaque`: `status` 0 y `ok` false aunque el servidor haya devuelto 404. Se
     guardaban igual, y como la estrategia era cache-first sin revalidar, un
     404 o un corte de red momentáneo quedaba cacheado **para siempre** en ese
     teléfono. En escritorio no se notaba porque el service worker sólo corre en
     producción.

  2. **La cuota.** Cada respuesta opaca se contabiliza con relleno (~7 MB en
     varios navegadores, tenga el archivo el tamaño que tenga). Un rato de
     juego son cientos de sprites: en iOS, con una cuota de Cache Storage
     bastante chica, se llena rápido. Y cuando se llena, `caches.open` /
     `cache.match` empiezan a fallar.

  3. **Un fallo de caché rompía el pedido entero.** Todo el cuerpo iba dentro de
     `event.respondWith(caches.open(...))`: si esa promesa rechaza —justo lo que
     pasa al llenarse la cuota— el navegador ve la imagen como fallida. Y no
     como un 404, del que el `onError` de `PokemonImage` se recupera cambiando
     de fuente, sino como error de red seco.

  Ahora sólo se cachea lo que se puede leer (`ok` y no opaco), la caché nunca
  puede tumbar un pedido (ante cualquier error se sale por `fetch` pelado) y se
  revalida en segundo plano, así una entrada mala se corrige sola en la visita
  siguiente en vez de quedarse pegada.

  v3 — no interceptar imágenes de otro origen.

  Los sprites de batalla (Showdown) y los HOME de PokeAPI viven en
  `play.pokemonshowdown.com` / `raw.githubusercontent.com`. El worker los
  trataba como `destination: "image"` y los reenviaba con `fetch` no-cors.
  En producción (el SW sólo se registra ahí) Cloudflare/GitHub a veces
  responden opaco o fallan, el worker entrega `Response.error()` y el
  `<img>` queda con el ícono roto + alt ("tentacool", "gyarados"). En local
  no se ve porque NODE_ENV !== production.

  Las miniaturas del party sí funcionan: van por `/_next/image` (mismo
  origen). A partir de v3 el worker sólo toca estáticos propios; el
  navegador pide los CDNs directo, igual que en dev.

  El número de versión importa: es lo que borra la caché envenenada de los
  teléfonos que ya pasaron por v1/v2. Si se vuelve a tocar la estrategia, subirlo.
*/
const VERSION = "pokerpg-static-v3";
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
  // Uno por uno y tolerante a fallos, no `addAll`: con `addAll`, un solo
  // archivo que falle aborta la instalación y el worker viejo sigue
  // controlando la página — o sea, este arreglo nunca llegaría a activarse.
  // `skipWaiting` hace que v3 reemplace v2 sin esperar a cerrar todas las
  // pestañas: si no, los sprites siguen rotos hasta el próximo reload manual.
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(PRECACHE.map((path) => cache.add(path).catch(() => undefined))),
    ).then(() => self.skipWaiting()).catch(() => self.skipWaiting()),
  );
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
  // Sprites de CDNs externos: no pasarlos por el worker. Ver comentario v3.
  if (url.origin !== self.location.origin) return;
  const isStatic =
    request.destination === "image" ||
    request.destination === "audio" ||
    request.destination === "font" ||
    url.pathname.startsWith("/_next/static/");
  if (!isStatic) return;

  event.respondWith(serveStatic(request));
});

async function serveStatic(request) {
  let cache;
  try {
    cache = await caches.open(VERSION);
  } catch {
    // Sin caché disponible (cuota llena, modo privado) el pedido sigue normal.
    return fetch(request);
  }

  let cached;
  try {
    cached = await cache.match(request);
  } catch {
    cached = undefined;
  }

  const fromNetwork = fetch(request)
    .then((response) => {
      // Sólo respuestas legibles: una opaca no deja distinguir un 200 de un
      // 404, y guardarla es lo que dejaba sprites rotos pegados en la caché.
      if (response.ok && response.type !== "opaque") {
        void cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => cached ?? Response.error());

  if (cached) {
    // Stale-while-revalidate: se responde con lo cacheado y se refresca atrás.
    void fromNetwork.catch(() => undefined);
    return cached;
  }
  return fromNetwork;
}
