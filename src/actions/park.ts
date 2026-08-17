"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { blockIfInCombat } from "@/lib/battle-lock";
import { allowUserAction } from "@/lib/rate-limit";
import { compactTeamSlots } from "@/lib/team";
import { applyXpGain } from "@/lib/battle-xp";
import { getCurrentEnergy, FISHING_ENERGY_COST, FRONTIER_ENERGY_COST, MINE_DIG_ENERGY_COST } from "@/lib/energy";
import { grantPokemon } from "@/lib/grant-pokemon";
import { markSpeciesSeen } from "@/lib/pokedex-seen";
import { isPokemonBusy } from "@/lib/pokemon-busy";
import { dayKey } from "@/lib/events/time";
import { simulatePvpBattle } from "@/lib/pvp-battle";
import { getFactoryCatalog } from "@/lib/factory-data";
import { factoryOpponent, opponentDifficulty, rentalsToBattleTeam } from "@/lib/factory";
import { snapshotTeam, snapToSimTeam, PVP_TEAM_INCLUDE, type TeamRowForSnap } from "@/lib/pvp/team";
import {
  DAYCARE_DEPOSIT_COST,
  DAYCARE_SLOTS,
  daycareCollectFee,
  pendingDaycareLevels,
  xpForDaycareLevels,
} from "@/lib/park/daycare";
import { fishingLevelForLead, rollFishingEncounter } from "@/lib/park/fishing";
import { CORNER_SPIN_COST, spinCorner, type CornerSymbol } from "@/lib/park/corner";
import { FARM_BERRY_NAMES, FARM_PLOT_COUNT, farmReady, farmYield } from "@/lib/park/farm";
import {
  FOSSIL_SPECIES,
  MINE_COIN_DROP,
  MINE_GRID_SIZE,
  MINE_REVIVE_COST,
  generateMineGrid,
  mineDigsLeft,
  parseMineBag,
  parseMineGrid,
  type MineBag,
  type MineLoot,
} from "@/lib/park/mine";
import {
  FRONTIER_DOME_CUP_COINS,
  FRONTIER_DOME_ROUNDS,
  isFrontierFacility,
  palaceWinPayout,
} from "@/lib/park/frontier";
import { wonderNpcLevel, wonderNpcSpecies } from "@/lib/park/wonder";

export type ParkError =
  | "unauthorized"
  | "busy"
  | "in_battle"
  | "not_found"
  | "in_team"
  | "listed"
  | "occupied"
  | "no_coins"
  | "no_energy"
  | "slot_taken"
  | "no_levels"
  | "full"
  | "not_ready"
  | "no_berry"
  | "empty"
  | "no_digs"
  | "dug"
  | "no_team"
  | "no_catalog"
  | "bad_facility";

export type ParkOk<T extends object = object> = { ok: true } & T;
export type ParkResult<T extends object = object> = ParkOk<T> | { ok: false; error: ParkError };

const json = (value: unknown) => value as Prisma.InputJsonValue;

