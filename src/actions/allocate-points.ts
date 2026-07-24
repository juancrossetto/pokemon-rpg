"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { blockIfInCombat } from "@/lib/battle-lock";
import {
  calculateMaxHp,
  MANUAL_STAT_KEYS,
  MAX_POINTS_PER_STAT,
  type ManualStatKey,
} from "@/lib/stats";

export type AllocatePointsInput = Partial<Record<ManualStatKey, number>>;

export type AllocatePointsResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "invalid" | "in_combat" };

function sanitizeSpend(raw: AllocatePointsInput): Record<ManualStatKey, number> | null {
  const spend = Object.fromEntries(MANUAL_STAT_KEYS.map((k) => [k, 0])) as Record<
    ManualStatKey,
    number
  >;

  for (const key of MANUAL_STAT_KEYS) {
    const value = raw[key] ?? 0;
    if (!Number.isInteger(value) || value < 0) return null;
    spend[key] = value;
  }

  return spend;
}

/**
 * Gasta unspentPoints en atributos manuales (dossier fase 7).
 * Constitución sube el max HP y el currentHp en la misma delta.
 */
export async function allocatePoints(
  instanceId: string,
  rawSpend: AllocatePointsInput,
  locale: string,
): Promise<AllocatePointsResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const spend = sanitizeSpend(rawSpend);
  if (!spend) return { ok: false, error: "invalid" };

  const totalSpend = MANUAL_STAT_KEYS.reduce((sum, key) => sum + spend[key], 0);
  if (totalSpend <= 0) return { ok: false, error: "invalid" };

  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: instanceId, ownerId: userId },
    include: { species: true },
  });
  if (!instance) return { ok: false, error: "not_found" };

  if (totalSpend > instance.unspentPoints) return { ok: false, error: "invalid" };

  for (const key of MANUAL_STAT_KEYS) {
    if (instance[key] + spend[key] > MAX_POINTS_PER_STAT) {
      return { ok: false, error: "invalid" };
    }
  }

  const nextConstitution = instance.ptConstitution + spend.ptConstitution;
  const oldMaxHp = calculateMaxHp(
    instance.species.baseHp,
    instance.level,
    instance.ptConstitution,
  );
  const newMaxHp = calculateMaxHp(instance.species.baseHp, instance.level, nextConstitution);
  const hpDelta = newMaxHp - oldMaxHp;
  // Si está debilitado, no lo revive al subir Constitución.
  const nextCurrentHp =
    instance.currentHp <= 0 ? 0 : Math.min(newMaxHp, instance.currentHp + hpDelta);

  await prisma.pokemonInstance.update({
    where: { id: instanceId },
    data: {
      unspentPoints: instance.unspentPoints - totalSpend,
      ptStrength: instance.ptStrength + spend.ptStrength,
      ptDexterity: instance.ptDexterity + spend.ptDexterity,
      ptIntelligence: instance.ptIntelligence + spend.ptIntelligence,
      ptSpeed: instance.ptSpeed + spend.ptSpeed,
      ptConstitution: nextConstitution,
      currentHp: nextCurrentHp,
    },
  });

  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/pc`);
  revalidatePath(`/${locale}/ranking`);
  return { ok: true };
}
