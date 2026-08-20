import type { CampaignRegionId } from "./types";
import { findLocation } from "./content";
import { regionMapSrc as gameRegionMapSrc } from "@/lib/regions";

/** Map asset registry. Missing files fall back to the shared Kanto overview. */

const FALLBACK_MAP = "/gyms/maps/kanto-lgpe.png";

export type CampaignBannerArt = {
  src: string;
  /** CSS object-position — ancla sujetos dentro del crop del hero. */
  objectPosition: string;
};

const CHAPTER_BANNER_COUNT = 9;

/**
 * Banner del hero: uno por capítulo/etapa.
 * Arte en `public/campaign/banners/<region>/chapter-NN.png`, con fallback
 * legacy en `public/campaign/banners/chapter-NN.png` (Kanto).
 */
export function campaignBannerForChapter(
  chapterNumber: number | null | undefined,
  regionId: string = "kanto",
): CampaignBannerArt {
  const n = Math.min(
    CHAPTER_BANNER_COUNT,
    Math.max(1, Math.floor(chapterNumber ?? 1)),
  );
  const pad = String(n).padStart(2, "0");
  const regionPath = `/campaign/banners/${regionId}/chapter-${pad}.png`;
  // Kanto sigue en la raíz histórica; otras regiones usan carpeta propia.
  const src =
    regionId === "kanto"
      ? `/campaign/banners/chapter-${pad}.png`
      : regionId === "johto"
        ? gameRegionMapSrc(regionId)
        : regionPath;
  return {
    src,
    objectPosition: "50% 50%",
  };
}

const DEFAULT_BANNER_ART: CampaignBannerArt = campaignBannerForChapter(1, "kanto");

/**
 * Overrides explícitos (excepciones al path por convención).
 * Convención: `/campaign/maps/<regionId>/<locationId>.png`.
 */
const LOCATION_MAP_OVERRIDES: Record<string, string> = {};

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

/**
 * Zona → número de capítulo (1..9) para Kanto. Otras regiones pueden extender
 * este mapa o derivar el capítulo desde `buildChapters`.
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
  champion: 9,
};

/** Locations con arte local conocido (Kanto). Se usa para `campaignMapHasArt`. */
const KNOWN_LOCAL_MAPS = new Set(Object.keys(LOCATION_CHAPTER));

function resolveRegionId(locationId: string): CampaignRegionId {
  return findLocation(locationId)?.regionId ?? "kanto";
}

/** Path por convención: `/campaign/maps/<region>/<locationId>.png`. */
export function campaignMapPath(locationId: string): string {
  if (LOCATION_MAP_OVERRIDES[locationId]) return LOCATION_MAP_OVERRIDES[locationId];
  const regionId = resolveRegionId(locationId);
  return `/campaign/maps/${regionId}/${locationId}.png`;
}

export function campaignMapArtLayout(
  locationId: string,
): "strip" | "bleed" {
  return WIDE_STAGE_ART.has(locationId) ? "bleed" : "strip";
}

/** Image for Next/Image — local art when present, else shared fallback. */
export function campaignMapSrc(locationId: string, hasLocalAsset = false): string {
  if (hasLocalAsset || KNOWN_LOCAL_MAPS.has(locationId) || locationId in LOCATION_MAP_OVERRIDES) {
    return campaignMapPath(locationId);
  }
  // Convención: asumimos el path aunque el archivo aún no exista (Johto).
  const found = findLocation(locationId);
  if (found) return found.regionId === "kanto" ? campaignMapPath(locationId) : gameRegionMapSrc(found.regionId);
  return FALLBACK_MAP;
}

export function campaignMapHasArt(locationId: string): boolean {
  return (
    KNOWN_LOCAL_MAPS.has(locationId) ||
    locationId in LOCATION_MAP_OVERRIDES
  );
}

/** Banner ilustrado del hero según la zona actual. */
export function campaignBannerSrc(locationId: string | null | undefined): string {
  return campaignBannerArt(locationId).src;
}

export function campaignBannerArt(
  locationId: string | null | undefined,
): CampaignBannerArt {
  if (locationId && LOCATION_CHAPTER[locationId]) {
    return campaignBannerForChapter(
      LOCATION_CHAPTER[locationId],
      resolveRegionId(locationId),
    );
  }
  return DEFAULT_BANNER_ART;
}

/** Banner del capítulo: usa el de cualquier zona del tramo si hay match. */
export function campaignBannerForZones(
  zoneIds: Array<string | null | undefined>,
): CampaignBannerArt {
  for (const id of zoneIds) {
    if (id && LOCATION_CHAPTER[id]) {
      return campaignBannerForChapter(LOCATION_CHAPTER[id], resolveRegionId(id));
    }
  }
  return DEFAULT_BANNER_ART;
}

export function campaignMapFallback(): string {
  return FALLBACK_MAP;
}
