import type { CampaignLocationKind } from "@/lib/campaign/types";
import type { BattleBgId } from "@/lib/showdown-fx";

/**
 * Fondos de batalla (CDN Showdown /fx/bg-*.png).
 *
 * Prioridad:
 * 1. Gimnasio → por tipo del líder (cueva volcánica, playa, etc.)
 * 2. PvP → arena de montaña (cámara de duelo)
 * 3. Entrenador de ruta → route
 * 4. Location concreta (agua, cuevas) → override
 * 5. Kind de zona → pool con tie-break estable por battleId
 */

const KIND_POOL: Record<CampaignLocationKind, readonly BattleBgId[]> = {
  town: ["city", "meadow"],
  route: ["route", "meadow", "river"],
  forest: ["forest"],
  dungeon: ["dampcave", "earthycave"],
  gym: ["mountain"],
};

/** Locations con bioma más específico que el kind genérico. */
const LOCATION_POOL: Record<string, readonly BattleBgId[]> = {
  "viridian-forest": ["forest"],
  "mt-moon": ["dampcave", "earthycave"],
  "rock-tunnel": ["earthycave", "dampcave"],
  "victory-road": ["mountain", "earthycave", "dampcave"],
  "lavender-town": ["dampcave", "city"],
  "indigo-plateau": ["mountain", "thunderplains"],
  // Costas / agua
  "route-19": ["beach", "beachshore", "river"],
  "route-21": ["beachshore", "beach", "river"],
  "cinnabar-island": ["beach", "volcanocave", "desert"],
};

/** Cámara de gimnasio / Alto Mando según el tipo del líder. */
const GYM_TYPE_BG: Record<string, BattleBgId> = {
  rock: "earthycave",
  water: "beach",
  electric: "thunderplains",
  grass: "forest",
  poison: "dampcave",
  psychic: "city",
  fire: "volcanocave",
  ground: "desert",
  ice: "icecave",
  fighting: "mountain",
  ghost: "dampcave",
  dragon: "mountain",
  normal: "mountain",
};

function pickStable(pool: readonly BattleBgId[], seed: string): BattleBgId {
  if (pool.length === 1) return pool[0]!;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length]!;
}

export function resolveBattleBg(opts: {
  battleMode: "wild" | "gym" | "pvp" | "tower";
  battleId: string;
  locationKind?: CampaignLocationKind | string | null;
  locationId?: string | null;
  gymType?: string | null;
  isRouteTrainer?: boolean;
}): BattleBgId {
  if (opts.battleMode === "pvp") return "mountain";
  if (opts.battleMode === "tower") return "mountain";

  if (opts.battleMode === "gym") {
    const type = (opts.gymType ?? "").toLowerCase();
    return GYM_TYPE_BG[type] ?? "mountain";
  }

  if (opts.isRouteTrainer) {
    const locPool = opts.locationId ? LOCATION_POOL[opts.locationId] : null;
    if (locPool) return pickStable(locPool, opts.battleId);
    return "route";
  }

  if (opts.locationId && LOCATION_POOL[opts.locationId]) {
    return pickStable(LOCATION_POOL[opts.locationId]!, opts.battleId);
  }

  const kind = (opts.locationKind ?? "route") as CampaignLocationKind;
  const pool = KIND_POOL[kind] ?? KIND_POOL.route;
  return pickStable(pool, opts.battleId);
}