function refreshPark(locale: string) {
  revalidatePath(`/${locale}/park`);
  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/pc`);
  revalidatePath(`/${locale}/inventory`);
  revalidatePath(`/${locale}`, "layout");
}

async function authed(locale: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "unauthorized" as const, userId: "" };
  const userId = session.user.id;
  if (await blockIfInCombat(userId, locale)) {
    return { ok: false as const, error: "in_battle" as const, userId };
  }
  return { ok: true as const, userId };
}

async function spendEnergy(tx: Prisma.TransactionClient, userId: string, cost: number) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  const energy = getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt);
  if (energy < cost) return false;
  await tx.user.update({
    where: { id: userId },
    data: { energy: energy - cost, energyUpdatedAt: new Date() },
  });
  return true;
}

async function assertDepositable(
  tx: Prisma.TransactionClient,
  userId: string,
  instanceId: string,
): Promise<ParkError | null> {
  const mon = await tx.pokemonInstance.findFirst({
    where: { id: instanceId, ownerId: userId },
    include: { listings: { where: { status: "ACTIVE" }, select: { id: true } } },
  });
  if (!mon) return "not_found";
  if (mon.teamSlot !== null) return "in_team";
  if (mon.listings.length > 0) return "listed";
  if (await isPokemonBusy(tx, userId, instanceId)) return "occupied";
  return null;
}

export async function depositDaycare(
  locale: string,
  instanceId: string,
  slot: number,
): Promise<ParkResult> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (slot < 1 || slot > DAYCARE_SLOTS) return { ok: false, error: "not_found" };

  let failure: ParkError | null = null;
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const blocked = await assertDepositable(tx, gate.userId, instanceId);
    if (blocked) return void (failure = blocked);
    const taken = await tx.daycareDeposit.findUnique({
      where: { userId_slot: { userId: gate.userId, slot } },
    });
    if (taken) return void (failure = "slot_taken");
    const user = await tx.user.findUniqueOrThrow({ where: { id: gate.userId } });
    if (user.coins < DAYCARE_DEPOSIT_COST) return void (failure = "no_coins");
    await tx.user.update({
      where: { id: gate.userId },
      data: { coins: { decrement: DAYCARE_DEPOSIT_COST } },
    });
    await tx.pokemonInstance.update({
      where: { id: instanceId },
      data: { teamSlot: null, pvpSlot: null },
    });
    await compactTeamSlots(tx, gate.userId);
    await tx.daycareDeposit.create({
      data: { userId: gate.userId, slot, pokemonInstanceId: instanceId },
    });
  });
  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true };
}

export async function collectDaycare(locale: string, depositId: string): Promise<ParkResult> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  let failure: ParkError | null = null;
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const row = await tx.daycareDeposit.findFirst({
      where: { id: depositId, userId: gate.userId },
      include: { pokemon: { include: { species: true } } },
    });
    if (!row) return void (failure = "not_found");
    const levels = pendingDaycareLevels(row.pokemon.level, row.lastCollectedAt);
    if (levels <= 0) return void (failure = "no_levels");
    const fee = daycareCollectFee(levels);
    const user = await tx.user.findUniqueOrThrow({ where: { id: gate.userId } });
    if (user.coins < fee) return void (failure = "no_coins");
    const xp = xpForDaycareLevels(row.pokemon.xp, row.pokemon.level, levels);
    const gained = applyXpGain(
      row.pokemon.xp,
      row.pokemon.level,
      row.pokemon.currentHp,
      row.pokemon.unspentPoints,
      row.pokemon.species.baseHp,
      row.pokemon.ptConstitution,
      xp,
    );
    await tx.user.update({ where: { id: gate.userId }, data: { coins: { decrement: fee } } });
    await tx.pokemonInstance.update({
      where: { id: row.pokemon.id },
      data: {
        xp: gained.newXpTotal,
        level: gained.newLevel,
        unspentPoints: gained.newUnspentPoints,
        currentHp: gained.newCurrentHp,
      },
    });
    await tx.daycareDeposit.update({
      where: { id: row.id },
      data: { lastCollectedAt: new Date() },
    });
  });
  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true };
}

export async function withdrawDaycare(locale: string, depositId: string): Promise<ParkResult> {
  const collected = await collectDaycare(locale, depositId);
  if (!collected.ok && collected.error !== "no_levels") return collected;
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    await tx.daycareDeposit.deleteMany({ where: { id: depositId, userId: gate.userId } });
  });
  refreshPark(locale);
  return { ok: true };
}

export async function castLine(
  locale: string,
): Promise<ParkResult<{ speciesName: string; caught: boolean; shiny: boolean }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!allowUserAction("battleStart", "park:fish", gate.userId)) {
    return { ok: false, error: "busy" };
  }

  const lead = await prisma.pokemonInstance.findFirst({
    where: { ownerId: gate.userId, teamSlot: { not: null }, currentHp: { gt: 0 } },
    orderBy: { teamSlot: "asc" },
    select: { level: true },
  });
  if (!lead) return { ok: false, error: "no_team" };

  const bite = rollFishingEncounter();
  const level = fishingLevelForLead(lead.level);
  const fishSpecies = await prisma.species.findUnique({
    where: { id: bite.speciesId },
    select: { name: true },
  });
  let grantedName: string | null = null;
  let failure: ParkError | null = null;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    if (!(await spendEnergy(tx, gate.userId, FISHING_ENERGY_COST))) {
      return void (failure = "no_energy");
    }
    if (!bite.caught) return;
    const granted = await grantPokemon(tx, {
      userId: gate.userId,
      speciesId: bite.speciesId,
      level,
      isShiny: bite.isShiny,
    });
    grantedName = granted.speciesName;
  });
  if (failure) return { ok: false, error: failure };
  if (bite.caught) await markSpeciesSeen(gate.userId, bite.speciesId);
  refreshPark(locale);
  return {
    ok: true,
    speciesName: grantedName ?? fishSpecies?.name ?? String(bite.speciesId),
    caught: bite.caught,
    shiny: bite.isShiny && bite.caught,
  };
}

export async function submitWonderTrade(
  locale: string,
  instanceId: string,
): Promise<ParkResult<{ receivedName: string; npc: boolean; queued: boolean }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };

  let failure: ParkError | null = null;
  let receivedName = "";
  let queued = false;

  await prisma.$transaction(async (tx) => {
    const waiting = await tx.wonderTradeOffer.findFirst({
      where: { matchedAt: null, userId: { not: gate.userId } },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
    });
    await lockUsers(tx, gate.userId, waiting?.userId);

    const blocked = await assertDepositable(tx, gate.userId, instanceId);
    if (blocked) return void (failure = blocked);
    const existing = await tx.wonderTradeOffer.findFirst({
      where: { userId: gate.userId, matchedAt: null },
    });
    if (existing) return void (failure = "full");

    const offered = await tx.pokemonInstance.findUniqueOrThrow({
      where: { id: instanceId },
      include: { species: true },
    });

    const partner = waiting
      ? await tx.wonderTradeOffer.findFirst({
          where: { id: waiting.id, matchedAt: null },
          include: { pokemon: { include: { species: true } } },
        })
      : null;

    if (partner) {
      await tx.pokemonInstance.update({
        where: { id: offered.id },
        data: { ownerId: partner.userId, teamSlot: null, pvpSlot: null },
      });
      await tx.pokemonInstance.update({
        where: { id: partner.pokemon.id },
        data: { ownerId: gate.userId, teamSlot: null, pvpSlot: null },
      });
      // La cola sólo guarda ofertas abiertas; el unique de pokemonInstanceId
      // no puede quedarse con historial o ese bicho no se vuelve a truequear.
      await tx.wonderTradeOffer.delete({ where: { id: partner.id } });
      receivedName = partner.pokemon.nickname ?? partner.pokemon.species.name;
      return;
    }

    await tx.pokemonInstance.update({
      where: { id: instanceId },
      data: { teamSlot: null, pvpSlot: null },
    });
    await tx.wonderTradeOffer.create({
      data: { userId: gate.userId, pokemonInstanceId: instanceId },
    });
    queued = true;
  });

  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true, receivedName, npc: false, queued };
}

export async function cancelWonderTrade(locale: string): Promise<ParkResult> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  let failure: ParkError | null = null;
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const open = await tx.wonderTradeOffer.findFirst({
      where: { userId: gate.userId, matchedAt: null },
    });
    if (!open) return void (failure = "empty");
    await tx.wonderTradeOffer.delete({ where: { id: open.id } });
  });
  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true };
}

export async function tradeWithTraveler(
  locale: string,
  instanceId: string,
): Promise<ParkResult<{ receivedName: string }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };

  let failure: ParkError | null = null;
  let receivedName = "";
  let npcSpeciesId: number | null = null;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const blocked = await assertDepositable(tx, gate.userId, instanceId);
    if (blocked) return void (failure = blocked);
    const existing = await tx.wonderTradeOffer.findFirst({
      where: { userId: gate.userId, matchedAt: null },
    });
    if (existing) return void (failure = "full");
    const offered = await tx.pokemonInstance.findUniqueOrThrow({
      where: { id: instanceId },
      include: { species: true },
    });
    await tx.pokemonInstance.delete({ where: { id: instanceId } });
    const speciesId = wonderNpcSpecies(Math.random());
    const level = wonderNpcLevel(offered.level, Math.random());
    const granted = await grantPokemon(tx, { userId: gate.userId, speciesId, level });
    receivedName = granted.speciesName;
    npcSpeciesId = speciesId;
  });

  if (failure) return { ok: false, error: failure };
  if (npcSpeciesId) await markSpeciesSeen(gate.userId, npcSpeciesId);
  refreshPark(locale);
  return { ok: true, receivedName };
}

export async function spinCornerAction(
  locale: string,
): Promise<ParkResult<{ reels: [CornerSymbol, CornerSymbol, CornerSymbol]; payout: number }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!allowUserAction("purchase", "park:corner", gate.userId)) {
    return { ok: false, error: "busy" };
  }
  const spin = spinCorner();
  let failure: ParkError | null = null;
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: gate.userId } });
    if (user.coins < CORNER_SPIN_COST) return void (failure = "no_coins");
    await tx.user.update({
      where: { id: gate.userId },
      data: { coins: { increment: spin.payout - CORNER_SPIN_COST } },
    });
  });
  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true, reels: spin.reels, payout: spin.payout };
}

export async function plantBerry(
  locale: string,
  slot: number,
  itemId: string,
): Promise<ParkResult> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (slot < 1 || slot > FARM_PLOT_COUNT) return { ok: false, error: "not_found" };
  let failure: ParkError | null = null;
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const item = await tx.item.findFirst({
      where: { id: itemId, name: { in: [...FARM_BERRY_NAMES] } },
    });
    if (!item) return void (failure = "no_berry");
    const bag = await tx.inventoryItem.findUnique({
      where: { userId_itemId: { userId: gate.userId, itemId } },
    });
    if (!bag || bag.quantity < 1) return void (failure = "no_berry");
    const plot = await tx.berryPlot.findUnique({
      where: { userId_slot: { userId: gate.userId, slot } },
    });
    if (plot?.berryItemId) return void (failure = "slot_taken");
    const taken = await tx.inventoryItem.updateMany({
      where: { userId: gate.userId, itemId, quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    if (taken.count === 0) return void (failure = "no_berry");
    await tx.berryPlot.upsert({
      where: { userId_slot: { userId: gate.userId, slot } },
      create: { userId: gate.userId, slot, berryItemId: itemId, plantedAt: new Date() },
      update: { berryItemId: itemId, plantedAt: new Date() },
    });
  });
  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true };
}

export async function harvestPlot(locale: string, slot: number): Promise<ParkResult<{ yield: number }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  let harvested = 0;
  let failure: ParkError | null = null;
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const plot = await tx.berryPlot.findUnique({
      where: { userId_slot: { userId: gate.userId, slot } },
    });
    if (!plot?.berryItemId || !plot.plantedAt) return void (failure = "empty");
    if (!farmReady(plot.plantedAt)) return void (failure = "not_ready");
    harvested = farmYield(Math.random());
    await tx.inventoryItem.upsert({
      where: { userId_itemId: { userId: gate.userId, itemId: plot.berryItemId } },
      create: { userId: gate.userId, itemId: plot.berryItemId, quantity: harvested },
      update: { quantity: { increment: harvested } },
    });
    await tx.berryPlot.update({
      where: { userId_slot: { userId: gate.userId, slot } },
      data: { berryItemId: null, plantedAt: null },
    });
  });
  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true, yield: harvested };
}

export async function digMineCell(
  locale: string,
  index: number,
): Promise<ParkResult<{ loot: MineLoot }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (index < 0 || index >= MINE_GRID_SIZE) return { ok: false, error: "not_found" };
  const key = dayKey();
  let loot: MineLoot = "empty";
  let failure: ParkError | null = null;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    let mine = await tx.parkMine.findUnique({ where: { userId: gate.userId } });
    let grid = mine && mine.dayKey === key ? parseMineGrid(mine.grid) : null;
    if (!grid) {
      grid = generateMineGrid(gate.userId, key);
      mine = await tx.parkMine.upsert({
        where: { userId: gate.userId },
        create: { userId: gate.userId, dayKey: key, grid: json(grid), bag: json({ helix: 0, dome: 0, amber: 0 }) },
        update: { dayKey: key, grid: json(grid) },
      });
    }
    if (mineDigsLeft(grid) <= 0) return void (failure = "no_digs");
    const cell = grid[index]!;
    if (cell.dug) return void (failure = "dug");
    if (!(await spendEnergy(tx, gate.userId, MINE_DIG_ENERGY_COST))) {
      return void (failure = "no_energy");
    }
    cell.dug = true;
    loot = cell.loot;
    const bag = parseMineBag(mine!.bag);
    if (loot === "helix" || loot === "dome" || loot === "amber") bag[loot] += 1;
    if (loot === "coins") {
      await tx.user.update({ where: { id: gate.userId }, data: { coins: { increment: MINE_COIN_DROP } } });
    }
    if (loot === "potion" || loot === "stone") {
      const name = loot === "potion" ? "Potion" : "Water Stone";
      const item = await tx.item.findFirst({ where: { name } });
      if (item) {
        await tx.inventoryItem.upsert({
          where: { userId_itemId: { userId: gate.userId, itemId: item.id } },
          create: { userId: gate.userId, itemId: item.id, quantity: 1 },
          update: { quantity: { increment: 1 } },
        });
      }
    }
    await tx.parkMine.update({
      where: { userId: gate.userId },
      data: { grid: json(grid), bag: json(bag) },
    });
  });
  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true, loot };
}

export async function reviveFossil(
  locale: string,
  kind: keyof MineBag,
): Promise<ParkResult<{ speciesName: string }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  const speciesId = FOSSIL_SPECIES[kind];
  if (!speciesId) return { ok: false, error: "not_found" };
  let grantedName = "";
  let failure: ParkError | null = null;
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const mine = await tx.parkMine.findUnique({ where: { userId: gate.userId } });
    const bag = parseMineBag(mine?.bag);
    if (bag[kind] < 1) return void (failure = "empty");
    const user = await tx.user.findUniqueOrThrow({ where: { id: gate.userId } });
    if (user.coins < MINE_REVIVE_COST) return void (failure = "no_coins");
    bag[kind] -= 1;
    await tx.user.update({ where: { id: gate.userId }, data: { coins: { decrement: MINE_REVIVE_COST } } });
    const granted = await grantPokemon(tx, { userId: gate.userId, speciesId, level: 20 });
    grantedName = granted.speciesName;
    await tx.parkMine.upsert({
      where: { userId: gate.userId },
      create: {
        userId: gate.userId,
        dayKey: dayKey(),
        grid: json(generateMineGrid(gate.userId, dayKey())),
        bag: json(bag),
      },
      update: { bag: json(bag) },
    });
  });
  if (failure) return { ok: false, error: failure };
  await markSpeciesSeen(gate.userId, speciesId);
  refreshPark(locale);
  return { ok: true, speciesName: grantedName };
}

export async function playFrontier(
  locale: string,
  facility: string,
): Promise<ParkResult<{ won: boolean; coins: number; streak: number }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!isFrontierFacility(facility)) return { ok: false, error: "bad_facility" };
  if (!allowUserAction("battleStart", "park:frontier", gate.userId)) {
    return { ok: false, error: "busy" };
  }

  const catalog = await getFactoryCatalog();
  if (catalog.length < 6) return { ok: false, error: "no_catalog" };

  const rows = await prisma.pokemonInstance.findMany({
    where: { ownerId: gate.userId, teamSlot: { not: null } },
    include: PVP_TEAM_INCLUDE,
    orderBy: { teamSlot: "asc" },
  });
  if (rows.length === 0) return { ok: false, error: "no_team" };
  const myTeam = snapToSimTeam(snapshotTeam(rows as unknown as TeamRowForSnap[]));

  const key = dayKey();
  let won = false;
  let coins = 0;
  let streak = 0;
  let failure: ParkError | null = null;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    if (!(await spendEnergy(tx, gate.userId, FRONTIER_ENERGY_COST))) {
      return void (failure = "no_energy");
    }
    const existing = await tx.frontierAttempt.findUnique({
      where: { userId_facility_dayKey: { userId: gate.userId, facility, dayKey: key } },
    });
    const rounds = facility === "dome" ? FRONTIER_DOME_ROUNDS : 1;
    let roundWins = 0;
    let lastLog: string[] = [];
    for (let round = 1; round <= rounds; round++) {
      const foe = factoryOpponent(catalog, `${key}:${facility}:${gate.userId}`, (existing?.wins ?? 0) + round);
      const result = simulatePvpBattle(
        myTeam,
        rentalsToBattleTeam(foe, opponentDifficulty(Math.min(7, (existing?.streak ?? 0) + round))),
      );
      lastLog = result.koLog;
      if (result.winner === "a") roundWins += 1;
    }
    if (facility === "palace") {
      won = roundWins === 1;
      streak = won ? (existing?.streak ?? 0) + 1 : 0;
      coins = won ? palaceWinPayout(streak) : 0;
    } else {
      won = roundWins >= 2;
      streak = existing?.streak ?? 0;
      coins = won ? FRONTIER_DOME_CUP_COINS : roundWins * 40;
    }
    if (coins > 0) {
      await tx.user.update({ where: { id: gate.userId }, data: { coins: { increment: coins } } });
    }
    await tx.frontierAttempt.upsert({
      where: { userId_facility_dayKey: { userId: gate.userId, facility, dayKey: key } },
      create: {
        userId: gate.userId,
        facility,
        dayKey: key,
        streak,
        wins: (existing?.wins ?? 0) + roundWins,
        losses: (existing?.losses ?? 0) + (won ? 0 : 1),
        lastWon: won,
        lastLog: json(lastLog),
      },
      update: {
        streak,
        wins: { increment: roundWins },
        losses: { increment: won ? 0 : 1 },
        lastWon: won,
        lastLog: json(lastLog),
      },
    });
  });

  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true, won, coins, streak };
}
