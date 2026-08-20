import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Invalida la Pokédex de todos los locales sin purgar el resto de la app. */
export function revalidatePokedex(): void {
  revalidatePath("/[locale]/pokedex", "page");
}

/** Marca una especie como vista en la Pokédex (idempotente). */
export async function markSpeciesSeen(userId: string, speciesId: number): Promise<void> {
  await prisma.pokedexEntry.upsert({
    where: { userId_speciesId: { userId, speciesId } },
    create: { userId, speciesId },
    update: {},
  });
  revalidatePokedex();
}

/**
 * Sincroniza entradas vistas desde capturas y batallas históricas.
 * Se llama al abrir la Pokédex para no perder progreso anterior a PokedexEntry.
 */
export async function syncPokedexSeen(userId: string): Promise<void> {
  const [owned, battles, zoneSightings] = await Promise.all([
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
    // La campaña conserva además el avistamiento por zona para sus objetivos.
    // Incluirlo acá repara cuentas históricas donde esa escritura existió pero
    // la entrada global de Pokédex no llegó a crearse.
    prisma.seenSpecies.findMany({
      where: { userId },
      select: { speciesId: true },
      distinct: ["speciesId"],
    }),
  ]);

  const ids = new Set<number>();
  for (const row of owned) ids.add(row.speciesId);
  for (const row of battles) ids.add(row.wildSpeciesId);
  for (const row of zoneSightings) ids.add(row.speciesId);
  if (ids.size === 0) return;

  await prisma.pokedexEntry.createMany({
    data: [...ids].map((speciesId) => ({ userId, speciesId })),
    skipDuplicates: true,
  });
}
