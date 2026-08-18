import { prisma } from "@/lib/prisma";
import { getCurrentEnergy } from "@/lib/energy";
import { spriteFor } from "@/lib/shiny";
import { dayKey, nextDailyReset } from "@/lib/events/time";
import { busyPokemonIds } from "@/lib/pokemon-busy";
import { speciesRarity } from "@/lib/pokedex";
import { DAYCARE_SLOTS, daycareCollectFee, pendingDaycareLevels } from "@/lib/park/daycare";
import { FARM_BERRY_NAMES, FARM_PLOT_COUNT, farmMsLeft, farmReady } from "@/lib/park/farm";
import { FOSSIL_KINDS, FOSSIL_SPECIES, generateMineGrid, mineDigsLeft, parseMineBag, parseMineGrid } from "@/lib/park/mine";
import { FRONTIER_FACILITIES } from "@/lib/park/frontier";
import { cornerFreeLeft, cornerSpinsUsedToday } from "@/lib/park/corner";
import { fishingCastsUsedToday, fishingFreeLeft } from "@/lib/park/fishing";
import { isWonderUnlocked, wonderFreeLeft, wonderTradesUsedToday } from "@/lib/park/wonder";
import { migrateLegacyFossilsIfNeeded } from "@/lib/park/fragment-store";
import type { ParkDaycareSlot, ParkHubData, ParkPlot, ParkFrontierView } from "@/lib/park/view";

