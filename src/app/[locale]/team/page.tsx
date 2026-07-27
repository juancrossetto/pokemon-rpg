import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spriteFor } from "@/lib/shiny";
import { calculateMaxHp, calculateStat, xpForLevel, xpToNextLevel } from "@/lib/stats";
import { effectivePp } from "@/lib/battle";
import { HealButton } from "@/components/heal-button";
import { healCooldownMsLeft, healRushCost } from "@/lib/healing";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { loadEvolutionChainsForTeam, loadOwnedEvolutionItems } from "@/lib/evolution-chain";
import { loadSquadBagCounts } from "@/lib/load-squad-bag";
import { TeamRoster, type TeamMember } from "@/components/team-roster";

const TEAM_SIZE = 6;

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, tMenu, session] = await Promise.all([
    getTranslations("team"),
    getTranslations("home.squadMenu"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  await redirectIfInBattle(userId, locale);

  const pokemon = await prisma.pokemonInstance.findMany({
    where: { ownerId: userId, teamSlot: { not: null } },
    include: {
      species: true,
      moves: { include: { move: true }, orderBy: { slot: "asc" } },
      heldItem: true,
    },
    orderBy: { teamSlot: "asc" },
  });

  if (pokemon.length === 0) {
    redirect({ href: "/starter", locale });
    return null;
  }

  // MTs/MOs que el jugador tiene en la mochila (con al menos 1 de stock).
  const ownedMachines = await prisma.inventoryItem.findMany({
    where: { userId, quantity: { gt: 0 }, item: { type: "MACHINE" } },
    include: { item: { include: { move: true } } },
  });

  // Objetos equipables que el jugador tiene en la mochila — los mismos para
  // los 6 slots, se filtran client-side por el que ya tiene puesto cada uno.
  const ownedHeldItemsRows = await prisma.inventoryItem.findMany({
    where: { userId, quantity: { gt: 0 }, item: { type: "HELD" } },
    include: { item: true },
  });
  const ownedHeldItems = ownedHeldItemsRows.map((inv) => ({
    itemId: inv.itemId,
    name: inv.item.name,
    effectText: inv.item.effectText,
    quantity: inv.quantity,
  }));
  const ownedMoveIds = ownedMachines
    .map((inv) => inv.item.moveId)
    .filter((id): id is number => id !== null);

  // Compatibilidad real especie↔MT para las especies del equipo — un solo
  // query para todas, filtrado a los movimientos que el jugador realmente
  // tiene, para no traer compatibilidad irrelevante.
  const speciesIds = [...new Set(pokemon.map((p) => p.speciesId))];
  const bagCounts = await loadSquadBagCounts(userId);
  const [compatibility, evolutionChains, ownedEvolutionItems] = await Promise.all([
    prisma.speciesMove.findMany({
      where: { method: "MACHINE", speciesId: { in: speciesIds }, moveId: { in: ownedMoveIds } },
      select: { speciesId: true, moveId: true },
    }),
    loadEvolutionChainsForTeam(userId, speciesIds),
    loadOwnedEvolutionItems(userId),
  ]);
  const ownedEvolutionItemNames = [...ownedEvolutionItems];
  const compatibleMoveIdsBySpecies = new Map<number, Set<number>>();
  for (const row of compatibility) {
    const set = compatibleMoveIdsBySpecies.get(row.speciesId) ?? new Set<number>();
    set.add(row.moveId);
    compatibleMoveIdsBySpecies.set(row.speciesId, set);
  }

  const bySlot = new Map(pokemon.map((p) => [p.teamSlot, p]));
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => bySlot.get(i + 1) ?? null);
  const needsHealing = pokemon.some(
    (p) => p.currentHp < calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution),
  );
  const healthyCount = pokemon.filter((p) => p.currentHp > 0).length;
  const hurtCount = pokemon.filter(
    (p) => p.currentHp < calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution),
  ).length;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { coins: true, lastHealAt: true },
  });
  const totalUnspent = pokemon.reduce((sum, p) => sum + p.unspentPoints, 0);

  const members: (TeamMember | null)[] = slots.map((instance, i) => {
    if (!instance) return null;

    const maxHp = calculateMaxHp(instance.species.baseHp, instance.level, instance.ptConstitution);
    const movesBySlot = new Map(instance.moves.map((m) => [m.slot, m]));
    const knownMoveIds = new Set(instance.moves.map((m) => m.moveId));
    const compatibleIds = compatibleMoveIdsBySpecies.get(instance.speciesId) ?? new Set<number>();

    return {
      instanceId: instance.id,
      slot: i + 1,
      isLead: i === 0,
      speciesId: instance.speciesId,
      nickname: instance.nickname,
      speciesName: instance.species.name,
      level: instance.level,
      types: instance.species.types,
      spriteUrl: spriteFor(instance.species.spriteUrl, instance.isShiny),
      currentHp: instance.currentHp,
      maxHp,
      xp: instance.xp,
      xpForCurrentLevel: xpForLevel(instance.level),
      xpToNext: xpToNextLevel(instance.xp, instance.level),
      evolutionChain: evolutionChains.get(instance.speciesId) ?? [],
      ownedEvolutionItems: ownedEvolutionItemNames,
      atk: calculateStat(instance.species.baseAttack, instance.ptStrength, instance.level),
      def: calculateStat(instance.species.baseDefense, instance.ptDexterity, instance.level),
      spAtk: calculateStat(instance.species.baseSpAtk, instance.ptIntelligence, instance.level),
      spDef: calculateStat(instance.species.baseSpDef, instance.ptIntelligence, instance.level),
      speed: calculateStat(instance.species.baseSpeed, instance.ptSpeed, instance.level),
      unspentPoints: instance.unspentPoints,
      points: {
        ptStrength: instance.ptStrength,
        ptDexterity: instance.ptDexterity,
        ptIntelligence: instance.ptIntelligence,
        ptSpeed: instance.ptSpeed,
        ptConstitution: instance.ptConstitution,
      },
      bases: {
        baseHp: instance.species.baseHp,
        baseAttack: instance.species.baseAttack,
        baseDefense: instance.species.baseDefense,
        baseSpAtk: instance.species.baseSpAtk,
        baseSpDef: instance.species.baseSpDef,
        baseSpeed: instance.species.baseSpeed,
      },
      moves: Array.from({ length: 4 }, (_, slotIdx) => {
        const m = movesBySlot.get(slotIdx + 1);
        if (!m) return null;
        const maxPp = m.move.pp ?? 20;
        return {
          slot: slotIdx + 1,
          moveId: m.moveId,
          name: m.move.name,
          type: m.move.type,
          category: m.move.category,
          power: m.move.power,
          currentPp: effectivePp(m.currentPp, maxPp),
          maxPp,
        };
      }),
      compatibleTms: ownedMachines
        .filter((inv) => inv.item.moveId !== null && compatibleIds.has(inv.item.moveId))
        .map((inv) => ({
          itemId: inv.itemId,
          code: inv.item.name,
          quantity: inv.quantity,
          moveId: inv.item.moveId as number,
          moveName: inv.item.move!.name,
          moveType: inv.item.move!.type,
          moveCategory: inv.item.move!.category,
          movePower: inv.item.move!.power,
          alreadyKnown: knownMoveIds.has(inv.item.moveId as number),
        })),
      levelLabel: t("level", { level: instance.level }),
      slotLabel: t("slotLabel", { slot: i + 1 }),
      expToNextLabel: t("expToNext", { xp: xpToNextLevel(instance.xp, instance.level) }),
      heldItem: instance.heldItem
        ? { itemId: instance.heldItem.id, name: instance.heldItem.name, effectText: instance.heldItem.effectText }
        : null,
      ownedHeldItems,
      isFavorite: instance.isFavorite,
      isTradeLocked: instance.isTradeLocked,
    };
  });

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-0.5 flex items-center gap-2 text-label-sm uppercase tracking-[0.2em] text-pokeball-red">
              <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
              {t("activeSquad")}
            </p>
            <h1 className="text-headline-lg text-white tracking-tight">{t("title")}</h1>
            <p className="mt-0.5 text-label-md text-on-surface-variant">
              {t("rosterSummary", { ready: healthyCount, total: pokemon.length })}
              {totalUnspent > 0 && (
                <span className="ml-2 text-tertiary">
                  · {t("unspentPoints", { count: totalUnspent })}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <HealButton
              locale={locale}
              needsHealing={needsHealing}
              cooldownMsLeft={healCooldownMsLeft(user.lastHealAt)}
              rushCost={healRushCost(hurtCount)}
              coins={user.coins}
            />
            <Link
              href="/pc"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.03] px-4 py-2 text-label-sm text-on-surface transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <span className="material-symbols-outlined text-[16px]!">storage</span>
              {t("manage")}
            </Link>
          </div>
        </header>

        <TeamRoster
          members={members}
          bagCounts={bagCounts}
          labels={{
            hp: t("stats.hp"),
            exp: t("stats.exp"),
            atk: t("stats.atk"),
            def: t("stats.def"),
            spAtk: t("stats.spAtk"),
            spDef: t("stats.spDef"),
            speed: t("stats.speed"),
            lead: t("lead"),
            fainted: t("fainted"),
            emptySlot: t("emptySlot"),
            slotAvailableLabels: Array.from({ length: TEAM_SIZE }, (_, i) =>
              t("slotAvailable", { slot: i + 1 }),
            ),
            viewDetails: t("drawer.viewDetails"),
            selectHint: t("drawer.selectHint"),
            close: t("drawer.close"),
            statsTitle: t("drawer.statsTitle"),
            movesTitle: t("drawer.movesTitle"),
            evolutionsTitle: t("drawer.evolutionsTitle"),
            unknownSpecies: t("drawer.unknownSpecies"),
            evolveAtLevel: t("drawer.evolveAtLevel", { level: "{level}" }),
            evolveByTrade: t("drawer.evolveByTrade"),
            evolveStones: t.raw("drawer.evolveStones") as Record<string, string>,
            evolveReadyShort: t("drawer.evolveReadyShort"),
            evolveNeedItem: t("drawer.evolveNeedItem"),
            evolveNeedLevel: t("drawer.evolveNeedLevel", { level: "{level}" }),
            evolveNow: t("drawer.evolveNow"),
            evolveUseStone: t("drawer.evolveUseStone", { item: "{item}" }),
            evolving: t("drawer.evolving"),
            canEvolveBadge: t("drawer.canEvolveBadge"),
            showDetails: t("drawer.showDetails"),
            hideDetails: t("drawer.hideDetails"),
            tabAbout: t("drawer.tabAbout"),
            tabStats: t("drawer.tabStats"),
            tabEvolutions: t("drawer.tabEvolutions"),
            pp: t("drawer.pp"),
            power: t("drawer.power"),
            noPower: t("drawer.noPower"),
            emptySlotMove: t("drawer.emptySlotMove"),
            tmSectionTitle: t("drawer.tmSectionTitle"),
            tmSectionHint: t("drawer.tmSectionHint"),
            tmNone: t("drawer.tmNone"),
            teach: t("drawer.teach"),
            pickSlot: t("drawer.pickSlot"),
            cancel: t("drawer.cancel"),
            teaching: t("drawer.teaching"),
            alreadyKnown: t("drawer.alreadyKnown"),
            teachErrors: {
              unauthorized: t("drawer.teachErrors.unauthorized"),
              not_found: t("drawer.teachErrors.not_found"),
              no_tm: t("drawer.teachErrors.no_tm"),
              incompatible: t("drawer.teachErrors.incompatible"),
              already_known: t("drawer.teachErrors.already_known"),
              in_combat: t("drawer.teachErrors.in_combat"),
            },
            heldItemTitle: t("drawer.heldItemTitle"),
            heldItemHint: t("drawer.heldItemHint"),
            heldItemEmpty: t("drawer.heldItemEmpty"),
            noHeldItems: t("drawer.noHeldItems"),
            equip: t("drawer.equip"),
            unequip: t("drawer.unequip"),
            equipping: t("drawer.equipping"),
            equipErrors: {
              unauthorized: t("drawer.teachErrors.unauthorized"),
              not_found: t("drawer.teachErrors.not_found"),
              no_item: t("drawer.equipErrors.no_item"),
              in_combat: t("drawer.teachErrors.in_combat"),
            },
            tabItems: t("drawer.tabItems"),
            careTitle: t("drawer.careTitle"),
            careHint: t("drawer.careHint"),
            pointsTitle: t("drawer.pointsTitle"),
            pointsHint: t("drawer.pointsHint"),
            levelTemplate: t("level", { level: "{level}" }),
            care: {
              heal: tMenu("heal"),
              restorePp: tMenu("restorePp"),
              rareCandy: tMenu("rareCandy"),
              favoriteOn: tMenu("favoriteOn"),
              favoriteOff: tMenu("favoriteOff"),
              lockOn: tMenu("lockOn"),
              lockOff: tMenu("lockOff"),
            },
          }}
        />
      </div>
    </div>
  );
}
