import type { Prisma } from "@/generated/prisma/client";
import { LEGENDARY_IDS, MYTHICAL_IDS } from "@/lib/pokedex";
import type { TrainerStats } from "@/lib/trainer-profile";

type Db = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

/**
 * Contadores que alimentan `buildAchievements`. Misma semántica que el perfil
 * (medallas de gym no-elite, legendarios/míticos por posesión).
 * `power` no alimenta logros; se deja en 0 para no cargar el equipo.
 */
export async function loadTrainerStats(db: Db, userId: string): Promise<TrainerStats> {
  const [
    user,
    caught,
    shinies,
    distinctSpecies,
    dexSeen,
    dexTotal,
    badges,
    totalGyms,
    trainersDefeated,
    levelAgg,
  ] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { pvpWins: true, pvpLosses: true, pvpRating: true },
    }),
    db.pokemonInstance.count({ where: { ownerId: userId } }),
    db.pokemonInstance.count({ where: { ownerId: userId, isShiny: true } }),
    db.pokemonInstance.findMany({
      where: { ownerId: userId },
      select: { speciesId: true },
      distinct: ["speciesId"],
    }),
    db.pokedexEntry.count({ where: { userId } }),
    db.species.count(),
    db.badge.count({ where: { userId } }),
    db.gym.count({ where: { isElite: false } }),
    db.trainerDefeat.count({ where: { userId } }),
    db.pokemonInstance.aggregate({
      where: { ownerId: userId },
      _max: { level: true },
    }),
  ]);

  const ownedIds = new Set(distinctSpecies.map((s) => s.speciesId));
  const countOwnedIn = (ids: Set<number>) =>
    [...ownedIds].filter((id) => ids.has(id)).length;

  return {
    caught,
    shinies,
    species: ownedIds.size,
    dexSeen,
    dexTotal,
    badges,
    totalGyms,
    pvpWins: user.pvpWins,
    pvpLosses: user.pvpLosses,
    pvpRating: user.pvpRating,
    trainersDefeated,
    legendaries: countOwnedIn(LEGENDARY_IDS),
    mythicals: countOwnedIn(MYTHICAL_IDS),
    topLevel: levelAgg._max.level ?? 0,
    power: 0,
  };
}
