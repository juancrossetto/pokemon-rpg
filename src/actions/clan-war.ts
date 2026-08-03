"use server";

import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockClan, lockUsers } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import { blockIfInCombat, revalidateCombatUi } from "@/lib/battle-lock";
import { getCurrentEnergy } from "@/lib/energy";
import { simulatePvpBattle } from "@/lib/pvp-battle";
import { primeChallengerTeamForBattle } from "@/lib/pvp/restore";
import {
  PVP_TEAM_INCLUDE,
  resolveTeamRows,
  snapToSimTeam,
  snapshotTeam,
  type TeamRowForSnap,
} from "@/lib/pvp/team";
import {
  CLAN_WAR_BATTLE_SLOTS,
  CLAN_WAR_ENERGY_COST,
  CLAN_WAR_STARTING_RATING,
  buildWarBattleSlots,
  canRegisterForWar,
  clanLevelFromBadges,
  ensureClanWarSeason,
  pickWarOpponent,
} from "@/lib/clan-war";
import { settleClanWarSlot } from "@/lib/clan-war/settle-slot";

export type ClanWarActionResult =
  | { ok: true; warId?: string; battleId?: string; won?: boolean }
  | { ok: false; error: string };

export type ClanWarFoeOption = {
  userId: string;
  username: string;
  teamSize: number;
  topLevel: number;
};

function isSeedBotUsername(username: string): boolean {
  return /^(EnemyBot|WarBot|RivalChief)/i.test(username);
}

async function loadTeamRows(
  userId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<TeamRowForSnap[]> {
  const rows = await db.pokemonInstance.findMany({
    where: {
      ownerId: userId,
      OR: [{ pvpSlot: { not: null } }, { teamSlot: { not: null } }],
    },
    include: PVP_TEAM_INCLUDE,
  });
  return resolveTeamRows(rows as TeamRowForSnap[]);
}

async function clanBadgeTotal(clanId: string): Promise<{ memberCount: number; totalBadges: number }> {
  const members = await prisma.clanMember.findMany({
    where: { clanId },
    select: {
      userId: true,
      user: { select: { _count: { select: { badges: true } } } },
    },
  });
  return {
    memberCount: members.length,
    totalBadges: members.reduce((s, m) => s + m.user._count.badges, 0),
  };
}

async function requireOfficer(userId: string, clanId: string) {
  const m = await prisma.clanMember.findUnique({ where: { userId } });
  if (!m || m.clanId !== clanId) return null;
  if (m.role !== "LEADER" && m.role !== "OFFICER") return null;
  return m;
}

async function tryMatchClan(
  tx: Prisma.TransactionClient,
  seasonId: string,
  clanId: string,
): Promise<string | null> {
  const myReg = await tx.clanWarRegistration.findUnique({
    where: { seasonId_clanId: { seasonId, clanId } },
  });
  if (!myReg) return null;

  const activeWar = await tx.clanWar.findFirst({
    where: {
      seasonId,
      status: { in: ["PENDING", "ACTIVE"] },
      OR: [{ clanAId: clanId }, { clanBId: clanId }],
    },
    select: { id: true },
  });
  if (activeWar) return activeWar.id;

  const busyClanIds = new Set(
    (
      await tx.clanWar.findMany({
        where: { seasonId, status: { in: ["PENDING", "ACTIVE"] } },
        select: { clanAId: true, clanBId: true },
      })
    ).flatMap((w) => [w.clanAId, w.clanBId]),
  );

  const waiting = await tx.clanWarRegistration.findMany({
    where: { seasonId, clanId: { not: clanId } },
  });
  const candidates = waiting
    .filter((r) => !busyClanIds.has(r.clanId))
    .map((r) => ({
      clanId: r.clanId,
      registrationId: r.id,
      rating: r.rating,
    }));

  const opp = pickWarOpponent(
    { clanId, registrationId: myReg.id, rating: myReg.rating },
    candidates,
  );
  if (!opp) return null;

  const oppReg = waiting.find((r) => r.clanId === opp.clanId);
  if (!oppReg) return null;

  const [clanAId, clanBId, ratingA, ratingB] =
    clanId < opp.clanId
      ? [clanId, opp.clanId, myReg.rating, oppReg.rating]
      : [opp.clanId, clanId, oppReg.rating, myReg.rating];

  const war = await tx.clanWar.create({
    data: {
      seasonId,
      clanAId,
      clanBId,
      status: "ACTIVE",
      ratingABefore: ratingA,
      ratingBBefore: ratingB,
      battles: {
        create: buildWarBattleSlots(CLAN_WAR_BATTLE_SLOTS).map((slot) => ({ slot })),
      },
    },
    select: { id: true },
  });
  return war.id;
}

export async function registerClanForWar(
  locale: string,
  clanId: string,
): Promise<ClanWarActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (!allowAction(`clan-war:reg:${userId}`, 10, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }

  const officer = await requireOfficer(userId, clanId);
  if (!officer) return { ok: false, error: "not_officer" };

  const stats = await clanBadgeTotal(clanId);
  const gate = canRegisterForWar(stats);
  if (!gate.ok) return { ok: false, error: gate.reason === "members" ? "need_members" : "need_level" };

  const members = await prisma.clanMember.findMany({
    where: { clanId },
    select: { userId: true },
  });
  const roster = members.map((m) => m.userId);

  let warId: string | null = null;
  try {
    warId = await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);
      const season = await ensureClanWarSeason(tx);

      const existing = await tx.clanWarRegistration.findUnique({
        where: { seasonId_clanId: { seasonId: season.id, clanId } },
      });
      if (!existing) {
        const last = await tx.clanWar.findFirst({
          where: {
            status: "COMPLETED",
            OR: [{ clanAId: clanId }, { clanBId: clanId }],
          },
          orderBy: { completedAt: "desc" },
        });
        let rating = CLAN_WAR_STARTING_RATING;
        if (last) {
          rating =
            last.clanAId === clanId
              ? (last.ratingAAfter ?? last.ratingABefore)
              : (last.ratingBAfter ?? last.ratingBBefore);
        }
        await tx.clanWarRegistration.create({
          data: { seasonId: season.id, clanId, rating, roster },
        });
      }

      return tryMatchClan(tx, season.id, clanId);
    });
  } catch (e) {
    console.error("registerClanForWar", e);
    return { ok: false, error: "failed" };
  }

  revalidatePath(`/${locale}/clans/${clanId}`, "page");
  revalidatePath(`/${locale}`, "layout");
  return { ok: true, warId: warId ?? undefined };
}

