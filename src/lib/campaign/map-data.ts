import { prisma } from "@/lib/prisma";
import { buildMapLocations, type MapLocation } from "./map-selection";
import type { CampaignProgressRow } from "./progress";

/**
 * Zonas del mapa + qué Pokémon salvajes tiene cada una y cuáles ya capturaste.
 *
 * Lo usan el dashboard y el lobby de batalla: los dos abren el mismo selector,
 * así que la carga vive acá y no duplicada en cada página. Son dos queries
 * para toda la región, no una por zona.
 */
export async function loadMapLocations(
  userId: string,
  progress: CampaignProgressRow,
): Promise<MapLocation[]> {
  const base = buildMapLocations(progress);
  const speciesIds = [...new Set(base.flatMap((l) => l.spawnSpeciesIds))];
  if (speciesIds.length === 0) return base;

  const [species, owned] = await Promise.all([
    prisma.species.findMany({
      where: { id: { in: speciesIds } },
      select: { id: true, name: true, spriteUrl: true, types: true },
    }),
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId, speciesId: { in: speciesIds } },
      select: { speciesId: true },
      distinct: ["speciesId"],
    }),
  ]);

  const byId = new Map(species.map((s) => [s.id, s]));
  const ownedIds = new Set(owned.map((o) => o.speciesId));

  return base.map((location) => ({
    ...location,
    encounters: location.spawnSpeciesIds.flatMap((id) => {
      const s = byId.get(id);
      if (!s) return [];
      return [
        {
          speciesId: s.id,
          name: s.name,
          spriteUrl: s.spriteUrl,
          types: s.types,
          caught: ownedIds.has(s.id),
        },
      ];
    }),
  }));
}
