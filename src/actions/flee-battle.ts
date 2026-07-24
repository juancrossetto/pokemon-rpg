"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateCombatUi } from "@/lib/battle-lock";

const MAX_LOG_LINES = 20;

export interface FleeBattleResult {
  fled: boolean;
  counterAttack: null;
  outcome: "fled";
}

/**
 * Huida de encuentros salvajes — siempre tiene éxito.
 * En gimnasio no se puede huir (gymId != null → null).
 */
export async function fleeBattle(sessionId: string, locale: string): Promise<FleeBattleResult | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    where: { id: sessionId, userId, status: "ACTIVE", gymId: null },
    select: { id: true, log: true },
  });
  if (!battle) return null;

  await prisma.battleSession.update({
    where: { id: battle.id },
    data: { status: "FLED", log: [...battle.log, "fled"].slice(-MAX_LOG_LINES) },
  });

  revalidateCombatUi(locale);

  return { fled: true, counterAttack: null, outcome: "fled" };
}
