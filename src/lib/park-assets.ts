import { officialArtworkUrl } from "@/lib/sprites";

/** PNG/JPG estáticos bajo `/public/park` — NPCs, rodillos, íconos de tab. */
export const PARK_STATIC_ASSETS = [
  "/park/hero.jpg",
  "/park/fisher.png",
  "/park/gardener.png",
  "/park/mine/miner.png",
  "/park/mine/empty.png",
  "/park/mine/rock.png",
  "/park/wonder/scientist.png",
  "/park/daycare/breeder.png",
  "/park/corner/host.png",
  "/park/corner/ball.png",
  "/park/corner/berry.png",
  "/park/corner/star.png",
  "/park/corner/seven.png",
  "/park/tabs/corner.png",
  "/park/tabs/mine.png",
  "/park/tabs/fishing.png",
  "/park/tabs/wonder.png",
  "/park/tabs/farm.png",
  "/park/tabs/daycare.png",
  "/park/frontier/rizzo.png",
  "/park/frontier/palace.png",
  "/park/frontier/dome.png",
] as const;

/** Arte que cada minijuego muestra al entrar — se precalienta al hover/focus del tab. */
export const PARK_TAB_ASSETS: Record<string, readonly string[]> = {
  corner: [
    "/park/corner/host.png",
    "/park/corner/ball.png",
    "/park/corner/berry.png",
    "/park/corner/star.png",
    "/park/corner/seven.png",
  ],
  mine: ["/park/mine/miner.png", "/park/mine/empty.png", "/park/mine/rock.png"],
  fishing: ["/park/fisher.png"],
  wonder: ["/park/wonder/scientist.png"],
  farm: ["/park/gardener.png"],
  daycare: ["/park/daycare/breeder.png"],
  frontier: ["/park/frontier/rizzo.png", "/park/frontier/palace.png", "/park/frontier/dome.png"],
};

const warmed = new Set<string>();

/** Precalienta URLs en la caché HTTP del navegador (best-effort, deduplicado por pestaña). */
export function warmAssetCache(urls: Iterable<string>) {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (!url || warmed.has(url)) continue;
    warmed.add(url);
    const img = new window.Image();
    img.decoding = "async";
    img.src = url;
  }
}

export function warmParkStaticAssets() {
  warmAssetCache(PARK_STATIC_ASSETS);
}

export function warmParkTabAssets(tab: string) {
  const urls = PARK_TAB_ASSETS[tab];
  if (urls) warmAssetCache(urls);
}

/** Sprites de official-artwork que usan fragmentos y capturas del parque. */
export function warmSpeciesSprites(speciesIds: Iterable<number>) {
  const urls: string[] = [];
  for (const id of speciesIds) {
    if (!Number.isFinite(id) || id <= 0) continue;
    urls.push(officialArtworkUrl(id));
  }
  warmAssetCache(urls);
}
