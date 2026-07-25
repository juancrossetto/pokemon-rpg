/** Map asset registry. Missing files fall back to the shared Kanto overview. */

const FALLBACK_MAP = "/gyms/maps/kanto-lgpe.png";

const LOCATION_MAPS: Record<string, string> = {
  "pallet-town": "/campaign/maps/kanto/pallet-town.webp",
  "route-1": "/campaign/maps/kanto/route-1.webp",
  "viridian-city": "/campaign/maps/kanto/viridian-city.webp",
  "route-2": "/campaign/maps/kanto/route-2.webp",
  "viridian-forest": "/campaign/maps/kanto/viridian-forest.webp",
  "pewter-city": "/campaign/maps/kanto/pewter-city.webp",
  "pewter-gym": "/campaign/maps/kanto/pewter-gym.webp",
  "route-3": "/campaign/maps/kanto/route-3.webp",
  "mt-moon": "/campaign/maps/kanto/mt-moon.webp",
  "cerulean-city": "/campaign/maps/kanto/cerulean-city.webp",
};

/** Preferred path for a location map (may 404 until assets are supplied). */
export function campaignMapPath(locationId: string): string {
  return LOCATION_MAPS[locationId] ?? FALLBACK_MAP;
}

/** Always-safe image for Next/Image — use until local WebPs exist. */
export function campaignMapSrc(locationId: string, hasLocalAsset = false): string {
  if (hasLocalAsset) return campaignMapPath(locationId);
  return FALLBACK_MAP;
}

export function campaignMapFallback(): string {
  return FALLBACK_MAP;
}
