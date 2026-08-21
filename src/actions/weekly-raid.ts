"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { isDatabaseBusyError } from "@/lib/db-errors";
import { reportActionTiming } from "@/lib/action-metrics";
import { allowUserAction } from "@/lib/rate-limit";
import { weekKey } from "@/lib/events/time";
import { grantRewards, writeLedger } from "@/lib/events/grant";
import { getMovesetForLevel } from "@/lib/moveset";
import { getActiveGymRun, revalidateCombatUi } from "@/lib/battle-lock";
import {
  RAID_ATTEMPTS_PER_WEEK,
  RAID_CLAN_BONUS_COINS,
  RAID_COMMUNITY_BONUS,
  RAID_COMMUNITY_HP,
  RAID_REWARD,
  RAID_TURNS_PER_ATTEMPT,
  raidBossBattleHp,
  raidBossForWeek,
} from "@/lib/raids/config";
import { raidDamageDealt, raidSettleStatement } from "@/lib/raids/settle";
import { buildRaidXpUpdates } from "@/lib/raids/xp";

export type RaidActionResult =
  | { ok: true; attemptsUsed: number; totalDamage: number; coins?: number }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "no_team"
        | "team_fainted"
        | "no_attempts"
        | "not_ready"
        | "claimed"
        | "in_battle"
        | "no_raid"
        | "busy";
    };

/**
 * Arranca el combate de incursión.
 *
 * Antes esto era `attackWeeklyRaid`: una fórmula que miraba el equipo y
 * devolvía un número de una sola vez, sin combate. Ahora crea una `BattleSession`
 * real contra el jefe y redirige a `/battle`; el daño se acredita al cerrar el
 * intento (ver `settleRaidAttempt`).
 *
 * El intento se consume **al arrancar**, no al terminar: si se consumiera al
 * final, abandonar la pestaña a mitad de combate sería un intento gratis.
 */
export async function startWeeklyRaidBattle(
  locale: string,
): Promise<RaidActionResult | void> {
  const startedAt = performance.now();
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  if (!(await allowUserAction("battleStart", "raid:start", userId))) {
    return { ok: false, error: "busy" };
  }
  const key = weekKey();
  const boss = raidBossForWeek(key);

  const existing = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "in_battle" };
  if (await getActiveGymRun(userId)) return { ok: false, error: "in_battle" };

  // Fuera de la transacción: son lecturas de catálogo, no dependen del lock.
  const bossSpecies = await prisma.species.findUniqueOrThrow({
    where: { id: boss.speciesId },
  });
  const bossMoveIds = await getMovesetForLevel(boss.speciesId, boss.level);
  const bossMoves = await prisma.move.findMany({ where: { id: { in: bossMoveIds } } });
  const bossMovePp = bossMoveIds.map((id) => bossMoves.find((m) => m.id === id)?.pp ?? 20);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await lockUsers(tx, userId);

        const stillActive = await tx.battleSession.findFirst({
          where: { userId, status: "ACTIVE" },
          select: { id: true },
        });
        if (stillActive) return { ok: false, error: "in_battle" } as const;

        const [current, team] = await Promise.all([
          tx.weeklyRaidScore.findUnique({
            where: { userId_weekKey: { userId, weekKey: key } },
          }),
          tx.pokemonInstance.findMany({
            where: { ownerId: userId, teamSlot: { not: null } },
            orderBy: { teamSlot: "asc" },
            select: { id: true, currentHp: true },
          }),
        ]);
        if (team.length === 0) return { ok: false, error: "no_team" } as const;
        const lead = team.find((member) => member.currentHp > 0);
        if (!lead) return { ok: false, error: "team_fainted" } as const;

        const attemptsUsed = current?.attemptsUsed ?? 0;
        if (attemptsUsed >= RAID_ATTEMPTS_PER_WEEK) {
          return { ok: false, error: "no_attempts" } as const;
        }

        const next = await tx.weeklyRaidScore.upsert({
          where: { userId_weekKey: { userId, weekKey: key } },
          create: {
            userId,
            weekKey: key,
            bossSpeciesId: boss.speciesId,
            attemptsUsed: 1,
            totalDamage: 0,
            bestDamage: 0,
          },
          update: { attemptsUsed: { increment: 1 } },
        });

        await tx.battleSession.create({
          data: {
            userId,
            pokemonInstanceId: lead.id,
            raidWeekKey: key,
            raidTurnsLeft: RAID_TURNS_PER_ATTEMPT,
            wildSpeciesId: boss.speciesId,
            wildLevel: boss.level,
            wildCurrentHp: raidBossBattleHp(boss.level),
            wildMaxHp: raidBossBattleHp(boss.level),
            wildMoveIds: bossMoveIds,
            wildMovePp: bossMovePp,
            log: [`appear:${bossSpecies.name}`],
            participantIds: [lead.id],
            // Sin reloj de inactividad: el límite de turnos ya cierra el intento.
            turnDeadlineAt: null,
          },
        });

        return {
          ok: true,
          attemptsUsed: next.attemptsUsed,
          totalDamage: next.totalDamage,
        } as const;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    reportActionTiming("startWeeklyRaidBattle", startedAt, { ok: result.ok });
    if (!result.ok) return result;
  } catch (error) {
    reportActionTiming("startWeeklyRaidBattle", startedAt, { ok: false });
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }

  revalidatePath(`/${locale}/raids`);
  revalidateCombatUi(locale);
  redirect({ href: "/battle", locale });
}

