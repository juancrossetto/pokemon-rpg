import { prisma } from "@/lib/prisma";

// Si el Pokémon activo se debilita y todavía queda alguno con vida en el
// equipo, los juegos reales no terminan el combate: fuerzan un cambio. Solo
// se pierde la batalla si no queda ningún reemplazo posible.
export function hasHealthyBackup(ownerId: string, excludeInstanceId: string) {
  return prisma.pokemonInstance
    .findFirst({
      where: { ownerId, teamSlot: { not: null }, id: { not: excludeInstanceId }, currentHp: { gt: 0 } },
      select: { id: true },
    })
    .then((r) => r !== null);
}