export async function matchClanWar(
  locale: string,
  clanId: string,
): Promise<ClanWarActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const officer = await requireOfficer(userId, clanId);
  if (!officer) return { ok: false, error: "not_officer" };

  let warId: string | null = null;
  try {
    warId = await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);
      const season = await ensureClanWarSeason(tx);
      const reg = await tx.clanWarRegistration.findUnique({
        where: { seasonId_clanId: { seasonId: season.id, clanId } },
      });
      if (!reg) return null;
      return tryMatchClan(tx, season.id, clanId);
    });
  } catch (e) {
    console.error("matchClanWar", e);
    return { ok: false, error: "failed" };
  }

  if (!warId) return { ok: false, error: "no_opponent" };
  revalidatePath(`/${locale}/clans/${clanId}`, "page");
  revalidatePath(`/${locale}`, "layout");
  return { ok: true, warId };
}

/** Rivales disponibles para un slot (aún no pelearon, tienen equipo). */
export async function listClanWarFoes(
  warId: string,
): Promise<{ ok: true; foes: ClanWarFoeOption[] } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const membership = await prisma.clanMember.findUnique({ where: { userId } });
  if (!membership) return { ok: false, error: "not_in_clan" };

  const war = await prisma.clanWar.findUnique({
    where: { id: warId },
    include: { battles: true },
  });
  if (!war || war.status !== "ACTIVE") return { ok: false, error: "war_closed" };

  const mySide =
    war.clanAId === membership.clanId ? "A" : war.clanBId === membership.clanId ? "B" : null;
  if (!mySide) return { ok: false, error: "not_in_war" };

  const foeClanId = mySide === "A" ? war.clanBId : war.clanAId;
  const used = new Set(
    war.battles.flatMap((b) =>
      [b.fighterAId, b.fighterBId].filter((id): id is string => Boolean(id)),
    ),
  );

  const foesRaw = await prisma.clanMember.findMany({
    where: { clanId: foeClanId, userId: { notIn: [...used] } },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          pokemon: {
            where: { OR: [{ pvpSlot: { not: null } }, { teamSlot: { not: null } }] },
            select: { level: true, pvpSlot: true, teamSlot: true },
          },
        },
      },
    },
  });

  const foes: ClanWarFoeOption[] = foesRaw
    .map((m) => {
      const team = resolveTeamRows(m.user.pokemon);
      return {
        userId: m.user.id,
        username: m.user.username,
        teamSize: team.length,
        topLevel: team.reduce((max, p) => Math.max(max, p.level), 0),
      };
    })
    .filter((f) => f.teamSize > 0)
    .sort((a, b) => b.topLevel - a.topLevel || a.username.localeCompare(b.username));

  return { ok: true, foes };
}

