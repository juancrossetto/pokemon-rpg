import { prisma } from "@/lib/prisma";

/**
 * Padres ocupados en la guardería.
 *
 * Decisión de diseño: los padres **no se consumen**, se bloquean mientras el
 * huevo incuba. Las tres opciones eran consumirlos, ponerles cooldown o subir
 * el costo, y esta es la que mejor le sirve al juego:
 *
 * - Es fiel a Pokémon: en los juegos la pareja queda en la guardería, no
 *   desaparece. Consumir un Pokémon que el jugador subió de nivel es el tipo de
 *   castigo que hace que la gente no vuelva a tocar el sistema.
 * - Es un sumidero real igual: dos Pokémon fuera de circulación 4 horas, más
 *   las 300 monedas. No podés criar con tu equipo ni vender a los padres.
 * - Corta el spam solo: la misma pareja no puede producir un segundo huevo
 *   mientras el primero incuba, sin necesidad de cooldowns aparte.
 *
 * El bloqueo es derivado, no una columna: un Pokémon está ocupado si es padre
 * de algún huevo sin eclosionar. Cero estado nuevo que pueda quedar corrupto.
 */
export async function breedingParentIds(userId: string): Promise<Set<string>> {
  const eggs = await prisma.egg.findMany({
    where: { ownerId: userId, hatchedAt: null },
    select: { parentAId: true, parentBId: true },
  });
  return new Set(eggs.flatMap((e) => [e.parentAId, e.parentBId]));
}

/** ¿Alguno de estos Pokémon está incubando un huevo? */
export async function anyBreeding(userId: string, instanceIds: string[]): Promise<boolean> {
  if (instanceIds.length === 0) return false;
  const busy = await breedingParentIds(userId);
  return instanceIds.some((id) => busy.has(id));
}
