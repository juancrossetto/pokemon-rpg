import { prisma } from "@/lib/prisma";
import { battleUsesTurnTimer, isTurnExpired } from "@/lib/battle-turn-timer";
import {
  revalidateAfterIdleLoss,
  settleIdleBattleLoss,
} from "@/lib/settle-idle-battle";

type IdleBattleRow = {
  id: string;
  userId: string;
  pokemonInstanceId: string;
  gymId: string | null;
  gymRunId: string | null;
  towerRunId: string | null;
  pvpMatchId: string | null;
  clanWarBattleId: string | null;
  opponentUserId: string | null;
  log: string[];
  turnDeadlineAt: Date | null;
};

/**
 * Si el deadline venció, cierra la batalla. Devuelve true si quedó cerrada
 * por idle (o ya no estaba ACTIVE tras el settle).
 * Reloj sólo en PvP: otros modos ignoran y limpian deadline residual.
 */
export async function closeBattleIfIdle(
  battle: IdleBattleRow,
  locale: string,
): Promise<boolean> {
  if (!battleUsesTurnTimer(battle)) {
    if (battle.turnDeadlineAt) {
      await prisma.battleSession.update({
        where: { id: battle.id },
        data: { turnDeadlineAt: null },
      });
    }
    return false;
  }

  if (!isTurnExpired(battle.turnDeadlineAt)) return false;

  const settled = await prisma.$transaction(
    async (tx) => settleIdleBattleLoss(tx, battle),
    { timeout: 20_000 },
  );
  if (!settled) return true;

  if (battle.gymId) {
    const { notifyGymResult } = await import("@/lib/notifications");
    await notifyGymResult(battle.userId, battle.gymId, false);
  }
  await revalidateAfterIdleLoss(locale, battle);
  return true;
}