/**
 * Elige rival + pelea interactiva (turno a turno en /battle).
 * Usa el equipo PvP si hay preset; si no, el de aventura.
 */
export async function startClanWarBattle(
  locale: string,
  warId: string,
  slot: number,
  foeUserId: string,
): Promise<ClanWarActionResult | void> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (!allowAction(`clan-war:fight:${userId}`, 20, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }
  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const membership = await prisma.clanMember.findUnique({ where: { userId } });
  if (!membership) return { ok: false, error: "not_in_clan" };

  const myTeamRows = await loadTeamRows(userId);
  if (myTeamRows.length === 0) return { ok: false, error: "no_team" };

  const foeTeamRows = await loadTeamRows(foeUserId);
  if (foeTeamRows.length === 0) return { ok: false, error: "no_foe" };

  const challengerTeam = snapshotTeam(myTeamRows);
  const opponentTeam = snapshotTeam(foeTeamRows);
  const lead = challengerTeam[0];
  const firstOpp = opponentTeam[0];
  if (!lead || !firstOpp) return { ok: false, error: "no_team" };

  let clanIdForRevalidate = membership.clanId;
  let ok = false;

  try {
    await prisma.$transaction(
      async (tx) => {
        const war = await tx.clanWar.findUnique({
          where: { id: warId },
          include: { battles: true },
        });
        if (!war || war.status !== "ACTIVE") throw new Error("war_closed");

        const mySide =
          war.clanAId === membership.clanId
            ? "A"
            : war.clanBId === membership.clanId
              ? "B"
              : null;
        if (!mySide) throw new Error("not_in_war");
        clanIdForRevalidate = membership.clanId;

        const battle = war.battles.find((b) => b.slot === slot);
        if (!battle || battle.status !== "OPEN") throw new Error("slot_taken");

        const alreadyFought = war.battles.some(
          (b) =>
            (b.status === "COMPLETED" || b.status === "IN_PROGRESS" || b.status === "FORFEIT") &&
            (b.fighterAId === userId || b.fighterBId === userId),
        );
        if (alreadyFought) throw new Error("already_fought");

        const foeClanId = mySide === "A" ? war.clanBId : war.clanAId;
        const foeMember = await tx.clanMember.findUnique({ where: { userId: foeUserId } });
        if (!foeMember || foeMember.clanId !== foeClanId) throw new Error("no_foe");

        const used = new Set(
          war.battles.flatMap((b) =>
            [b.fighterAId, b.fighterBId].filter((id): id is string => Boolean(id)),
          ),
        );
        if (used.has(foeUserId)) throw new Error("slot_taken");

        await lockUsers(tx, userId, foeUserId);

        const fresh = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { energy: true, energyMax: true, energyUpdatedAt: true },
        });
        const currentEnergy = getCurrentEnergy(
          fresh.energy,
          fresh.energyMax,
          fresh.energyUpdatedAt,
        );
        if (currentEnergy < CLAN_WAR_ENERGY_COST) throw new Error("no_energy");

        const fighterAId = mySide === "A" ? userId : foeUserId;
        const fighterBId = mySide === "A" ? foeUserId : userId;

        await tx.clanWarBattle.update({
          where: { id: battle.id },
          data: {
            status: "IN_PROGRESS",
            fighterA: { connect: { id: fighterAId } },
            fighterB: { connect: { id: fighterBId } },
            startedById: userId,
            challengerTeam: challengerTeam as Prisma.InputJsonValue,
            opponentTeam: opponentTeam as Prisma.InputJsonValue,
          },
        });

        await primeChallengerTeamForBattle(tx, challengerTeam);

        await tx.user.update({
          where: { id: userId },
          data: {
            energy: currentEnergy - CLAN_WAR_ENERGY_COST,
            energyUpdatedAt: new Date(),
          },
        });

        const foeName =
          (
            await tx.user.findUnique({
              where: { id: foeUserId },
              select: { username: true },
            })
          )?.username ?? "Rival";

        await tx.battleSession.create({
          data: {
            userId,
            pokemonInstanceId: lead.instanceId,
            wildSpeciesId: firstOpp.speciesId,
            wildLevel: firstOpp.level,
            wildCurrentHp: firstOpp.maxHp,
            wildMaxHp: firstOpp.maxHp,
            wildMoveIds: firstOpp.moves.map((m) => m.id),
            wildMovePp: firstOpp.moves.map((m) => m.maxPp),
            wildHeldItemId: firstOpp.heldItemId,
            wildItemConsumed: false,
            clanWarBattleId: battle.id,
            opponentUserId: foeUserId,
            opponentSlot: firstOpp.slot,
            log: [`challengeClanWar:${foeName}`, `sendOut:${firstOpp.speciesName}`],
            participantIds: [lead.instanceId],
          },
        });
        ok = true;
      },
      { timeout: 20_000 },
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "failed";
    if (
      [
        "war_closed",
        "not_in_war",
        "slot_taken",
        "already_fought",
        "no_foe",
        "no_energy",
      ].includes(code)
    ) {
      return { ok: false, error: code };
    }
    console.error("startClanWarBattle", e);
    return { ok: false, error: "failed" };
  }

  if (!ok) return { ok: false, error: "failed" };

  revalidatePath(`/${locale}/clans/${clanIdForRevalidate}`, "page");
  revalidateCombatUi(locale);
  redirect({ href: "/battle", locale });
}

