import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { unclaimedPurchasesWhere } from "@/lib/market-delivery";
import { INVENTORY_CATEGORIES, type InventoryEntry } from "@/lib/inventory";
import { InventoryTerminal, type InventoryLabels } from "@/components/inventory-terminal";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, session] = await Promise.all([getTranslations("inventory"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  await redirectIfInBattle(session.user.id, locale);
  const userId = session.user.id;

  const [rows, pendingClaims, team] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      // `move` para poder mostrar qué enseña cada MT/MO en el panel de detalle.
      include: { item: { include: { move: { select: { id: true, name: true } } } } },
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
        species: { select: { name: true, spriteUrl: true } },
        moves: { select: { moveId: true } },
      },
      orderBy: { teamSlot: "asc" },
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

  const machineCompat =
    machineMoveIds.length > 0 && teamSpeciesIds.length > 0
      ? await prisma.speciesMove.findMany({
          where: {
            method: "MACHINE",
            speciesId: { in: teamSpeciesIds },
            moveId: { in: machineMoveIds },
          },
          select: { speciesId: true, moveId: true },
        })
      : [];

  const compatBySpecies = new Map<number, Set<number>>();
  for (const row of machineCompat) {
    const set = compatBySpecies.get(row.speciesId) ?? new Set<number>();
    set.add(row.moveId);
    compatBySpecies.set(row.speciesId, set);
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

  const allowed = new Set<string>(INVENTORY_CATEGORIES);
  const entries: InventoryEntry[] = rows
    // Un tipo nuevo en el schema que todavía no tenga categoría no debe
    // desaparecer en silencio: se filtra acá y queda visible en el log.
    .filter((r) => allowed.has(r.item.type))
    .map((r) => ({
      itemId: r.item.id,
      name: r.item.name,
      type: r.item.type as InventoryEntry["type"],
      quantity: r.quantity,
      effectText: r.item.effectText,
      buyPrice: r.item.buyPrice,
      moveName: r.item.move?.name ?? null,
      learners: r.item.type === "MACHINE" ? learnersFor(r.item.move?.id) : [],
    }));

  const labels: InventoryLabels = {
    categories: Object.fromEntries(
      INVENTORY_CATEGORIES.map((c) => [c, t(`types.${c}`)]),
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
    teaches: t("teaches"),
    compatible: t("compatible"),
    noLevelRequired: t("noLevelRequired"),
    alreadyKnows: t("alreadyKnows"),
    cannotLearn: t("cannotLearn"),
    noCompatible: t("noCompatible"),
    sell: t("sell"),
    teach: t("teach"),
    useOnTeam: t("useOnTeam"),
    close: t("close"),
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
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-0.5 flex items-center gap-2 text-label-sm uppercase tracking-[0.2em] text-pokeball-red">
              <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
              {t("eyebrow")}
            </p>
            <h1 className="text-headline-lg tracking-tight text-white">{t("title")}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/market?tab=bought"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/5 px-3 py-1.5 text-label-sm text-on-surface-variant transition hover:border-pokeball-red/40 hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]!">local_shipping</span>
              {t("marketBag")}
              {pendingClaims > 0 && (
                <span className="rounded bg-pokeball-red px-1.5 text-[10px] font-bold text-white">
                  {pendingClaims}
                </span>
              )}
            </Link>
            <Link
              href="/market?tab=sell"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/5 px-3 py-1.5 text-label-sm text-on-surface-variant transition hover:border-pokeball-red/40 hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]!">storefront</span>
              {t("sellLink")}
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
            <Link
              href="/market"
              className="mt-2 rounded-md bg-pokeball-red px-4 py-2 text-label-sm font-semibold text-white transition hover:bg-pokeball-red/85"
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
            homeHref={`/${locale}`}
          />
        )}
      </div>
    </div>
  );
}
