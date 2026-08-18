"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { blockIfInCombat } from "@/lib/battle-lock";
import { allowUserAction } from "@/lib/rate-limit";
import { compactTeamSlots } from "@/lib/team";
import { applyXpGain } from "@/lib/battle-xp";
import { getCurrentEnergy, FRONTIER_ENERGY_COST } from "@/lib/energy";
import { grantPokemon } from "@/lib/grant-pokemon";
import { markSpeciesSeen } from "@/lib/pokedex-seen";
import { speciesRarity, type DexRarity } from "@/lib/pokedex";
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
  daycareLevelCeiling,
  pendingDaycareLevels,
  xpForDaycareLevels,
} from "@/lib/park/daycare";
import {
  fishingCastsUsedToday,
  fishingEnergyCost,
  fishingFreeLeft,
  rollFishingEncounter,
} from "@/lib/park/fishing";
import {
  assembledPokemonLevel,
  FISHING_FRAGMENT_YIELD,
  FRAGMENTS_TO_ASSEMBLE,
} from "@/lib/park/fragments";
import { absorbLegacyFossilBag, creditFragments } from "@/lib/park/fragment-store";
import {
  cornerEnergyCost,
  cornerFreeLeft,
  cornerSpinsUsedToday,
  spinCorner,
  type CornerSymbol,
} from "@/lib/park/corner";
import { FARM_BERRY_NAMES, FARM_PLOT_COUNT, farmReady, farmYield } from "@/lib/park/farm";
import {
  FOSSIL_SPECIES,
  MINE_COIN_DROP,
  MINE_FRAGMENTS_TO_ASSEMBLE,
  MINE_GRID_SIZE,
  generateMineGrid,
  mineDigsLeft,
  parseMineBag,
  parseMineGrid,
  type MineBag,
  type MineLoot,
} from "@/lib/park/mine";
import {
  FRONTIER_DOME_CUP_COINS,
  FRONTIER_DOME_ROUND_COINS,
  FRONTIER_DOME_ROUNDS,
  isFrontierFacility,
  palaceWinPayout,
} from "@/lib/park/frontier";
import {
  isWonderUnlocked,
  toWonderSnap,
  wonderEnergyCost,
  wonderFreeLeft,
  wonderNpcAllowed,
  wonderNpcLevel,
  wonderNpcSpecies,
  wonderTiersMatch,
  wonderTradeTier,
  wonderTradesUsedToday,
  type WonderReceipt,
} from "@/lib/park/wonder";

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
  | "bad_facility"
  | "locked"
  | "too_rare"
  | "daycare_ceiling";

export type ParkOk<T extends object = object> = { ok: true } & T;
export type ParkResult<T extends object = object> = ParkOk<T> | { ok: false; error: ParkError };

const json = (value: unknown) => value as Prisma.InputJsonValue;

function refreshPark(locale: string) {
  // Diferido: si revalidamos el layout acá, la action no vuelve al celular
  // hasta que termina el RSC del parque entero y el trueque se queda en
  // "el reactor está cargando" para siempre.
  after(() => {
    revalidatePath(`/${locale}/park`);
    revalidatePath(`/${locale}/team`);
    revalidatePath(`/${locale}/pc`);
    revalidatePath(`/${locale}/inventory`);
    revalidatePath(`/${locale}`, "layout");
  });
}

const WONDER_SPECIES = {
  include: { evolvesTo: { select: { id: true } } },
} as const;

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

async function takeWonderQuota(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<{ energySpent: number; usedAfter: number } | { error: ParkError }> {
  const key = dayKey();
  const row = await tx.parkWonder.findUnique({ where: { userId } });
  const used = wonderTradesUsedToday(row, key);
  const energySpent = wonderEnergyCost(used);
  if (energySpent > 0 && !(await spendEnergy(tx, userId, energySpent))) {
    return { error: "no_energy" };
  }
  const usedAfter = used + 1;
  await tx.parkWonder.upsert({
    where: { userId },
    create: { userId, dayKey: key, trades: 1 },
    update: row && row.dayKey === key ? { trades: { increment: 1 } } : { dayKey: key, trades: 1 },
  });
  return { energySpent, usedAfter };
}

async function assertWonderOpen(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<ParkError | null> {
  const badgeCount = await tx.badge.count({ where: { userId } });
  if (!isWonderUnlocked(badgeCount)) return "locked";
  return null;
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
    const [badgeCount, mon] = await Promise.all([
      tx.badge.count({ where: { userId: gate.userId } }),
      tx.pokemonInstance.findFirst({
        where: { id: instanceId, ownerId: gate.userId },
        select: { level: true },
      }),
    ]);
    if (!mon) return void (failure = "not_found");
    if (mon.level >= daycareLevelCeiling(badgeCount)) return void (failure = "daycare_ceiling");
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

export async function collectDaycare(
  locale: string,
  depositId: string,
): Promise<ParkResult<{ levels: number; fee: number; name: string }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  let failure: ParkError | null = null;
  let levelsGained = 0;
  let feePaid = 0;
  let name = "";
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const row = await tx.daycareDeposit.findFirst({
      where: { id: depositId, userId: gate.userId },
      include: { pokemon: { include: { species: true } } },
    });
    if (!row) return void (failure = "not_found");
    const badgeCount = await tx.badge.count({ where: { userId: gate.userId } });
    const levels = pendingDaycareLevels(row.pokemon.level, row.lastCollectedAt, badgeCount);
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
    levelsGained = levels;
    feePaid = fee;
    name = row.pokemon.nickname ?? row.pokemon.species.name;
  });
  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return { ok: true, levels: levelsGained, fee: feePaid, name };
}

