import { prisma } from "@/lib/prisma";

/** Marca una especie como vista en la Pokédex (idempotente). */
export async function markSpeciesSeen(userId: string, speciesId: number): Promise<void> {
  await prisma.pokedexEntry.upsert({
    where: { userId_speciesId: { userId, speciesId } },
    create: { userId, speciesId },
    update: {},
  });
}

/**
 * Sincroniza entradas vistas desde capturas y batallas históricas.
 * Se llama al abrir la Pokédex para no perder progreso anterior a PokedexEntry.
 */
export async function syncPokedexSeen(userId: string): Promise<void> {
  const [owned, battles] = await Promise.all([
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId },
      select: { speciesId: true },
      distinct: ["speciesId"],
    }),
    prisma.battleSession.findMany({
      where: { userId },
      select: { wildSpeciesId: true },
      distinct: ["wildSpeciesId"],
    }),
  ]);

  const ids = new Set<number>();
  for (const row of owned) ids.add(row.speciesId);
  for (const row of battles) ids.add(row.wildSpeciesId);
  if (ids.size === 0) return;

  await prisma.pokedexEntry.createMany({
    data: [...ids].map((speciesId) => ({ userId, speciesId })),
    skipDuplicates: true,
  });
}