/** Slots que se dejan abiertos para humanos (no se auto-simulan). */
const CLAN_WAR_HUMAN_RESERVED_SLOTS = 2;

/**
 * Bots del clan rival (y aliados bot) resuelven slots abiertos por simulación.
 * Se llama al cargar el hub para dar dinamismo — deja slots libres para humanos
 * y como máximo 1 resolución por carga.
 */
export async function autoResolveClanWarBotSlots(warId: string): Promise<number> {
  const war = await prisma.clanWar.findUnique({
    where: { id: warId },
    include: {
      battles: true,
      clanA: { select: { id: true } },
      clanB: { select: { id: true } },
    },
  });
  if (!war || war.status !== "ACTIVE") return 0;

  let resolved = 0;
  // 1 por carga: ritmo de guerra sin vaciar los slots de humanos.
  for (let n = 0; n < 1; n++) {
    const fresh = await prisma.clanWar.findUnique({
      where: { id: warId },
      include: {
        battles: true,
        clanA: {
          select: {
            members: {
              include: { user: { select: { id: true, username: true } } },
            },
          },
        },
        clanB: {
          select: {
            members: {
              include: { user: { select: { id: true, username: true } } },
            },
          },
        },
      },
    });
    if (!fresh || fresh.status !== "ACTIVE") break;

    const openBattles = fresh.battles.filter((b) => b.status === "OPEN");
    // Reservar slots para que Crossetto (u otros humanos) puedan pelear.
    if (openBattles.length <= CLAN_WAR_HUMAN_RESERVED_SLOTS) break;
    const open = openBattles[0];
    if (!open) break;

    const used = new Set(
      fresh.battles.flatMap((b) =>
        [b.fighterAId, b.fighterBId].filter((id): id is string => Boolean(id)),
      ),
    );

    const sideA = fresh.clanA.members
      .filter((m) => !used.has(m.user.id) && isSeedBotUsername(m.user.username))
      .map((m) => m.user.id);
    const sideB = fresh.clanB.members
      .filter((m) => !used.has(m.user.id) && isSeedBotUsername(m.user.username))
      .map((m) => m.user.id);

    // Preferir bot vs bot; si un lado no tiene bot libre, no auto-resolvemos
    // (dejamos slots para humanos).
    if (sideA.length === 0 || sideB.length === 0) break;

    let fighterA: string | null = null;
    let fighterB: string | null = null;
    let teamA: ReturnType<typeof snapshotTeam> | null = null;
    let teamB: ReturnType<typeof snapshotTeam> | null = null;

    for (const id of sideA.sort(() => Math.random() - 0.5)) {
      const rows = await loadTeamRows(id);
      if (rows.length > 0) {
        fighterA = id;
        teamA = snapshotTeam(rows);
        break;
      }
    }
    for (const id of sideB.sort(() => Math.random() - 0.5)) {
      const rows = await loadTeamRows(id);
      if (rows.length > 0) {
        fighterB = id;
        teamB = snapshotTeam(rows);
        break;
      }
    }
    if (!fighterA || !fighterB || !teamA || !teamB) break;

    const sim = simulatePvpBattle(snapToSimTeam(teamA), snapToSimTeam(teamB));
    const aWon = sim.winner === "a";
    const winnerClanId = aWon ? fresh.clanAId : fresh.clanBId;
    const winnerUserId = aWon ? fighterA : fighterB;

    await prisma.$transaction(async (tx) => {
      await tx.clanWarBattle.update({
        where: { id: open.id },
        data: {
          fighterA: { connect: { id: fighterA } },
          fighterB: { connect: { id: fighterB } },
          challengerTeam: teamA as Prisma.InputJsonValue,
          opponentTeam: teamB as Prisma.InputJsonValue,
        },
      });
      await settleClanWarSlot(tx, {
        battleId: open.id,
        winnerClanId,
        winnerUserId,
        koLog: sim.koLog,
      });
    });
    resolved += 1;
  }

  return resolved;
}

