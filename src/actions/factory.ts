"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { isDatabaseBusyError } from "@/lib/db-errors";
import { allowUserAction } from "@/lib/rate-limit";
import { dayKey } from "@/lib/events/time";
import { simulatePvpBattle } from "@/lib/pvp-battle";
import { getFactoryCatalog } from "@/lib/factory-data";
import {
  FACTORY_DRAFT_SIZE,
  FACTORY_MAX_WINS,
  FACTORY_TEAM_SIZE,
  factoryDraft,
  factoryOpponent,
  factoryExchangeEntry,
  factoryPointsForWins,
  factoryRoundRecord,
  opponentDifficulty,
  parseBattleHistory,
  parseRentals,
  rentalsToBattleTeam,
  type FactoryBattleRound,
  type FactoryRental,
} from "@/lib/factory";

type FactoryError =
  | "unauthorized"
  | "busy"
  | "no_catalog"
  | "already_started"
  | "no_run"
  | "bad_state"
  | "bad_selection"
  | "in_battle"
  | "claimed"
  | "unknown_item"
  | "no_points";

export type FactoryActionResult =
  | { ok: true; battle?: FactoryBattleRound; points?: number }
  | { ok: false; error: FactoryError };

const json = (value: unknown) => value as Prisma.InputJsonValue;

function refreshFactory(locale: string, layout = false) {
  revalidatePath(`/${locale}/factory`);
  if (layout) revalidatePath(`/${locale}`, "layout");
}

export async function createFactoryRun(locale: string): Promise<FactoryActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  if (!(await allowUserAction("battleStart", "factory:create", userId))) {
    return { ok: false, error: "busy" };
  }

  const key = dayKey();
  const catalog = await getFactoryCatalog();
  if (catalog.length < FACTORY_DRAFT_SIZE + FACTORY_TEAM_SIZE) {
    return { ok: false, error: "no_catalog" };
  }
  const draft = factoryDraft(catalog, key);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);
      const [existing, activeBattle] = await Promise.all([
        tx.factoryRun.findUnique({ where: { userId_dayKey: { userId, dayKey: key } } }),
        tx.battleSession.findFirst({
          where: { userId, status: "ACTIVE" },
          select: { id: true },
        }),
      ]);
      if (activeBattle) return { ok: false, error: "in_battle" } as const;
      if (existing) return { ok: false, error: "already_started" } as const;
      await tx.factoryRun.create({
        data: { userId, dayKey: key, draftPool: json(draft) },
      });
      return { ok: true } as const;
    });
    refreshFactory(locale);
    return result;
  } catch (error) {
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }
}

export async function submitFactoryDraft(
  locale: string,
  selectedSpeciesIds: number[],
): Promise<FactoryActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  const key = dayKey();
  const uniqueIds = [...new Set(selectedSpeciesIds)];
  if (uniqueIds.length !== FACTORY_TEAM_SIZE) {
    return { ok: false, error: "bad_selection" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);
      const run = await tx.factoryRun.findUnique({
        where: { userId_dayKey: { userId, dayKey: key } },
      });
      if (!run) return { ok: false, error: "no_run" } as const;
      if (run.status !== "DRAFTING") return { ok: false, error: "bad_state" } as const;
      const pool = parseRentals(run.draftPool);
      const team = uniqueIds.map((id) => pool.find((rental) => rental.speciesId === id));
      if (team.some((rental) => rental === undefined)) {
        return { ok: false, error: "bad_selection" } as const;
      }
      await tx.factoryRun.update({
        where: { id: run.id },
        data: { status: "ACTIVE", team: json(team as FactoryRental[]) },
      });
      return { ok: true } as const;
    });
    refreshFactory(locale);
    return result;
  } catch (error) {
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }
}

export async function fightFactoryRound(locale: string): Promise<FactoryActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  if (!(await allowUserAction("battleStart", "factory:fight", userId))) {
    return { ok: false, error: "busy" };
  }
  const key = dayKey();
  const catalog = await getFactoryCatalog();
  if (catalog.length < FACTORY_TEAM_SIZE) return { ok: false, error: "no_catalog" };

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await lockUsers(tx, userId);
        const [run, activeBattle] = await Promise.all([
          tx.factoryRun.findUnique({ where: { userId_dayKey: { userId, dayKey: key } } }),
          tx.battleSession.findFirst({
            where: { userId, status: "ACTIVE" },
            select: { id: true },
          }),
        ]);
        if (activeBattle) return { ok: false, error: "in_battle" } as const;
        if (!run) return { ok: false, error: "no_run" } as const;
        if (run.status !== "ACTIVE") return { ok: false, error: "bad_state" } as const;
        const team = parseRentals(run.team);
        if (team.length !== FACTORY_TEAM_SIZE) {
          return { ok: false, error: "bad_selection" } as const;
        }

        const battleNumber = run.round + 1;
        const opponent = factoryOpponent(catalog, key, battleNumber);
        const battle = simulatePvpBattle(
          rentalsToBattleTeam(team),
          rentalsToBattleTeam(opponent, opponentDifficulty(battleNumber)),
        );
        const record = factoryRoundRecord(battleNumber, opponent, battle);
        const won = battle.winner === "a";
        const wins = run.round + (won ? 1 : 0);
        const completed = wins >= FACTORY_MAX_WINS;
        const terminal = !won || completed;
        const history = [...parseBattleHistory(run.battleHistory), record];
        const points = terminal ? factoryPointsForWins(wins) : 0;

        await tx.factoryRun.update({
          where: { id: run.id },
          data: {
            status: won ? (completed ? "WON" : "AWAITING_SWAP") : "LOST",
            round: wins,
            lastOpponent: json(opponent),
            battleHistory: json(history),
            totalTurns: { increment: battle.turns },
            pointsAwarded: points,
            endedAt: terminal ? new Date() : null,
          },
        });
        return { ok: true, battle: record, points } as const;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
    refreshFactory(locale);
    return result;
  } catch (error) {
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }
}

