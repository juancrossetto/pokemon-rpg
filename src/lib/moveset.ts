import { prisma } from "@/lib/prisma";

const MAX_MOVES = 4;

// Los últimos movimientos que una especie aprende hasta cierto nivel —
// mismo criterio que usan los juegos oficiales para un Pokémon recién
// atrapado o un inicial nuevo.
export async function getMovesetForLevel(speciesId: number, level: number): Promise<number[]> {
  const learnable = await prisma.speciesMove.findMany({
    where: { speciesId, learnLevel: { lte: level } },
    orderBy: { learnLevel: "desc" },
    take: MAX_MOVES,
  });
  return learnable.map((m) => m.moveId);
}