/**
 * Abandona el intento en curso.
 *
 * Existe porque una sesión de incursión abierta bloquea **todo** otro combate
 * (`redirectIfInBattle`): sin salida, cerrar la pestaña a mitad de un intento
 * dejaba al jugador sin poder pelear nada hasta volver y gastar los turnos.
 * Gimnasio y torre ya tenían su salida; ésta faltaba.
 *
 * El intento **no** se devuelve: se cobró al arrancar. Lo que sí se respeta es
 * el daño hecho hasta acá, que se acredita igual que en cualquier otro cierre.
 */
export async function abandonWeeklyRaidBattle(
  locale: string,
): Promise<RaidActionResult | void> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE", raidWeekKey: { not: null } },
    select: {
      id: true,
      raidWeekKey: true,
      wildLevel: true,
      wildMaxHp: true,
      wildCurrentHp: true,
      participantIds: true,
      pokemonInstanceId: true,
    },
  });
  if (!battle?.raidWeekKey) return { ok: false, error: "no_raid" };

  const damage = raidDamageDealt(battle.wildMaxHp, battle.wildCurrentHp);
  const settle = raidSettleStatement(prisma, {
    userId,
    weekKey: battle.raidWeekKey,
    damage,
  });

  // Retirarse pierde el intento, no la experiencia del daño ya hecho: si no,
  // la salida que agregamos para no quedar trabado castigaría dos veces.
  const raidXp = await buildRaidXpUpdates(prisma, {
    userId,
    bossLevel: battle.wildLevel,
    damageDealt: damage,
    bossMaxHp: battle.wildMaxHp,
    participantIds: battle.participantIds,
  });

  /*
    El cierre va con guarda de estado, no con un `update` a ciegas.

    Con AUTO encendido puede haber un turno en vuelo cuando el jugador se
    retira: sin la guarda, los dos cierres acreditan daño y XP sobre el mismo
    intento. `updateMany` con `status: "ACTIVE"` hace que sólo uno gane, y si
    perdemos la carrera no se acredita nada acá — el turno que ganó ya lo hizo.
  */
  try {
    const closed = await prisma.$transaction(async (tx) => {
      const result = await tx.battleSession.updateMany({
        where: { id: battle.id, status: "ACTIVE" },
        data: { status: "LOST", turnDeadlineAt: null },
      });
      if (result.count === 0) return false;
      if (settle) await settle;
      for (const update of raidXp.updates) await update;
      return true;
    });
    if (!closed) {
      revalidateCombatUi(locale);
      redirect({ href: "/raids", locale });
      return;
    }
  } catch (error) {
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }

  revalidatePath(`/${locale}/raids`);
  revalidateCombatUi(locale);
  redirect({ href: "/raids", locale });
}

export async function claimWeeklyRaidReward(locale: string): Promise<RaidActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  if (!(await allowUserAction("claim", "raid:claim", userId))) {
    return { ok: false, error: "busy" };
  }
  const key = weekKey();
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await lockUsers(tx, userId);
        const score = await tx.weeklyRaidScore.findUnique({
          where: { userId_weekKey: { userId, weekKey: key } },
        });
        if (!score || score.attemptsUsed < RAID_ATTEMPTS_PER_WEEK) {
          return { ok: false, error: "not_ready" } as const;
        }
        if (score.rewardClaimedAt) return { ok: false, error: "claimed" } as const;
        const [membership, community] = await Promise.all([
          tx.clanMember.findUnique({ where: { userId }, select: { clanId: true } }),
          tx.weeklyRaidScore.aggregate({
            where: { weekKey: key },
            _sum: { totalDamage: true },
          }),
        ]);
        // El bonus comunitario se resuelve **al reclamar**, con el total del
        // momento: si la barra cae después de que reclamaste, no se retroactiva.
        const communityDefeated = (community._sum.totalDamage ?? 0) >= RAID_COMMUNITY_HP;
        const rewards = [
          ...RAID_REWARD,
          ...(membership
            ? [{ kind: "coins", amount: RAID_CLAN_BONUS_COINS } as const]
            : []),
          ...(communityDefeated ? RAID_COMMUNITY_BONUS : []),
        ];
        await tx.weeklyRaidScore.update({
          where: { userId_weekKey: { userId, weekKey: key } },
          data: { rewardClaimedAt: new Date() },
        });
        const granted = await grantRewards(tx, userId, rewards);
        await writeLedger(tx, { userId, source: "raid", sourceRef: key, result: granted });
        return {
          ok: true,
          attemptsUsed: score.attemptsUsed,
          totalDamage: score.totalDamage,
          coins: granted.coinsDelta,
        } as const;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
    revalidatePath(`/${locale}`, "layout");
    revalidatePath(`/${locale}/raids`);
    return result;
  } catch (error) {
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }
}