export async function chooseFactorySwap(
  locale: string,
  ownSpeciesId: number | null,
  rivalSpeciesId: number | null,
): Promise<FactoryActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  const key = dayKey();

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);
      const run = await tx.factoryRun.findUnique({
        where: { userId_dayKey: { userId, dayKey: key } },
      });
      if (!run) return { ok: false, error: "no_run" } as const;
      if (run.status !== "AWAITING_SWAP") return { ok: false, error: "bad_state" } as const;
      const team = parseRentals(run.team);
      const rival = parseRentals(run.lastOpponent);

      if ((ownSpeciesId === null) !== (rivalSpeciesId === null)) {
        return { ok: false, error: "bad_selection" } as const;
      }
      let nextTeam = team;
      if (ownSpeciesId !== null && rivalSpeciesId !== null) {
        const ownIndex = team.findIndex((rental) => rental.speciesId === ownSpeciesId);
        const incoming = rival.find((rental) => rental.speciesId === rivalSpeciesId);
        if (ownIndex < 0 || !incoming) return { ok: false, error: "bad_selection" } as const;
        if (team.some((rental, index) => index !== ownIndex && rental.speciesId === incoming.speciesId)) {
          return { ok: false, error: "bad_selection" } as const;
        }
        nextTeam = team.map((rental, index) => (index === ownIndex ? incoming : rental));
      }

      await tx.factoryRun.update({
        where: { id: run.id },
        data: { status: "ACTIVE", team: json(nextTeam) },
      });
      return { ok: true } as const;
    });
    refreshFactory(locale);
    return result;
  } catch (error) {
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }
}

export async function claimFactoryReward(locale: string): Promise<FactoryActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  if (!(await allowUserAction("claim", "factory:claim", userId))) {
    return { ok: false, error: "busy" };
  }
  const key = dayKey();

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);
      const run = await tx.factoryRun.findUnique({
        where: { userId_dayKey: { userId, dayKey: key } },
      });
      if (!run) return { ok: false, error: "no_run" } as const;
      if (run.status !== "WON" && run.status !== "LOST") {
        return { ok: false, error: "bad_state" } as const;
      }
      if (run.rewardClaimedAt) return { ok: false, error: "claimed" } as const;
      await tx.factoryRun.update({
        where: { id: run.id },
        data: { rewardClaimedAt: new Date() },
      });
      if (run.pointsAwarded > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { factoryPoints: { increment: run.pointsAwarded } },
        });
      }
      await tx.rewardLedger.create({
        data: {
          userId,
          source: "factory",
          sourceRef: key,
          payload: json({ factoryPoints: run.pointsAwarded, wins: run.round }),
        },
      });
      return { ok: true, points: run.pointsAwarded } as const;
    });
    refreshFactory(locale, true);
    return result;
  } catch (error) {
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }
}

/**
 * Canjea Puntos Fábrica por objetos.
 *
 * El descuento va con guarda de cantidad en el `where` —el mismo patrón que
 * `skip-gym-cooldown`— así que dos envíos simultáneos no pueden gastar los
 * mismos puntos dos veces ni dejar el saldo en negativo. Si la condición no
 * matchea, no se entrega nada.
 */
export async function redeemFactoryPoints(
  itemName: string,
  locale: string,
): Promise<FactoryActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  if (!(await allowUserAction("purchase", "factory:redeem", userId))) {
    return { ok: false, error: "busy" };
  }

  // La lista es cerrada: el nombre que llega del cliente no se usa para buscar
  // en `Item` hasta que matchea una entrada del catálogo.
  const entry = factoryExchangeEntry(itemName);
  if (!entry) return { ok: false, error: "unknown_item" };

  const item = await prisma.item.findFirst({
    where: { name: entry.itemName },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "unknown_item" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);
      const spent = await tx.user.updateMany({
        where: { id: userId, factoryPoints: { gte: entry.cost } },
        data: { factoryPoints: { decrement: entry.cost } },
      });
      if (spent.count === 0) return { ok: false, error: "no_points" } as const;

      await tx.inventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: item.id } },
        create: { userId, itemId: item.id, quantity: entry.quantity },
        update: { quantity: { increment: entry.quantity } },
      });
      return { ok: true, points: entry.cost } as const;
    });

    if (!result.ok) return result;
    refreshFactory(locale, true);
    revalidatePath(`/${locale}/inventory`);
    return result;
  } catch (error) {
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }
}
