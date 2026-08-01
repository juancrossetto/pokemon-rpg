/** Map asset registry. Missing files fall back to the shared Kanto overview. */

const FALLBACK_MAP = "/gyms/maps/kanto-lgpe.png";

export type CampaignBannerArt = {
  src: string;
  /** CSS object-position — ancla sujetos dentro del crop del hero. */
  objectPosition: string;
};

const CHAPTER_BANNER_COUNT = 9;

/**
 * Banner del hero: uno por capítulo/etapa (01 Plateada … 09 Alto Mando).
 * Arte en `public/campaign/banners/chapter-NN.png`.
 */
export function campaignBannerForChapter(
  chapterNumber: number | null | undefined,
): CampaignBannerArt {
  const n = Math.min(
    CHAPTER_BANNER_COUNT,
    Math.max(1, Math.floor(chapterNumber ?? 1)),
  );
  const pad = String(n).padStart(2, "0");
  return {
    src: `/campaign/banners/chapter-${pad}.png`,
    objectPosition: "50% 50%",
  };
}

const DEFAULT_BANNER_ART: CampaignBannerArt = campaignBannerForChapter(1);

/**
 * Arte local por zona (thumbnails del recorrido).
 * Solo ids con archivo real en `public/campaign/maps/…`.
 *
 * Nota i18n ES: "Azulona" = Celadon, "Celeste" = Cerulean, "Carmesí" = Vermilion.
 */
const LOCATION_MAPS: Record<string, string> = {
  // Plateada (Pewter) — cap. 1
  "pallet-town": "/campaign/maps/kanto/pallet-town.png",
  "route-1": "/campaign/maps/kanto/route-1.png",
  "viridian-city": "/campaign/maps/kanto/viridian-city.png",
  "route-2": "/campaign/maps/kanto/route-2.png",
  "viridian-forest": "/campaign/maps/kanto/viridian-forest.png",
  "pewter-city": "/campaign/maps/kanto/pewter-city.png",
  "pewter-gym": "/campaign/maps/kanto/pewter-gym.png",
  // Celeste (Cerulean)
  "route-3": "/campaign/maps/kanto/route-3.png",
  "mt-moon": "/campaign/maps/kanto/mt-moon.png",
  "cerulean-city": "/campaign/maps/kanto/cerulean-city.png",
  "cerulean-gym": "/campaign/maps/kanto/cerulean-gym.png",
  // Carmesí (Vermilion)
  "route-5": "/campaign/maps/kanto/route-5.png",
  "vermilion-city": "/campaign/maps/kanto/vermilion-city.png",
  "vermilion-gym": "/campaign/maps/kanto/vermilion-gym.png",
  // Azulona (Celadon)
  "route-11": "/campaign/maps/kanto/route-11.png",
  "rock-tunnel": "/campaign/maps/kanto/rock-tunnel.png",
  "lavender-town": "/campaign/maps/kanto/lavender-town.png",
  "route-8": "/campaign/maps/kanto/route-8.png",
  "celadon-city": "/campaign/maps/kanto/celadon-city.png",
  "celadon-gym": "/campaign/maps/kanto/celadon-gym.png",
  // Fucsia (Fuchsia)
  "route-16": "/campaign/maps/kanto/route-16.png",
  "fuchsia-city": "/campaign/maps/kanto/fuchsia-city.png",
  "fuchsia-gym": "/campaign/maps/kanto/fuchsia-gym.png",
  // Azafrán (Saffron)
  "route-15": "/campaign/maps/kanto/route-15.png",
  "saffron-city": "/campaign/maps/kanto/saffron-city.png",
  "saffron-gym": "/campaign/maps/kanto/saffron-gym.png",
  // Canela (Cinnabar)
  "route-19": "/campaign/maps/kanto/route-19.png",
  "cinnabar-island": "/campaign/maps/kanto/cinnabar-island.png",
  "cinnabar-gym": "/campaign/maps/kanto/cinnabar-gym.png",
  // Verde gym (Viridian) — cap. 8
  "route-21": "/campaign/maps/kanto/route-21.png",
  "viridian-gym": "/campaign/maps/kanto/viridian-gym.png",
  // Alto Mando — arte panorámico (full-bleed en la card)
  "victory-road": "/campaign/maps/kanto/victory-road.png",
  "indigo-plateau": "/campaign/maps/kanto/indigo-plateau.png",
  "elite-lorelei": "/campaign/maps/kanto/elite-lorelei.png",
  "elite-bruno": "/campaign/maps/kanto/elite-bruno.png",
  "elite-agatha": "/campaign/maps/kanto/elite-agatha.png",
  "elite-lance": "/campaign/maps/kanto/elite-lance.png",
  "champion": "/campaign/maps/kanto/champion.png",
};