export async function loadParkHub(userId: string): Promise<ParkHubData> {
  const key = dayKey();
  const now = new Date();
  await migrateLegacyFossilsIfNeeded(userId);

  const [user, deposits, boxRows, plots, berryItems, mine, frontier, corner, fishing, wonderDay, busy, openWonder, fragmentRows, badgeCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { coins: true, energy: true, energyMax: true, energyUpdatedAt: true },
    }),
    prisma.daycareDeposit.findMany({
      where: { userId },
      include: { pokemon: { include: { species: true } } },
    }),
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId, teamSlot: null, listings: { none: { status: "ACTIVE" } } },
      include: { species: true },
      orderBy: { caughtAt: "asc" },
      take: 40,
    }),
    prisma.berryPlot.findMany({ where: { userId }, include: { berry: true } }),
    prisma.item.findMany({ where: { name: { in: [...FARM_BERRY_NAMES] } } }),
    prisma.parkMine.findUnique({ where: { userId } }),
    prisma.frontierAttempt.findMany({ where: { userId, dayKey: key } }),
    prisma.parkCorner.findUnique({ where: { userId } }),
    prisma.parkFishing.findUnique({ where: { userId } }),
    prisma.parkWonder.findUnique({ where: { userId } }),
    busyPokemonIds(prisma, userId),
    prisma.wonderTradeOffer.findFirst({
      where: { userId, matchedAt: null },
      include: { pokemon: { include: { species: true } } },
    }),
    prisma.speciesFragment.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { species: true },
      orderBy: { quantity: "desc" },
    }),
    prisma.badge.count({ where: { userId } }),
  ]);

  const bagRows = await prisma.inventoryItem.findMany({
    where: { userId, itemId: { in: berryItems.map((item) => item.id) } },
  });
  const qty = new Map(bagRows.map((row) => [row.itemId, row.quantity]));

  const daycare: ParkDaycareSlot[] = [];
  for (let slot = 1; slot <= DAYCARE_SLOTS; slot++) {
    const row = deposits.find((d) => d.slot === slot);
    const levels = row ? pendingDaycareLevels(row.pokemon.level, row.lastCollectedAt, now) : 0;
    daycare.push({
      slot,
      depositId: row?.id ?? null,
      name: row ? (row.pokemon.nickname ?? row.pokemon.species.name) : null,
      speciesName: row?.pokemon.species.name ?? null,
      level: row?.pokemon.level ?? null,
      spriteUrl: row ? spriteFor(row.pokemon.species.spriteUrl, row.pokemon.isShiny) : null,
      pendingLevels: levels,
      fee: daycareCollectFee(levels),
    });
  }

  const farmBySlot = new Map(plots.map((p) => [p.slot, p]));
  const farm: ParkPlot[] = [];
  for (let slot = 1; slot <= FARM_PLOT_COUNT; slot++) {
    const plot = farmBySlot.get(slot);
    farm.push({
      slot,
      berryName: plot?.berry?.name ?? null,
      ready: plot?.plantedAt ? farmReady(plot.plantedAt, now) : false,
      msLeft: plot?.plantedAt ? farmMsLeft(plot.plantedAt, now) : 0,
    });
  }

  let grid = mine && mine.dayKey === key ? parseMineGrid(mine.grid) : null;
  if (!grid) grid = generateMineGrid(userId, key);

  const frontierByFacility = new Map(frontier.map((row) => [row.facility, row]));
  const frontierView: ParkFrontierView[] = FRONTIER_FACILITIES.map((facility) => {
    const row = frontierByFacility.get(facility);
    return {
      facility,
      streak: row?.streak ?? 0,
      wins: row?.wins ?? 0,
      lastWon: row?.lastWon ?? false,
    };
  });

  const resetAt = nextDailyReset(now);
  const jsonBag = parseMineBag(mine?.bag);
  const bag = { ...jsonBag };
  for (const kind of FOSSIL_KINDS) {
    const row = fragmentRows.find((entry) => entry.speciesId === FOSSIL_SPECIES[kind]);
    bag[kind] = (row?.quantity ?? 0) + jsonBag[kind];
  }

  return {
    coins: user.coins,
    energy: getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt),
    energyMax: user.energyMax,
    daycare,
    box: boxRows
      .filter((row) => !busy.has(row.id))
      .map((row) => ({
        id: row.id,
        name: row.nickname ?? row.species.name,
        speciesName: row.species.name,
        level: row.level,
        spriteUrl: spriteFor(row.species.spriteUrl, row.isShiny),
      })),
    wonderPending: openWonder
      ? {
          id: openWonder.pokemon.id,
          name: openWonder.pokemon.nickname ?? openWonder.pokemon.species.name,
          speciesName: openWonder.pokemon.species.name,
          level: openWonder.pokemon.level,
          spriteUrl: spriteFor(openWonder.pokemon.species.spriteUrl, openWonder.pokemon.isShiny),
        }
      : null,
    wonder: {
      unlocked: isWonderUnlocked(badgeCount),
      freeLeft: wonderFreeLeft(wonderTradesUsedToday(wonderDay, key)),
      resetAt: resetAt.toISOString(),
      resetMs: Math.max(0, resetAt.getTime() - now.getTime()),
    },
    farm,
    berries: berryItems.map((item) => ({
      itemId: item.id,
      name: item.name,
      quantity: qty.get(item.id) ?? 0,
    })),
    mine: {
      grid,
      bag,
      digsLeft: mineDigsLeft(grid),
      resetAt: resetAt.toISOString(),
      resetMs: Math.max(0, resetAt.getTime() - now.getTime()),
    },
    fragments: fragmentRows.map((row) => ({
      speciesId: row.speciesId,
      speciesName: row.species.name,
      spriteUrl: spriteFor(row.species.spriteUrl, false),
      quantity: row.quantity,
      dexRarity: speciesRarity({
        id: row.species.id,
        captureRate: row.species.captureRate,
      }),
    })),
    frontier: frontierView,
    corner: {
      freeLeft: cornerFreeLeft(cornerSpinsUsedToday(corner, key)),
      resetAt: resetAt.toISOString(),
      resetMs: Math.max(0, resetAt.getTime() - now.getTime()),
    },
    fishing: {
      freeLeft: fishingFreeLeft(fishingCastsUsedToday(fishing, key)),
      resetAt: resetAt.toISOString(),
      resetMs: Math.max(0, resetAt.getTime() - now.getTime()),
    },
  };
}
