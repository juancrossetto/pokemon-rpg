import type { Prisma } from "@/generated/prisma/client";
import { calculateMaxHp, unspentPointsForLevel, xpForLevel } from "@/lib/stats";
import { getMovesetForLevel } from "@/lib/moveset";
import { TEAM_SIZE } from "@/lib/market-rules";

type GrantTx = Prisma.TransactionClient;

/**
 * Crea un Pokémon en la PC (o el primer slot libre del equipo).
 * Misma curva de unspent/XP que cría y captura.
 */
export async function grantPokemon(
  tx: GrantTx,
  input: {
    userId: string;
    speciesId: number;
    level: number;
    isShiny?: boolean;
  },
): Promise<{ id: string; speciesName: string; level: number; isShiny: boolean }> {
  const species = await tx.species.findUniqueOrThrow({ where: { id: input.speciesId } });
  const moveIds = await getMovesetForLevel(input.speciesId, input.level);
  const moves = await tx.move.findMany({ where: { id: { in: moveIds } } });
  const maxHp = calculateMaxHp(species.baseHp, input.level, 0);
  const teamCount = await tx.pokemonInstance.count({
    where: { ownerId: input.userId, teamSlot: { not: null } },
  });
  const openSlot = teamCount < TEAM_SIZE ? teamCount + 1 : null;
  const isShiny = Boolean(input.isShiny);

  const created = await tx.pokemonInstance.create({
    data: {
      ownerId: input.userId,
      speciesId: input.speciesId,
      level: input.level,
      xp: xpForLevel(input.level),
      currentHp: maxHp,
      teamSlot: openSlot,
      isShiny,
      unspentPoints: unspentPointsForLevel(input.level),
      moves: {
        create: moveIds.map((moveId, i) => ({
          moveId,
          slot: i + 1,
          currentPp: moves.find((m) => m.id === moveId)?.pp ?? 20,
        })),
      },
    },
    select: { id: true },
  });

  return {
    id: created.id,
    speciesName: species.name,
    level: input.level,
    isShiny,
  };
}
