import type { Prisma } from "@/generated/prisma/client";
import { currentSeasonKey, nextSeasonReset } from "@/lib/pvp/seasons";

/** Reusa la clave mensual UTC del PvP (`2026-08`). */
export { currentSeasonKey };

export function seasonWindow(now = new Date()): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endsAt = nextSeasonReset(now);
  return { startsAt, endsAt };
}

/**
 * Asegura la temporada de guerra del mes. Idempotente.
 * Status ACTIVE: registro y combates abiertos durante todo el mes.
 * Usa upsert para no romper si dos requests crean la misma seasonKey.
 */
export async function ensureClanWarSeason(
  tx: Prisma.TransactionClient,
  now = new Date(),
): Promise<{ id: string; seasonKey: string }> {
  const seasonKey = currentSeasonKey(now);
  const { startsAt, endsAt } = seasonWindow(now);
  return tx.clanWarSeason.upsert({
    where: { seasonKey },
    create: {
      seasonKey,
      status: "ACTIVE",
      startsAt,
      endsAt,
    },
    update: {},
    select: { id: true, seasonKey: true },
  });
}
