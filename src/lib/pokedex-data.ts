import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Catálogo global de la Pokédex.
 *
 * Las especies sólo cambian durante un seed/migración, pero antes se pedían
 * completas a Postgres en cada visita. Separarlas del estado del entrenador
 * permite cachear este bloque pesado sin cachear capturas ni avistamientos.
 */
export const loadPokedexSpecies = unstable_cache(
  async () =>
    prisma.species.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        types: true,
        spriteUrl: true,
        generation: true,
        captureRate: true,
        baseHp: true,
        baseAttack: true,
        baseDefense: true,
        baseSpAtk: true,
        baseSpDef: true,
        baseSpeed: true,
        evolvesFromId: true,
        evolvesTo: { select: { id: true } },
      },
    }),
  ["pokedex-species-v2"],
  { revalidate: 3600, tags: ["pokedex-species"] },
);

/**
 * Estado personal de investigación. Todas las fuentes históricas se leen en
 * una sola ola y se fusionan antes del render, así una captura en PC cuenta de
 * inmediato aunque provenga de datos anteriores a `PokedexEntry`.
 */
export async function loadPokedexUserState(userId: string) {
  const [owned, registered, battles, zoneSightings] = await Promise.all([
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId },
      select: {
        speciesId: true,
        isShiny: true,
        isFavorite: true,
        teamSlot: true,
      },
    }),
    prisma.pokedexEntry.findMany({
      where: { userId },
      select: { speciesId: true },
    }),
    prisma.battleSession.findMany({
      where: { userId },
      select: { wildSpeciesId: true },
      distinct: ["wildSpeciesId"],
    }),
    prisma.seenSpecies.findMany({
      where: { userId },
      select: { speciesId: true },
      distinct: ["speciesId"],
    }),
  ]);

  const seenIds = new Set<number>();
  for (const row of registered) seenIds.add(row.speciesId);
  for (const row of battles) seenIds.add(row.wildSpeciesId);
  for (const row of zoneSightings) seenIds.add(row.speciesId);
  for (const row of owned) seenIds.add(row.speciesId);

  // Reparación idempotente del historial. El render no vuelve a consultar:
  // usa el Set ya fusionado, por lo que no agrega otra vuelta a Postgres.
  if (seenIds.size > registered.length) {
    await prisma.pokedexEntry.createMany({
      data: [...seenIds].map((speciesId) => ({ userId, speciesId })),
      skipDuplicates: true,
    });
  }

  return { owned, seenIds: [...seenIds] };
}
