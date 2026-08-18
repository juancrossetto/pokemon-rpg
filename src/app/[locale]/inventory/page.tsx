import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { unclaimedPurchasesWhere } from "@/lib/market-delivery";
import { INVENTORY_CATEGORIES, BAG_CATEGORIES, isInventoryEvolutionItem, type InventoryEntry } from "@/lib/inventory";
import {
  formatItemSource,
  resolveItemSources,
} from "@/lib/item-sources";
import { InventoryTerminal, type InventoryLabels } from "@/components/inventory-terminal";
import { resolveItemDisplayName } from "@/lib/shop";
import {
  assembledPokemonLevelForSpecies,
  FRAGMENTS_TO_ASSEMBLE,
} from "@/lib/park/fragments";
import { migrateLegacyFossilsIfNeeded } from "@/lib/park/fragment-store";
import { speciesRarity } from "@/lib/pokedex";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, tShop, tCampaign, session] = await Promise.all([
    getTranslations("inventory"),
    getTranslations("shop"),
    getTranslations("campaign"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  await redirectIfInBattle(session.user.id, locale);
  const userId = session.user.id;
  await migrateLegacyFossilsIfNeeded(userId);

  const [rows, pendingClaims, team, fragmentRows] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      // `move` para poder mostrar qué enseña cada MT/MO en el panel de detalle.
      include: {
        item: {
          include: {
            move: {
              select: {
                id: true,
                name: true,
                type: true,
                category: true,
                power: true,
                accuracy: true,
                pp: true,
              },
            },
          },
        },
      },
      orderBy: [{ item: { type: "asc" } }, { item: { name: "asc" } }],
    }),
    prisma.marketListing.count({ where: unclaimedPurchasesWhere(userId) }),
    // El equipo se trae siempre —son 6 filas— porque el panel de detalle de una
    // MT necesita decir a quién se le puede enseñar. Sin esto la pantalla sabía
    // qué movimiento enseña la máquina pero no si servía para algo.
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId, teamSlot: { not: null } },
      select: {
        id: true,
        nickname: true,
        level: true,
        speciesId: true,
        heldItemId: true,
        species: { select: { name: true, spriteUrl: true } },
        moves: { select: { moveId: true } },
      },
      orderBy: { teamSlot: "asc" },
    }),
    prisma.speciesFragment.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { species: { select: { id: true, name: true, captureRate: true } } },
      orderBy: { speciesId: "asc" },
    }),
  ]);

  /*
    Compatibilidad especie↔MT en una sola consulta para toda la pantalla, no una
    por ítem: se piden las filas MACHINE que crucen las especies del equipo con
    los movimientos de las máquinas que el jugador tiene. Con 6 especies y las
    MT de la mochila el resultado es chico.

    `learnLevel` no se selecciona a propósito: el seed lo graba en null para todo
    lo que sea MACHINE, así que no hay requisito de nivel que mostrar.
  */
  const machineMoveIds = rows
    .filter((r) => r.item.type === "MACHINE")
    .map((r) => r.item.move?.id)
    .filter((id): id is number => id != null);
  const teamSpeciesIds = [...new Set(team.map((p) => p.speciesId))];

  const evolveItemNames = [
    ...new Set(
      rows
        .filter((r) => isInventoryEvolutionItem(r.item))
        .map((r) => r.item.name),
    ),
  ];

  const [machineCompat, evoChildren] = await Promise.all([
    machineMoveIds.length > 0 && teamSpeciesIds.length > 0
      ? prisma.speciesMove.findMany({
          where: {
            method: "MACHINE",
            speciesId: { in: teamSpeciesIds },
            moveId: { in: machineMoveIds },
          },
          select: { speciesId: true, moveId: true },
        })
      : Promise.resolve([]),
    evolveItemNames.length > 0 && teamSpeciesIds.length > 0
      ? prisma.species.findMany({
          where: {
            evolvesFromId: { in: teamSpeciesIds },
            evolveTrigger: "use-item",
            evolveItem: { in: evolveItemNames },
          },
          select: {
            id: true,
            name: true,
            spriteUrl: true,
            evolveItem: true,
            evolveMinLevel: true,
            evolvesFromId: true,
          },
          orderBy: { id: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const compatBySpecies = new Map<number, Set<number>>();
  for (const row of machineCompat) {
    const set = compatBySpecies.get(row.speciesId) ?? new Set<number>();
    set.add(row.moveId);
    compatBySpecies.set(row.speciesId, set);
  }

  // speciesId padre + nombre de ítem → primera forma destino (mismo criterio
  // que evolvePokemonWithItem: orderBy id, take 1).
  const evoByFromItem = new Map<
    string,
    {
      id: number;
      name: string;
      spriteUrl: string;
      evolveMinLevel: number | null;
    }
  >();
  for (const child of evoChildren) {
    if (child.evolvesFromId == null || child.evolveItem == null) continue;
    const key = `${child.evolvesFromId}::${child.evolveItem}`;
    if (!evoByFromItem.has(key)) {
      evoByFromItem.set(key, {
        id: child.id,
        name: child.name,
        spriteUrl: child.spriteUrl,
        evolveMinLevel: child.evolveMinLevel,
      });
    }
  }

  const knownBySpeciesInstance = new Map(
    team.map((p) => [p.id, new Set(p.moves.map((m) => m.moveId))]),
  );

  function learnersFor(moveId: number | null | undefined) {
    if (moveId == null) return [];
    return team.map((p) => ({
      instanceId: p.id,
      name: p.nickname ?? p.species.name,
      spriteUrl: p.species.spriteUrl,
      level: p.level,
      canLearn: compatBySpecies.get(p.speciesId)?.has(moveId) ?? false,
      alreadyKnown: knownBySpeciesInstance.get(p.id)?.has(moveId) ?? false,
    }));
  }

  function evolveTargetsFor(itemName: string) {
    return team.map((p) => {
      const next = evoByFromItem.get(`${p.speciesId}::${itemName}`);
      if (!next) {
        return {
          instanceId: p.id,
          name: p.nickname ?? p.species.name,
          spriteUrl: p.species.spriteUrl,
          level: p.level,
          speciesMatches: false,
          canEvolve: false,
          levelsShort: 0,
          toSpeciesId: null,
          toName: null,
          toSpriteUrl: null,
        };
      }
      const levelsShort =
        next.evolveMinLevel != null
          ? Math.max(0, next.evolveMinLevel - p.level)
          : 0;
      return {
        instanceId: p.id,
        name: p.nickname ?? p.species.name,
        spriteUrl: p.species.spriteUrl,
        level: p.level,
        speciesMatches: true,
        canEvolve: levelsShort === 0,
        levelsShort,
        toSpeciesId: next.id,
        toName: next.name,
        toSpriteUrl: next.spriteUrl,
      };
    });
  }

  const sourceLabels = {
    shop: t("sources.shop"),
    gems: t("sources.gems"),
    explore: t("sources.explore"),
    zoneObjectives: t("sources.zoneObjectives"),
    tower: t("sources.tower"),
    daily: t("sources.daily"),
    weekly: t("sources.weekly"),
    events: t("sources.events"),
    market: t("sources.market"),
    gym: (locationName: string) => t("sources.gym", { location: locationName }),
  };

  const allowed = new Set<string>(INVENTORY_CATEGORIES);
  const itemEntries: InventoryEntry[] = rows
    // Un tipo nuevo en el schema que todavía no tenga categoría no debe
    // desaparecer en silencio: se filtra acá y queda visible en el log.
    .filter((r) => allowed.has(r.item.type))
    .map((r) => {
      const moveName = r.item.move?.name ?? null;
      const sources = resolveItemSources({
        name: r.item.name,
        type: r.item.type,
        buyPrice: r.item.buyPrice,
        gemPrice: r.item.gemPrice,
        moveName,
      }).map((source) =>
        formatItemSource(source, sourceLabels, (locationKey) =>
          tCampaign.has(`locations.${locationKey}`)
            ? tCampaign(`locations.${locationKey}`)
            : locationKey,
        ),
      );

      return {
        itemId: r.item.id,
        name: r.item.name,
        displayName: resolveItemDisplayName(r.item.name, (key) => {
          const path = `names.${key}`;
          return tShop.has(path) ? tShop(path) : null;
        }),
        type: r.item.type as InventoryEntry["type"],
        quantity: r.quantity,
        effectText: r.item.effectText,
        buyPrice: r.item.buyPrice,
        moveName,
        moveType: r.item.move?.type ?? null,
        moveCategory: r.item.move?.category ?? null,
        movePower: r.item.move?.power ?? null,
        moveAccuracy: r.item.move?.accuracy ?? null,
        movePp: r.item.move?.pp ?? null,
        learners: r.item.type === "MACHINE" ? learnersFor(r.item.move?.id) : [],
        evolveTargets: isInventoryEvolutionItem(r.item)
          ? evolveTargetsFor(r.item.name)
          : [],
        equipTargets:
          r.item.type === "HELD" && r.item.heldEffect != null
            ? team.map((p) => ({
                instanceId: p.id,
                name: p.nickname ?? p.species.name,
                spriteUrl: p.species.spriteUrl,
                level: p.level,
                alreadyEquipped: p.heldItemId === r.item.id,
              }))
            : [],
        sources,
      };
    });

  const fragmentEntries: InventoryEntry[] = fragmentRows.map((row) => {
    const speciesName = row.species.name;
    const level = assembledPokemonLevelForSpecies(row.speciesId);
    const dexRarity = speciesRarity({
      id: row.species.id,
      captureRate: row.species.captureRate,
    });
    return {
      itemId: `fragment:${row.speciesId}`,
      name: speciesName,
      displayName: t("fragmentName", { name: speciesName }),
      type: "FRAGMENT",
      quantity: row.quantity,
      effectText: t("fragmentEffect", {
        need: FRAGMENTS_TO_ASSEMBLE,
        name: speciesName,
        level,
      }),
      buyPrice: 0,
      speciesId: row.speciesId,
      dexRarity,
      fragmentNeed: FRAGMENTS_TO_ASSEMBLE,
      moveName: null,
      moveType: null,
      moveCategory: null,
      movePower: null,
      moveAccuracy: null,
      movePp: null,
      learners: [],
      evolveTargets: [],
      equipTargets: [],
      sources: [t("sources.park")],
    };
  });

  const entries: InventoryEntry[] = [...fragmentEntries, ...itemEntries];

  const labels: InventoryLabels = {
    categories: Object.fromEntries(
      BAG_CATEGORIES.map((c) => [c, t(`types.${c}`)]),
    ),
    all: t("all"),
    searchPlaceholder: t("searchPlaceholder"),
    noResults: t("noResults"),
    itemsCount: t("itemsCount"),
    unitsCount: t("unitsCount"),
    capacity: t("capacity"),
    selectHint: t("selectHint"),
    quantity: t("quantity"),
    value: t("value"),
    effect: t("effect"),
    fragmentNeed: t("fragmentNeed"),
    teaches: t("teaches"),
    moveType: t("moveType"),
    moveCategory: t("moveCategory"),
    power: t("power"),
    noPower: t("noPower"),
    accuracy: t("accuracy"),
    neverMiss: t("neverMiss"),
    pp: t("pp"),
    categoriesMove: {
      PHYSICAL: t("moveCategories.PHYSICAL"),
      SPECIAL: t("moveCategories.SPECIAL"),
      STATUS: t("moveCategories.STATUS"),
    },
    compatible: t("compatible"),
    noLevelRequired: t("noLevelRequired"),
    alreadyKnows: t("alreadyKnows"),
    cannotLearn: t("cannotLearn"),
    noCompatible: t("noCompatible"),
    sell: t("sell"),
    teach: t("teach"),
    use: t("use"),
    useOnTeam: t("useOnTeam"),
    equip: t("equip"),
    equipPickerTitle: t("equipPickerTitle", { name: "{name}" }),
    equipPickerHint: t("equipPickerHint"),
    equipAlready: t("equipAlready"),
    equipping: t("equipping"),
    equipFailed: t("equipFailed"),
    equipEmptyTeam: t("equipEmptyTeam"),
    evolvePickerTitle: t("evolvePickerTitle", { name: "{name}" }),
    evolvePickerHint: t("evolvePickerHint"),
    evolveReady: t("evolveReady"),
    evolveNeedLevel: t("evolveNeedLevel", { level: "{level}" }),
    evolveIncompatible: t("evolveIncompatible"),
    evolveNoTarget: t("evolveNoTarget"),
    evolveUsing: t("evolveUsing"),
    evolveFailed: t("evolveFailed"),
    close: t("close"),
    sourcesTitle: t("sources.title"),
    sourcesHint: t("sources.hint"),
    evolvesTitle: t("evolvesTitle"),
    rarity: {
      common: t("rarity.common"),
      rare: t("rarity.rare"),
      epic: t("rarity.epic"),
      legendary: t("rarity.legendary"),
    },
  };

  return (
    <div className="flex-1 px-margin-mobile py-6 md:px-margin-desktop md:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex flex-col gap-2.5 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <p className="mb-0.5 flex items-center gap-2 text-label-sm uppercase tracking-[0.2em] text-pokeball-red">
              <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
              {t("eyebrow")}
            </p>
            <h1 className="page-title text-headline-lg text-white">{t("title")}</h1>
          </div>
          <div className="flex gap-1.5 sm:flex-wrap sm:gap-2">
            <Link
              href="/market?tab=bought"
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md border border-white/12 bg-white/5 px-2 py-1.5 text-[11px] text-on-surface-variant transition hover:border-pokeball-red/40 hover:text-on-surface sm:flex-none sm:gap-1.5 sm:px-3 sm:text-label-sm"
            >
              <span className="material-symbols-outlined text-[15px]! sm:text-[16px]!">
                local_shipping
              </span>
              <span className="truncate">{t("marketBag")}</span>
              {pendingClaims > 0 && (
                <span className="ui-chip ui-chip--accent text-[10px] normal-case tracking-normal">
                  {pendingClaims}
                </span>
              )}
            </Link>
            <Link
              href="/market?tab=sell"
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md border border-white/12 bg-white/5 px-2 py-1.5 text-[11px] text-on-surface-variant transition hover:border-pokeball-red/40 hover:text-on-surface sm:flex-none sm:gap-1.5 sm:px-3 sm:text-label-sm"
            >
              <span className="material-symbols-outlined text-[15px]! sm:text-[16px]!">
                storefront
              </span>
              <span className="truncate">{t("sellLink")}</span>
            </Link>
          </div>
        </header>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/12 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-[40px]! text-on-surface-variant/50">
              inventory_2
            </span>
            <p className="text-label-md text-on-surface-variant">{t("empty")}</p>
            <p className="max-w-sm text-label-sm text-on-surface-variant/70">{t("emptyHint")}</p>
            {/* Bag vacía → tienda NPC (loop de balls/potions), no al mercado
                de jugadores que confunde a los nuevos. */}
            <Link
              href="/shop"
              className="ui-btn-primary mt-2 px-4 py-2 text-label-sm"
            >
              {t("goShop")}
            </Link>
            <Link
              href="/market"
              className="text-label-sm text-on-surface-variant underline-offset-2 transition hover:text-on-surface hover:underline"
            >
              {t("goMarket")}
            </Link>
          </div>
        ) : (
          <InventoryTerminal
            entries={entries}
            labels={labels}
            sellHref={`/${locale}/market?tab=sell`}
            teamHref={`/${locale}/team`}
          />
        )}
      </div>
    </div>
  );
}
