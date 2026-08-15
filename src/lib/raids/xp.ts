import type { Prisma } from "@/generated/prisma/client";
import { distributeVictoryXpShares, xpForVictory } from "@/lib/battle";
import { applyXpGain } from "@/lib/battle-xp";
import type { prisma } from "@/lib/prisma";

/**
 * Multiplicador de XP de la incursión.
 *
 * Un intento son diez turnos contra un legendario, así que rendir lo mismo que
 * un salvaje del mismo nivel sería un mal negocio: el jugador gastaría tres
 * intentos semanales en algo que le conviene menos que farmear la ruta. Con ×3
 * un jefe tumbado entero paga como tres salvajes de su nivel.
 */
export const RAID_XP_MULTIPLIER = 3;

/**
 * XP del intento, proporcional a **cuánto le sacaste al jefe**.
 *
 * No es por victoria: la incursión casi nunca termina en KO, termina cuando se
 * acaban los turnos. Pagar sólo al matarlo dejaría el modo sin recompensa de
 * progresión para todos menos el equipo más fuerte del servidor, que es
 * justamente lo contrario de lo que buscaba adelantar el contenido.
 *
 * Pura y sin Prisma para poder testearla: la reparte `battle-move`.
 */
export function raidAttemptXp(params: {
  bossLevel: number;
  damageDealt: number;
  bossMaxHp: number;
}): number {
  const maxHp = Math.max(1, Math.floor(params.bossMaxHp));
  const damage = Math.max(0, Math.min(maxHp, Math.floor(params.damageDealt)));
  if (damage <= 0) return 0;
  const full = xpForVictory(params.bossLevel) * RAID_XP_MULTIPLIER;
  return Math.max(1, Math.round((full * damage) / maxHp));
}

/**
 * Updates de XP para todo el equipo, listos para una `$transaction`.
 *
 * Lo usan los **dos** finales que acreditan daño: el cierre por turnos/caída
 * (en `battle-move`) y la retirada voluntaria. Si sólo lo hiciera el primero,
 * retirarse castigaría dos veces —perdés el intento y además la experiencia
 * del daño que sí hiciste—, que es justo lo contrario de lo que la retirada
 * vino a resolver.
 */
export async function buildRaidXpUpdates(
  client: typeof prisma,
  params: {
    userId: string;
    bossLevel: number;
    damageDealt: number;
    bossMaxHp: number;
    participantIds: readonly string[];
    /** HP del activo tras el turno; el de la base puede estar desactualizado. */
    activeInstanceId?: string;
    activeHp?: number;
  },
): Promise<{
  updates: Prisma.PrismaPromise<unknown>[];
  activeGain: { xp: number; maxHp: number; leveledUpTo: number | null } | null;
}> {
  const pool = raidAttemptXp(params);
  if (pool <= 0) return { updates: [], activeGain: null };

  const team = await client.pokemonInstance.findMany({
    where: { ownerId: params.userId, teamSlot: { not: null } },
    include: { species: true, heldItem: true },
  });
  const hpOf = (mon: { id: string; currentHp: number }) =>
    mon.id === params.activeInstanceId && params.activeHp != null
      ? params.activeHp
      : mon.currentHp;
  const alive = team.filter((mon) => hpOf(mon) > 0);
  const participants = alive.filter((mon) => params.participantIds.includes(mon.id));

  const shares = distributeVictoryXpShares({
    totalXp: pool,
    participantIds: (participants.length > 0 ? participants : alive).map((m) => m.id),
    expShareHolderIds: alive
      .filter((m) => m.heldItem?.heldEffect === "EXP_SHARE")
      .map((m) => m.id),
  });

  const updates: Prisma.PrismaPromise<unknown>[] = [];
  let activeGain: { xp: number; maxHp: number; leveledUpTo: number | null } | null = null;

  for (const [id, share] of shares) {
    if (share <= 0) continue;
    const mon = team.find((m) => m.id === id);
    if (!mon) continue;
    const gain = applyXpGain(
      mon.xp,
      mon.level,
      hpOf(mon),
      mon.unspentPoints,
      mon.species.baseHp,
      mon.ptConstitution,
      share,
    );
    if (mon.id === params.activeInstanceId) {
      activeGain = { xp: share, maxHp: gain.newMaxHp, leveledUpTo: gain.leveledUpTo };
    }
    updates.push(
      client.pokemonInstance.update({
        where: { id: mon.id },
        data: {
          xp: gain.newXpTotal,
          level: gain.newLevel,
          unspentPoints: gain.newUnspentPoints,
          // Un debilitado gana XP pero no revive por el +HP del level-up.
          currentHp: hpOf(mon) <= 0 ? 0 : gain.newCurrentHp,
        },
      }),
    );
  }
  return { updates, activeGain };
}