export async function withdrawDaycare(
  locale: string,
  depositId: string,
): Promise<ParkResult<{ levels: number }>> {
  const collected = await collectDaycare(locale, depositId);
  if (!collected.ok && collected.error !== "no_levels") return collected;
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    await tx.daycareDeposit.deleteMany({ where: { id: depositId, userId: gate.userId } });
  });
  refreshPark(locale);
  return { ok: true, levels: collected.ok ? collected.levels : 0 };
}

export async function castLine(
  locale: string,
): Promise<
  ParkResult<{
    speciesName: string;
    speciesId: number;
    /** Nivel al armar / shiny. Los fragmentos no tienen nivel (va 0). */
    level: number;
    rarity: "common" | "uncommon" | "rare";
    /** Rareza de Pokédex: es la que pinta el cristal del fragmento. */
    dexRarity: DexRarity;
    caught: boolean;
    shiny: boolean;
    gained: number;
    have: number;
    need: number;
    assembled: boolean;
    energySpent: number;
    freeLeft: number;
  }>
> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!allowUserAction("battleStart", "park:fish", gate.userId)) {
    return { ok: false, error: "busy" };
  }

  const lead = await prisma.pokemonInstance.findFirst({
    where: { ownerId: gate.userId, teamSlot: { not: null }, currentHp: { gt: 0 } },
    orderBy: { teamSlot: "asc" },
    select: { id: true },
  });
  if (!lead) return { ok: false, error: "no_team" };

  const bite = rollFishingEncounter();
  const level = assembledPokemonLevel(bite.rarity);
  const fishSpecies = await prisma.species.findUnique({
    where: { id: bite.speciesId },
    // `captureRate` es lo que necesita `speciesRarity` para decidir la rareza
    // de Pokédex, que es la que pinta el cristal del fragmento. La rareza de la
    // tabla de caña es otra escala (qué tan seguido pica), no sirve para eso.
    select: { name: true, captureRate: true },
  });
  let grantedName: string | null = null;
  let failure: ParkError | null = null;
  let gained = 0;
  let have = 0;
  let assembled = false;
  let energySpent = 0;
  let usedAfter = 0;
  const key = dayKey();

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const row = await tx.parkFishing.findUnique({ where: { userId: gate.userId } });
    const used = fishingCastsUsedToday(row, key);
    energySpent = fishingEnergyCost(used);
    if (energySpent > 0 && !(await spendEnergy(tx, gate.userId, energySpent))) {
      return void (failure = "no_energy");
    }
    usedAfter = used + 1;
    await tx.parkFishing.upsert({
      where: { userId: gate.userId },
      create: { userId: gate.userId, dayKey: key, casts: 1 },
      update: row && row.dayKey === key ? { casts: { increment: 1 } } : { dayKey: key, casts: 1 },
    });
    if (!bite.caught) return;
    if (bite.isShiny) {
      const granted = await grantPokemon(tx, {
        userId: gate.userId,
        speciesId: bite.speciesId,
        level,
        isShiny: true,
      });
      grantedName = granted.speciesName;
      assembled = true;
      return;
    }
    gained = FISHING_FRAGMENT_YIELD[bite.rarity];
    const next = await creditFragments(tx, gate.userId, bite.speciesId, gained, true);
    have = next.quantity;
    assembled = next.assembled > 0;
    grantedName = fishSpecies?.name ?? null;
    for (let i = 0; i < next.assembled; i++) {
      const granted = await grantPokemon(tx, {
        userId: gate.userId,
        speciesId: bite.speciesId,
        level,
      });
      grantedName = granted.speciesName;
    }
  });
  if (failure) return { ok: false, error: failure };
  if (bite.caught) await markSpeciesSeen(gate.userId, bite.speciesId);
  refreshPark(locale);
  return {
    ok: true,
    speciesName: grantedName ?? fishSpecies?.name ?? String(bite.speciesId),
    speciesId: bite.speciesId,
    dexRarity: fishSpecies
      ? speciesRarity({ id: bite.speciesId, captureRate: fishSpecies.captureRate })
      : "common",
    level: bite.caught && assembled ? level : 0,
    rarity: bite.rarity,
    caught: bite.caught,
    shiny: bite.isShiny && bite.caught,
    gained: bite.caught && !bite.isShiny ? gained : 0,
    have,
    need: FRAGMENTS_TO_ASSEMBLE,
    assembled: bite.caught && assembled,
    energySpent,
    freeLeft: fishingFreeLeft(usedAfter),
  };
}

