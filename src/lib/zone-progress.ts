import { prisma } from "@/lib/prisma";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  MASTERY_XP_PER_WIN,
  masteryBonuses,
  masteryLevel,
  type MasteryBonuses,
} from "@/lib/mastery";

export type ZoneContext = {
  locationId: string;
  xp: number;
  level: number;
  bonuses: MasteryBonuses;
};

/** Mastery del jugador en la zona donde está farmeando ahora. */
export async function getZoneContext(userId: string): Promise<ZoneContext> {
  const progress = await ensureCampaignProgress(userId);
  const row = await prisma.zoneMastery.findUnique({
    where: { userId_locationId: { userId, locationId: progress.farmingLocationId } },
    select: { xp: true },
  });
  const xp = row?.xp ?? 0;
  const level = masteryLevel(xp);
  return { locationId: progress.farmingLocationId, xp, level, bonuses: masteryBonuses(level) };
}

/** Suma XP de mastery tras ganar un salvaje. Devuelve si subió de nivel. */
export async function grantZoneMastery(
  userId: string,
  locationId: string,
  amount = MASTERY_XP_PER_WIN,
): Promise<{ level: number; leveledUp: boolean }> {
  const before = await prisma.zoneMastery.findUnique({
    where: { userId_locationId: { userId, locationId } },
    select: { xp: true },
  });
  const previousLevel = masteryLevel(before?.xp ?? 0);

  const updated = await prisma.zoneMastery.upsert({
    where: { userId_locationId: { userId, locationId } },
    create: { userId, locationId, xp: amount },
    update: { xp: { increment: amount } },
    select: { xp: true },
  });

  const level = masteryLevel(updated.xp);
  return { level, leveledUp: level > previousLevel };
}

/**
 * Registra que el jugador vio esta especie en esta zona.
 *
 * `createMany` con `skipDuplicates` en vez de upsert: se llama en cada
 * encuentro y casi siempre la fila ya existe.
 */
export async function recordSeenSpecies(
  userId: string,
  locationId: string,
  speciesId: number,
): Promise<void> {
  await prisma.seenSpecies.createMany({
    data: [{ userId, locationId, speciesId }],
    skipDuplicates: true,
  });
}