/** Zonas cuyo arte es panorámico: llena toda la card (no strip izquierdo). */
const WIDE_STAGE_ART = new Set<string>([
  "victory-road",
  "indigo-plateau",
  "elite-lorelei",
  "elite-bruno",
  "elite-agatha",
  "elite-lance",
  "champion",
]);

export function campaignMapArtLayout(
  locationId: string,
): "strip" | "bleed" {
  return WIDE_STAGE_ART.has(locationId) ? "bleed" : "strip";
}

/**
 * Zona → número de capítulo (1..9), para resolvers que sólo tienen locationId.
 * Mismo corte que `buildChapters` (cada gym cierra capítulo; Alto Mando = 9).
 */
const LOCATION_CHAPTER: Record<string, number> = {
  "pallet-town": 1,
  "route-1": 1,
  "viridian-city": 1,
  "route-2": 1,
  "viridian-forest": 1,
  "pewter-city": 1,
  "pewter-gym": 1,
  "route-3": 2,
  "mt-moon": 2,
  "cerulean-city": 2,
  "cerulean-gym": 2,
  "route-5": 3,
  "vermilion-city": 3,
  "vermilion-gym": 3,
  "route-11": 4,
  "rock-tunnel": 4,
  "lavender-town": 4,
  "route-8": 4,
  "celadon-city": 4,
  "celadon-gym": 4,
  "route-16": 5,
  "fuchsia-city": 5,
  "fuchsia-gym": 5,
  "route-15": 6,
  "saffron-city": 6,
  "saffron-gym": 6,
  "route-19": 7,
  "cinnabar-island": 7,
  "cinnabar-gym": 7,
  "route-21": 8,
  "viridian-gym": 8,
  "victory-road": 9,
  "indigo-plateau": 9,
  "elite-lorelei": 9,
  "elite-bruno": 9,
  "elite-agatha": 9,
  "elite-lance": 9,
  "champion": 9,
};

/** Preferred path for a location map (may 404 until assets are supplied). */
export function campaignMapPath(locationId: string): string {
  return LOCATION_MAPS[locationId] ?? FALLBACK_MAP;
}

/** Image for Next/Image — local art when present, else shared fallback. */
export function campaignMapSrc(locationId: string, hasLocalAsset = false): string {
  if (hasLocalAsset || locationId in LOCATION_MAPS) {
    return LOCATION_MAPS[locationId] ?? FALLBACK_MAP;
  }
  return FALLBACK_MAP;
}

export function campaignMapHasArt(locationId: string): boolean {
  return locationId in LOCATION_MAPS;
}

/** Banner ilustrado del hero según la zona actual. */
export function campaignBannerSrc(locationId: string | null | undefined): string {
  return campaignBannerArt(locationId).src;
}

export function campaignBannerArt(
  locationId: string | null | undefined,
): CampaignBannerArt {
  if (locationId && LOCATION_CHAPTER[locationId]) {
    return campaignBannerForChapter(LOCATION_CHAPTER[locationId]);
  }
  return DEFAULT_BANNER_ART;
}

/** Banner del capítulo: usa el de cualquier zona del tramo si hay match. */
export function campaignBannerForZones(
  zoneIds: Array<string | null | undefined>,
): CampaignBannerArt {
  for (const id of zoneIds) {
    if (id && LOCATION_CHAPTER[id]) {
      return campaignBannerForChapter(LOCATION_CHAPTER[id]);
    }
  }
  return DEFAULT_BANNER_ART;
}

export function campaignMapFallback(): string {
  return FALLBACK_MAP;
}