export async function submitWonderTrade(
  locale: string,
  instanceId: string,
): Promise<
  ParkResult<{
    receivedName: string;
    npc: boolean;
    queued: boolean;
    received: WonderReceipt | null;
    energySpent: number;
    freeLeft: number;
  }>
> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };

  let failure: ParkError | null = null;
  let receivedName = "";
  let queued = false;
  let received: WonderReceipt | null = null;
  let energySpent = 0;
  let usedAfter = 0;

  await prisma.$transaction(async (tx) => {
    const preview = await tx.pokemonInstance.findFirst({
      where: { id: instanceId, ownerId: gate.userId },
      include: { species: WONDER_SPECIES },
    });
    if (!preview) return void (failure = "not_found");
    const offeredTier = wonderTradeTier(toWonderSnap(preview));

    const candidates = await tx.wonderTradeOffer.findMany({
      where: { matchedAt: null, userId: { not: gate.userId } },
      orderBy: { createdAt: "asc" },
      take: 30,
      include: { pokemon: { include: { species: WONDER_SPECIES } } },
    });
    const waiting =
      candidates.find((row) =>
        wonderTiersMatch(offeredTier, wonderTradeTier(toWonderSnap(row.pokemon))),
      ) ?? null;

    await lockUsers(tx, gate.userId, waiting?.userId);

    const lockedOut = await assertWonderOpen(tx, gate.userId);
    if (lockedOut) return void (failure = lockedOut);
    const blocked = await assertDepositable(tx, gate.userId, instanceId);
    if (blocked) return void (failure = blocked);
    const existing = await tx.wonderTradeOffer.findFirst({
      where: { userId: gate.userId, matchedAt: null },
    });
    if (existing) return void (failure = "full");

    const quota = await takeWonderQuota(tx, gate.userId);
    if ("error" in quota) return void (failure = quota.error);
    energySpent = quota.energySpent;
    usedAfter = quota.usedAfter;

    const offered = await tx.pokemonInstance.findUniqueOrThrow({
      where: { id: instanceId },
      include: { species: WONDER_SPECIES },
    });

    const partner = waiting
      ? await tx.wonderTradeOffer.findFirst({
          where: { id: waiting.id, matchedAt: null },
          include: { pokemon: { include: { species: WONDER_SPECIES } } },
        })
      : null;
    const mate =
      partner &&
      wonderTiersMatch(wonderTradeTier(toWonderSnap(offered)), wonderTradeTier(toWonderSnap(partner.pokemon)))
        ? partner
        : null;

    if (mate) {
      await tx.pokemonInstance.update({
        where: { id: offered.id },
        data: { ownerId: mate.userId, teamSlot: null, pvpSlot: null },
      });
      await tx.pokemonInstance.update({
        where: { id: mate.pokemon.id },
        data: { ownerId: gate.userId, teamSlot: null, pvpSlot: null },
      });
      // La cola sólo guarda ofertas abiertas; el unique de pokemonInstanceId
      // no puede quedarse con historial o ese bicho no se vuelve a truequear.
      await tx.wonderTradeOffer.delete({ where: { id: mate.id } });
      receivedName = mate.pokemon.nickname ?? mate.pokemon.species.name;
      received = {
        name: receivedName,
        speciesName: mate.pokemon.species.name,
        speciesId: mate.pokemon.speciesId,
        level: mate.pokemon.level,
        isShiny: mate.pokemon.isShiny,
      };
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
  return {
    ok: true,
    receivedName,
    npc: false,
    queued,
    received,
    energySpent,
    freeLeft: wonderFreeLeft(usedAfter),
  };
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
): Promise<ParkResult<{ receivedName: string; received: WonderReceipt; energySpent: number; freeLeft: number }>> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };

  let failure: ParkError | null = null;
  let receivedName = "";
  let npcSpeciesId: number | null = null;
  let received: WonderReceipt | null = null;
  let energySpent = 0;
  let usedAfter = 0;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const lockedOut = await assertWonderOpen(tx, gate.userId);
    if (lockedOut) return void (failure = lockedOut);
    const blocked = await assertDepositable(tx, gate.userId, instanceId);
    if (blocked) return void (failure = blocked);
    const existing = await tx.wonderTradeOffer.findFirst({
      where: { userId: gate.userId, matchedAt: null },
    });
    if (existing) return void (failure = "full");
    const offered = await tx.pokemonInstance.findUniqueOrThrow({
      where: { id: instanceId },
      include: { species: WONDER_SPECIES },
    });
    const tier = wonderTradeTier(toWonderSnap(offered));
    if (!wonderNpcAllowed(tier)) return void (failure = "too_rare");
    const quota = await takeWonderQuota(tx, gate.userId);
    if ("error" in quota) return void (failure = quota.error);
    energySpent = quota.energySpent;
    usedAfter = quota.usedAfter;
    await tx.pokemonInstance.delete({ where: { id: instanceId } });
    const speciesId = wonderNpcSpecies(tier, Math.random());
    const level = wonderNpcLevel(offered.level, Math.random());
    const granted = await grantPokemon(tx, { userId: gate.userId, speciesId, level });
    receivedName = granted.speciesName;
    npcSpeciesId = speciesId;
    received = {
      name: granted.speciesName,
      speciesName: granted.speciesName,
      speciesId,
      level: granted.level,
      isShiny: granted.isShiny,
    };
  });

  if (failure) return { ok: false, error: failure };
  if (!received) return { ok: false, error: "not_found" };
  if (npcSpeciesId) await markSpeciesSeen(gate.userId, npcSpeciesId);
  refreshPark(locale);
  return { ok: true, receivedName, received, energySpent, freeLeft: wonderFreeLeft(usedAfter) };
}

