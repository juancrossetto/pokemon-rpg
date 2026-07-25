import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

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

/**
 * Renumera el equipo a 1..N respetando el orden actual.
 *
 * Sacar al del slot 2 dejaba un hueco (1, 3, 4). Eso no es sólo cosmético:
 * `start-encounter` y las corridas de gimnasio buscan al líder con
 * `teamSlot: 1`, así que un hueco en el slot 1 dejaba al jugador sin poder
 * explorar. Llamar a esto después de cualquier operación que libere un slot.
 *
 * Compactar siempre mueve hacia abajo (destino ≤ actual) y en orden ascendente,
 * así que nunca choca con el `@@unique([ownerId, teamSlot])`.
 */
export async function compactTeamSlots(
  tx: Prisma.TransactionClient,
  ownerId: string,
): Promise<void> {
  const team = await tx.pokemonInstance.findMany({
    where: { ownerId, teamSlot: { not: null } },
    select: { id: true, teamSlot: true },
    orderBy: { teamSlot: "asc" },
  });

  for (const [index, member] of team.entries()) {
    const target = index + 1;
    if (member.teamSlot === target) continue;
    await tx.pokemonInstance.update({
      where: { id: member.id },
      data: { teamSlot: target },
    });
  }
}
