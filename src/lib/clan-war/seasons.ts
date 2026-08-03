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
 */
export async function ensureClanWarSeason(
  tx: Prisma.TransactionClient,
  now = new Date(),
): Promise<{ id: string; seasonKey: string }> {
  const seasonKey = currentSeasonKey(now);
  const existing = await tx.clanWarSeason.findUnique({ where: { seasonKey } });
  if (existing) return { id: existing.id, seasonKey };

  const { startsAt, endsAt } = seasonWindow(now);
  const created = await tx.clanWarSeason.create({
    data: {
      seasonKey,
      status: "ACTIVE",
      startsAt,
      endsAt,
    },
    select: { id: true, seasonKey: true },
  });
  return created;
}
