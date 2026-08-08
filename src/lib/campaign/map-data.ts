import { prisma } from "@/lib/prisma";
import { masteryLevel } from "@/lib/mastery";
import { npcTrainerPortraitUrl } from "@/lib/avatars";
import { trainersForLocation } from "./trainers";
import { speciesRarity } from "./rarity";
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

  const [species, owned, seenRows, masteryRows, defeatRows, claimRows] = await Promise.all([
    prisma.species.findMany({
      where: { id: { in: speciesIds } },
      select: { id: true, name: true, spriteUrl: true, types: true },
    }),
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId, speciesId: { in: speciesIds } },
      select: { speciesId: true },
      distinct: ["speciesId"],
    }),
    prisma.seenSpecies.findMany({
      where: { userId },
      select: { locationId: true, speciesId: true },
    }),
    prisma.zoneMastery.findMany({
      where: { userId },
      select: { locationId: true, xp: true },
    }),
    prisma.trainerDefeat.findMany({ where: { userId }, select: { trainerId: true } }),
    prisma.zoneObjectiveClaim.findMany({
      where: { userId },
      select: { locationId: true, objective: true },
    }),
  ]);

  const byId = new Map(species.map((s) => [s.id, s]));
  const ownedIds = new Set(owned.map((o) => o.speciesId));
  const seen = new Set(seenRows.map((r) => `${r.locationId}:${r.speciesId}`));
  const masteryByZone = new Map(masteryRows.map((r) => [r.locationId, r.xp]));
  const defeated = new Set(defeatRows.map((r) => r.trainerId));
  const claimsByZone = new Map<string, string[]>();
  for (const row of claimRows) {
    claimsByZone.set(row.locationId, [...(claimsByZone.get(row.locationId) ?? []), row.objective]);
  }

  return base.map((location) => {
    const xp = masteryByZone.get(location.id) ?? 0;
    return {
      ...location,
      masteryXp: xp,
      masteryLevel: masteryLevel(xp),
      claimedObjectives: claimsByZone.get(location.id) ?? [],
      trainers: trainersForLocation(location.id).map((tr) => ({
        id: tr.id,
        nameKey: tr.nameKey,
        spriteUrl: npcTrainerPortraitUrl(tr.spriteSlug, "thumb"),
        level: tr.level,
        coinReward: tr.coinReward,
        defeated: defeated.has(tr.id),
      })),
      encounters: location.spawnSpeciesIds.flatMap((id) => {
        const s = byId.get(id);
        if (!s) return [];
        const seenInZone = seen.has(`${location.id}:${s.id}`);
        const owned = ownedIds.has(s.id);
        // Objetivo de zona: alcanza con cruzártela explorando acá (huir vale).
        const caught = seenInZone;
        const forObjective = location.objectiveSpeciesIds.includes(s.id);
        return [
          {
            speciesId: s.id,
            name: s.name,
            spriteUrl: s.spriteUrl,
            types: s.types,
            caught,
            owned,
            seen: owned || seenInZone,
            forObjective,
            rarity: speciesRarity(s.id),
          },
        ];
      }),
    };
  });
}