export async function spinCornerAction(
  locale: string,
): Promise<
  ParkResult<{
    reels: [CornerSymbol, CornerSymbol, CornerSymbol];
    payout: number;
    energySpent: number;
    freeLeft: number;
  }>
> {
  const gate = await authed(locale);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!allowUserAction("purchase", "park:corner", gate.userId)) {
    return { ok: false, error: "busy" };
  }
  const spin = spinCorner();
  const key = dayKey();
  let failure: ParkError | null = null;
  let energySpent = 0;
  let usedAfter = 0;
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, gate.userId);
    const row = await tx.parkCorner.findUnique({ where: { userId: gate.userId } });
    const used = cornerSpinsUsedToday(row, key);
    energySpent = cornerEnergyCost(used);
    if (energySpent > 0 && !(await spendEnergy(tx, gate.userId, energySpent))) {
      return void (failure = "no_energy");
    }
    usedAfter = used + 1;
    await tx.parkCorner.upsert({
      where: { userId: gate.userId },
      create: { userId: gate.userId, dayKey: key, spins: 1 },
      update: row && row.dayKey === key ? { spins: { increment: 1 } } : { dayKey: key, spins: 1 },
    });
    if (spin.payout > 0) {
      await tx.user.update({
        where: { id: gate.userId },
        data: { coins: { increment: spin.payout } },
      });
    }
  });
  if (failure) return { ok: false, error: failure };
  refreshPark(locale);
  return {
    ok: true,
    reels: spin.reels,
    payout: spin.payout,
    energySpent,
    freeLeft: cornerFreeLeft(usedAfter),
  };
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
  let loot: MineLoot | null = null;
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
    cell.dug = true;
    loot = cell.loot;
    const bag = await absorbLegacyFossilBag(tx, gate.userId, parseMineBag(mine!.bag));
    if (loot === "helix" || loot === "dome" || loot === "amber") {
      await creditFragments(tx, gate.userId, FOSSIL_SPECIES[loot], 1, false);
    }
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
  if (failure || loot == null) return { ok: false, error: failure ?? "not_found" };
  if (loot === "helix" || loot === "dome" || loot === "amber") {
    await markSpeciesSeen(gate.userId, FOSSIL_SPECIES[loot]);
  }
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
    const bag = await absorbLegacyFossilBag(tx, gate.userId, parseMineBag(mine?.bag));
    const row = await tx.speciesFragment.findUnique({
      where: { userId_speciesId: { userId: gate.userId, speciesId } },
    });
    const have = row?.quantity ?? 0;
    if (have < MINE_FRAGMENTS_TO_ASSEMBLE) return void (failure = "empty");
    await tx.speciesFragment.update({
      where: { userId_speciesId: { userId: gate.userId, speciesId } },
      data: { quantity: have - MINE_FRAGMENTS_TO_ASSEMBLE },
    });
    const granted = await grantPokemon(tx, {
      userId: gate.userId,
      speciesId,
      level: assembledPokemonLevel("fossil"),
    });
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
      coins = won ? FRONTIER_DOME_CUP_COINS : roundWins * FRONTIER_DOME_ROUND_COINS;
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
