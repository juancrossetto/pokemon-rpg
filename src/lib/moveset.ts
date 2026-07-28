import { prisma } from "@/lib/prisma";

const MAX_MOVES = 4;

// Los últimos movimientos que una especie aprende hasta cierto nivel —
// mismo criterio que usan los juegos oficiales para un Pokémon recién
// atrapado o un inicial nuevo.
export async function getMovesetForLevel(speciesId: number, level: number): Promise<number[]> {
  const learnable = await prisma.speciesMove.findMany({
    where: { speciesId, method: "LEVEL_UP", learnLevel: { lte: level } },
    orderBy: { learnLevel: "desc" },
    take: MAX_MOVES,
  });
  if (learnable.length > 0) return learnable.map((m) => m.moveId);

  // Fallback: si no hay learnset por nivel (seed incompleto), cualquier
  // movimiento LEVEL_UP de la especie — evita mones sin ataques.
  const anyLevelUp = await prisma.speciesMove.findMany({
    where: { speciesId, method: "LEVEL_UP" },
    orderBy: [{ learnLevel: "asc" }, { moveId: "asc" }],
    take: MAX_MOVES,
  });
  return anyLevelUp.map((m) => m.moveId);
}
