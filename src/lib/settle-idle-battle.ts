import type { Prisma } from "@/generated/prisma/client";
import { lockUsers } from "@/lib/db-locks";
import { revalidateCombatUi } from "@/lib/battle-lock";
import { revalidatePath } from "next/cache";

type Tx = Prisma.TransactionClient;

type IdleBattle = {
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
};

/**
 * Cierra una batalla ACTIVE por inactividad del jugador (mismo efecto que
 * perder: LOST + settle del modo). Idempotente si ya no está ACTIVE.
 */
export async function settleIdleBattleLoss(
  tx: Tx,
  battle: IdleBattle,
): Promise<boolean> {
  const current = await tx.battleSession.findFirst({
    where: { id: battle.id, userId: battle.userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!current) return false;

  const finalLog = [...battle.log, "idleTimeout"].slice(-20);

  if (battle.pvpMatchId) {
    const match = await tx.pvpMatch.findFirst({ where: { id: battle.pvpMatchId } });
    if (!match) {
      await tx.battleSession.update({
        where: { id: battle.id },
        data: { status: "LOST", log: finalLog, turnDeadlineAt: null },
      });
      return true;
    }
    await lockUsers(tx, battle.userId, match.opponentId);
    await tx.battleSession.update({
      where: { id: battle.id },
      data: { status: "LOST", log: finalLog, turnDeadlineAt: null },
    });
    await tx.battleLog.create({
      data: {
        kind: "PVP",
        userId: battle.userId,
        opponentId: match.opponentId,
        userWon: false,
      },
    });
    const { settlePvpMatch } = await import("@/lib/pvp/settle");
    await settlePvpMatch(tx, {
      matchId: match.id,
      challengerId: match.challengerId,
      opponentId: match.opponentId,
      challengerWon: false,
      mode: match.mode,
      seasonKey: match.seasonKey ?? "unknown",
      challengerRatingBefore: match.challengerRatingBefore,
      opponentRatingBefore: match.opponentRatingBefore,
      challengerTeam: match.challengerTeam,
      status: "FORFEIT",
      restoreTeam: true,
    });
    return true;
  }

  if (battle.clanWarBattleId) {
    const slot = await tx.clanWarBattle.findFirst({
      where: { id: battle.clanWarBattleId },
      include: { war: true },
    });
    if (!slot?.war) {
      await tx.battleSession.update({
        where: { id: battle.id },
        data: { status: "LOST", log: finalLog, turnDeadlineAt: null },
      });
      return true;
    }
    const membership = await tx.clanMember.findUnique({
      where: { userId: battle.userId },
    });
    const myClanId = membership?.clanId;
    const foeUserId = battle.opponentUserId;
    const foeClanId =
      myClanId === slot.war.clanAId
        ? slot.war.clanBId
        : myClanId === slot.war.clanBId
          ? slot.war.clanAId
          : null;
    if (myClanId && foeUserId && foeClanId) {
      await lockUsers(tx, battle.userId, foeUserId);
      await tx.battleSession.update({
        where: { id: battle.id },
        data: { status: "LOST", log: finalLog, turnDeadlineAt: null },
      });
      const { settleClanWarSlot } = await import("@/lib/clan-war/settle-slot");
      await settleClanWarSlot(tx, {
        battleId: slot.id,
        winnerClanId: foeClanId,
        winnerUserId: foeUserId,
        restoreChallengerTeam: slot.challengerTeam,
        status: "FORFEIT",
      });
    } else {
      await tx.battleSession.update({
        where: { id: battle.id },
        data: { status: "LOST", log: finalLog, turnDeadlineAt: null },
      });
    }
    return true;
  }

  if (battle.towerRunId) {
    await lockUsers(tx, battle.userId);
    await tx.battleSession.update({
      where: { id: battle.id },
      data: { status: "LOST", log: finalLog, turnDeadlineAt: null },
    });
    await tx.battleLog.create({
      data: { kind: "PVE_TOWER", userId: battle.userId, userWon: false },
    });
    const { settleTowerFloorLoss } = await import("@/lib/tower/settle");
    const { parseTowerTeamSnapshot } = await import("@/lib/tower/team");
    const run = await tx.towerRun.findFirstOrThrow({
      where: { id: battle.towerRunId },
    });
    const snap = parseTowerTeamSnapshot(run.teamSnapshot);
    const instances = await tx.pokemonInstance.findMany({
      where: { id: { in: snap.map((m) => m.instanceId) } },
      select: { id: true, currentHp: true },
    });
    await settleTowerFloorLoss(tx, {
      userId: battle.userId,
      runId: battle.towerRunId,
      instances,
    });
    return true;
  }

  await lockUsers(tx, battle.userId);
  await tx.battleSession.update({
    where: { id: battle.id },
    data: { status: "LOST", log: finalLog, turnDeadlineAt: null },
  });
  const kind = battle.gymId ? ("PVE_GYM" as const) : ("PVE_WILD" as const);
  await tx.battleLog.create({
    data: {
      kind,
      userId: battle.userId,
      userWon: false,
      gymId: battle.gymId,
    },
  });
  if (battle.gymId) {
    await tx.gymAttempt.create({
      data: { userId: battle.userId, gymId: battle.gymId, won: false },
    });
  }
  if (battle.gymRunId) {
    await tx.gymRun.update({
      where: { id: battle.gymRunId },
      data: { status: "ABANDONED" },
    });
  }
  return true;
}

export async function revalidateAfterIdleLoss(
  locale: string,
  battle: Pick<
    IdleBattle,
    "gymId" | "towerRunId" | "pvpMatchId" | "clanWarBattleId"
  >,
) {
  revalidateCombatUi(locale);
  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}`);
  if (battle.towerRunId) revalidatePath(`/${locale}/tower`);
  if (battle.gymId) revalidatePath(`/${locale}/gyms`);
  if (battle.pvpMatchId) {
    revalidatePath(`/${locale}/pvp`);
    revalidatePath(`/${locale}/ranking`);
  }
  if (battle.clanWarBattleId) revalidatePath(`/${locale}/clans`);
}
