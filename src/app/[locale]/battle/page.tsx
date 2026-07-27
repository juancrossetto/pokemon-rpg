import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { getCurrentEnergy } from "@/lib/energy";
import { getActiveGymRun } from "@/lib/battle-lock";
import { BattleScreen } from "@/components/battle-screen";
import type { BattleArenaProps, OpponentPartyMember } from "@/components/battle-arena";
import type { BattleLobbyData } from "@/lib/battle-lobby";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  getKantoStage,
  getKantoLocation,
  regionMapSrc,
  stageEncounterRate,
} from "@/lib/campaign";
import { loadMapLocations } from "@/lib/campaign/map-data";
import { spriteFor } from "@/lib/shiny";
import { getRouteTrainer } from "@/lib/campaign/trainers";

const ENCOUNTER_ENERGY_COST = 1;

export default async function BattlePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  // Si quedó más de una ACTIVE (carreras al explorar), cerramos las viejas
  // para que no “cambie” de batalla al refrescar.
  const activeBattles = await prisma.battleSession.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  if (activeBattles.length > 1) {
    await prisma.battleSession.updateMany({
      where: { id: { in: activeBattles.slice(1).map((b) => b.id) }, status: "ACTIVE" },
      data: { status: "FLED" },
    });
  }

  const battle = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      pokemonInstance: { include: { species: true, moves: { include: { move: true } } } },
      wildSpecies: true,
      gym: { select: { type: true, name: true, leaderName: true, badgeName: true } },
      gymTrainer: { select: { name: true } },
    },
  });

  let initialBattle: BattleArenaProps | null = null;
  let hasHealthyTeam = true;
  let lobby: BattleLobbyData | null = null;

  if (!battle) {
    // En un desafío de gym no se puede escapar al encuentro salvaje para curar.
    const gymRun = await getActiveGymRun(userId);
    if (gymRun) {
      redirect({ href: `/gyms/${gymRun.gymId}/run`, locale });
      return null;
    }

    const [user, partyRows, inventory, recentRows, progress] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { energy: true, energyMax: true, energyUpdatedAt: true },
      }),
      prisma.pokemonInstance.findMany({
        where: { ownerId: userId, teamSlot: { not: null } },
        include: { species: true },
        orderBy: { teamSlot: "asc" },
      }),
      prisma.inventoryItem.findMany({
        where: {
          userId,
          quantity: { gt: 0 },
          item: { type: { in: ["POKEBALL", "POTION"] } },
        },
        include: { item: { select: { type: true } } },
      }),
      prisma.battleSession.findMany({
        where: {
          userId,
          gymId: null,
          status: { in: ["WON", "LOST", "FLED", "CAUGHT"] },
        },
        include: { wildSpecies: { select: { name: true, spriteUrl: true } } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      ensureCampaignProgress(userId),
    ]);

    hasHealthyTeam = partyRows.some((p) => p.currentHp > 0);
    const energy = getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt);
    const balls = inventory
      .filter((i) => i.item.type === "POKEBALL")
      .reduce((sum, i) => sum + i.quantity, 0);
    const potions = inventory
      .filter((i) => i.item.type === "POTION")
      .reduce((sum, i) => sum + i.quantity, 0);

    const stage = getKantoStage(progress.farmingStageId);
    const location = getKantoLocation(progress.farmingLocationId);
    const energyCost = stage?.energyCost ?? ENCOUNTER_ENERGY_COST;

    // Las zonas del mapa ya traen sus especies y cuáles capturaste, así que la
    // lista de encuentros sale de ahí en vez de repetir las queries.
    const mapLocations = await loadMapLocations(userId, progress);
    const currentZone = mapLocations.find((l) => l.id === progress.farmingLocationId);
    const encounters = currentZone?.encounters ?? [];
    const encounterLevelMin = currentZone?.levelMin ?? stage?.levelMin ?? 1;
    const encounterLevelMax = currentZone?.levelMax ?? stage?.levelMax ?? 1;
    const encounterRate = stage ? stageEncounterRate(stage, location) : "medium";
    const predictedTypes = [...new Set(encounters.flatMap((e) => e.types))].slice(0, 4);

    lobby = {
      energy,
      energyMax: user.energyMax,
      energyCost,
      balls,
      potions,
      unspentTotal: partyRows.reduce((sum, p) => sum + p.unspentPoints, 0),
      team: partyRows.map((p) => ({
        id: p.id,
        name: p.nickname ?? p.species.name,
        speciesName: p.species.name,
        level: p.level,
        spriteUrl: p.species.spriteUrl,
        currentHp: p.currentHp,
        maxHp: calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution),
        types: p.species.types,
        unspentPoints: p.unspentPoints,
      })),
      recent: recentRows.map((r) => ({
        id: r.id,
        status: r.status as "WON" | "LOST" | "FLED" | "CAUGHT",
        speciesName: r.wildSpecies.name,
        spriteUrl: r.wildSpecies.spriteUrl,
        level: r.wildLevel,
      })),
      expedition:
        location && stage
          ? {
              locationNameKey: location.nameKey,
              stageNameKey: stage.nameKey,
              mapSrc: regionMapSrc(progress.currentRegionId),
              regionNameKey: `regions.${progress.currentRegionId}`,
              predictedTypes,
            }
          : null,
      mapLocations,
      farmingLocationId: progress.farmingLocationId,
      farmingStageId: progress.farmingStageId,
      encounters,
      encounterLevelMin,
      encounterLevelMax,
      encounterRate,
      teamReady: partyRows.filter((p) => p.currentHp > 0).length,
      teamTotal: partyRows.length,
    };
  }

  if (battle) {
    const instance = battle.pokemonInstance;
    const playerMaxHp = calculateMaxHp(
      instance.species.baseHp,
      instance.level,
      instance.ptConstitution,
    );
    const currentSlot = battle.gymPokemonSlot ?? 1;

    const [pokeballs, potions, partyRows, opponentTeam] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { userId, quantity: { gt: 0 }, item: { type: "POKEBALL" } },
        include: { item: true },
        orderBy: { item: { buyPrice: "asc" } },
      }),
      prisma.inventoryItem.findMany({
        where: { userId, quantity: { gt: 0 }, item: { type: "POTION" } },
        include: { item: true },
        orderBy: { item: { buyPrice: "asc" } },
      }),
      prisma.pokemonInstance.findMany({
        where: { ownerId: userId, teamSlot: { not: null } },
        include: { species: true },
        orderBy: { teamSlot: "asc" },
      }),
      battle.gymTrainerId
        ? prisma.gymTrainerPokemon.findMany({
            where: { gymTrainerId: battle.gymTrainerId },
            include: { species: true },
            orderBy: { slot: "asc" },
          })
        : battle.gymId
          ? prisma.gymPokemon.findMany({
              where: { gymId: battle.gymId },
              include: { species: true },
              orderBy: { slot: "asc" },
            })
          : Promise.resolve([]),
    ]);

    const opponentParty: OpponentPartyMember[] =
      opponentTeam.length > 0
        ? opponentTeam.map((m) => ({
            slot: m.slot,
            name: m.species.name,
            spriteUrl: m.species.spriteUrl,
            fainted: m.slot < currentSlot,
            active: m.slot === currentSlot,
          }))
        : [
            {
              slot: 1,
              name: battle.wildSpecies.name,
              spriteUrl: battle.wildSpecies.spriteUrl,
              fainted: false,
              active: true,
            },
          ];

    // Un entrenador de ruta tiene nombre propio: no es un "Pokémon salvaje".
    const routeTrainer = battle.routeTrainerId ? getRouteTrainer(battle.routeTrainerId) : null;
    const tCampaign = await getTranslations("campaign");
    const opponentName = routeTrainer
      ? tCampaign(routeTrainer.nameKey)
      : (battle.gymTrainer?.name ?? battle.gym?.leaderName ?? null);

    initialBattle = {
      battleId: battle.id,
      locale,
      trainerName: session.user.name ?? "Trainer",
      opponentName,
      pokeballs: pokeballs.map((p) => ({
        itemId: p.itemId,
        name: p.item.name,
        quantity: p.quantity,
      })),
      potions: potions.map((p) => ({
        itemId: p.itemId,
        name: p.item.name,
        quantity: p.quantity,
        healAmount: p.item.healAmount ?? 0,
      })),
      party: partyRows.map((r) => ({
        instanceId: r.id,
        name: r.nickname ?? r.species.name,
        speciesName: r.species.name,
        level: r.level,
        spriteUrl: r.species.spriteUrl,
        currentHp: r.id === instance.id ? instance.currentHp : r.currentHp,
        maxHp: calculateMaxHp(r.species.baseHp, r.level, r.ptConstitution),
      })),
      player: {
        instanceId: instance.id,
        name: instance.nickname ?? instance.species.name,
        speciesName: instance.species.name,
        level: instance.level,
        spriteUrl: instance.species.spriteUrl,
        currentHp: instance.currentHp,
        maxHp: playerMaxHp,
      },
      wild: {
        name: battle.wildSpecies.name,
        speciesName: battle.wildSpecies.name,
        level: battle.wildLevel,
        spriteUrl: spriteFor(battle.wildSpecies.spriteUrl, battle.wildIsShiny),
        isShiny: battle.wildIsShiny,
        currentHp: battle.wildCurrentHp,
        maxHp: battle.wildMaxHp,
        types: battle.wildSpecies.types,
      },
      moves: instance.moves.map((m) => ({
        moveId: m.moveId,
        name: m.move.name,
        type: m.move.type,
        pp: m.currentPp <= 0 ? m.move.pp : Math.min(m.currentPp, m.move.pp),
        maxPp: m.move.pp,
      })),
      initialLog: battle.log,
      opponentParty,
      playerStatus: battle.playerStatus,
      wildStatus: battle.wildStatus,
      playerChoiceLockMoveId: battle.playerChoiceLockMoveId,
      gymId: battle.gymId,
      gymRunId: battle.gymRunId,
      gymType: battle.gym?.type ?? null,
      gymName: battle.gym?.name ?? null,
      gymLeaderName: battle.gym?.leaderName ?? null,
      gymBadgeName: battle.gym?.badgeName ?? null,
    };
  }

  return (
    <BattleScreen
      initialBattle={initialBattle}
      locale={locale}
      hasHealthyTeam={hasHealthyTeam}
      lobby={lobby}
    />
  );
}