const warHubInclude = {
  clanA: { select: { id: true, name: true, tag: true, emblem: true } },
  clanB: { select: { id: true, name: true, tag: true, emblem: true } },
  battles: {
    orderBy: { slot: "asc" as const },
    include: {
      fighterA: { select: { id: true, username: true } },
      fighterB: { select: { id: true, username: true } },
    },
  },
};

/** Estado de guerra para el hub (server component). */
export async function getClanWarHubState(clanId: string) {
  const season = await ensureClanWarSeason(prisma);
  const registration = await prisma.clanWarRegistration.findUnique({
    where: { seasonId_clanId: { seasonId: season.id, clanId } },
  });
  let war = await prisma.clanWar.findFirst({
    where: {
      seasonId: season.id,
      OR: [{ clanAId: clanId }, { clanBId: clanId }],
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: { matchedAt: "desc" },
    include: warHubInclude,
  });

  if (war && war.status === "ACTIVE") {
    try {
      const n = await autoResolveClanWarBotSlots(war.id);
      if (n > 0) {
        war = await prisma.clanWar.findFirst({
          where: { id: war.id },
          include: warHubInclude,
        });
      }
    } catch (err) {
      // No tumbar el hub si el auto-sim de bots falla (client Prisma stale, etc.).
      console.error("[clan-war] autoResolveClanWarBotSlots failed:", err);
    }
  }

  const history = await prisma.clanWar.findMany({
    where: {
      OR: [{ clanAId: clanId }, { clanBId: clanId }],
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    take: 12,
    include: {
      clanA: { select: { id: true, name: true, tag: true, emblem: true } },
      clanB: { select: { id: true, name: true, tag: true, emblem: true } },
      season: { select: { seasonKey: true } },
      battles: {
        orderBy: { slot: "asc" },
        include: {
          fighterA: { select: { id: true, username: true } },
          fighterB: { select: { id: true, username: true } },
        },
      },
    },
  });

  const stats = await clanBadgeTotal(clanId);
  const gate = canRegisterForWar(stats);

  return {
    seasonKey: season.seasonKey,
    registered: Boolean(registration),
    rating: registration?.rating ?? CLAN_WAR_STARTING_RATING,
    gate,
    level: clanLevelFromBadges(stats.totalBadges),
    memberCount: stats.memberCount,
    war,
    history,
  };
}
