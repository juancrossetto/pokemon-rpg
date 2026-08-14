import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Cierre de un intento de incursión.
 *
 * El intento ya se cobró al arrancar (`startWeeklyRaidBattle`), así que acá no
 * se toca `attemptsUsed`: sólo se acredita el daño. Hay tres finales posibles
 * —se acabaron los turnos, cayó el equipo, o el jefe se debilitó— y dos de
 * ellos pueden llegar desde acciones distintas (`battle-move`, `use-item`,
 * `switch-pokemon`), así que la acreditación tiene que poder viajar dentro de
 * la misma transacción que cierra la sesión: si la sesión se cerrara y el daño
 * no se contara, el intento se perdería sin registro.
 *
 * Por eso es **una sola sentencia** en vez de leer-y-escribir: `bestDamage`
 * necesita un máximo, y resolverlo con un `SELECT` previo obligaría a la forma
 * `async` de `$transaction` en callers que usan la forma de array.
 */

/** Daño real que el jugador le sacó al jefe en este intento. */
export function raidDamageDealt(maxHp: number, currentHp: number): number {
  return Math.max(0, Math.floor(maxHp) - Math.max(0, Math.floor(currentHp)));
}

/**
 * Sentencia de acreditación, lista para meter en cualquier `$transaction`.
 * Devuelve `null` cuando no hay nada que acreditar, para que el caller la
 * pueda expandir con `...(stmt ? [stmt] : [])`.
 */
export function raidSettleStatement(
  client: Pick<typeof prisma, "$executeRaw">,
  params: { userId: string; weekKey: string; damage: number },
): Prisma.PrismaPromise<number> | null {
  const damage = Math.max(0, Math.floor(params.damage));
  if (damage <= 0) return null;
  return client.$executeRaw`
    UPDATE "WeeklyRaidScore"
    SET "totalDamage" = "totalDamage" + ${damage},
        "bestDamage" = GREATEST("bestDamage", ${damage}),
        "updatedAt" = NOW()
    WHERE "userId" = ${params.userId} AND "weekKey" = ${params.weekKey}
  `;
}
