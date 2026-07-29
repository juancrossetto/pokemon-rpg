import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { effectivePp } from "@/lib/battle";
import { getCurrentEnergy } from "@/lib/energy";
import { getActiveGymRun } from "@/lib/battle-lock";
import { healCooldownMsLeft, healRushCost } from "@/lib/healing";
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
import { avatarById, showdownTrainerSpriteUrl } from "@/lib/avatars";
import { gymLeaderPortraitUrl, gymTypeTrainerSpriteSlug } from "@/lib/gym-art";
import { parseTeamSnap } from "@/lib/pvp/team";
import { resolveBattleBg } from "@/lib/battle-bg";

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
      gym: { select: { type: true, name: true, leaderName: true, badgeName: true, order: true } },
      gymTrainer: { select: { name: true } },
      pvpMatch: {
        select: {
          id: true,
          opponentTeam: true,
          opponentId: true,
          opponent: { select: { username: true, avatarId: true } },
        },
      },
      opponentUser: { select: { username: true, avatarId: true } },
    },
  });

  let initialBattle: BattleArenaProps | null = null;
  let hasHealthyTeam = true;
  let lobby: BattleLobbyData | null = null;

  if (!battle) {
    // En un desafío de gym no se puede escapar al encuentro salvaje para curar.
    // Importante: NO redirigir acá automáticamente. Si el server action de
    // batalla revalida el layout, un redirect a /run mata la animación de KO
    // y el cartel de resultado. CombatLockGate + el CTA del resumen llevan
    // al jugador de vuelta al pasillo cuando corresponde.
    const gymRun = await getActiveGymRun(userId);
    if (gymRun) {
      return (
        <BattleScreen
          initialBattle={null}
          locale={locale}
          hasHealthyTeam={true}
          lobby={null}
          gymContinueId={gymRun.gymId}
        />
      );
    }

    const [user, partyRows, inventory, recentRows, progress] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        // `coins` y `lastHealAt` alimentan el Centro Pokémon del lobby: curar
        // sin tener que ir a /team y volver.
        select: {
          energy: true,
          energyMax: true,
          energyUpdatedAt: true,
          coins: true,
          lastHealAt: true,
        },
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
      heal: (() => {
        const hurt = partyRows.filter(
          (p) => p.currentHp < calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution),
        ).length;
        return {
          hurtCount: hurt,
          cooldownMsLeft: healCooldownMsLeft(user.lastHealAt),
          rushCost: healRushCost(hurt),
          coins: user.coins,
          teamMaxLevel: partyRows.reduce((max, p) => Math.max(max, p.level), 0),
        };
      })(),
    };
  }

  if (battle) {
    const instance = battle.pokemonInstance;
    const playerMaxHp = calculateMaxHp(
      instance.species.baseHp,
      instance.level,
      instance.ptConstitution,
    );
    const currentSlot = battle.gymPokemonSlot ?? battle.opponentSlot ?? 1;
    const pvpTeam = battle.pvpMatchId ? parseTeamSnap(battle.pvpMatch?.opponentTeam) : [];

    const [pokeballs, potions, partyRows, opponentTeam, userRow] = await Promise.all([
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
      battle.pvpMatchId
        ? Promise.resolve([])
        : battle.gymTrainerId
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
      prisma.user.findUnique({
        where: { id: userId },
        select: { avatarId: true },
      }),
    ]);

    const opponentParty: OpponentPartyMember[] =
      pvpTeam.length > 0
        ? pvpTeam.map((m) => ({
            slot: m.slot,
            name: m.name,
            spriteUrl: m.spriteUrl,
            fainted: m.slot < currentSlot,
            active: m.slot === currentSlot,
          }))
        : opponentTeam.length > 0
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
    const tGyms = battle.gym ? await getTranslations("gyms") : null;
    const gymBadgeKey = battle.gym ? `badges.${battle.gym.order}` : null;
    const gymBadgeName =
      tGyms && gymBadgeKey && tGyms.has(gymBadgeKey)
        ? tGyms(gymBadgeKey)
        : (battle.gym?.badgeName ?? null);
    const gymNameKey = battle.gym ? `names.${battle.gym.order}` : null;
    const gymName =
      tGyms && gymNameKey && tGyms.has(gymNameKey)
        ? tGyms(gymNameKey)
        : (battle.gym?.name ?? null);
    const pvpOpponentName =
      battle.opponentUser?.username ?? battle.pvpMatch?.opponent.username ?? null;
    const opponentName = battle.pvpMatchId
      ? pvpOpponentName
      : routeTrainer
        ? tCampaign(routeTrainer.nameKey)
        : (battle.gymTrainer?.name ?? battle.gym?.leaderName ?? null);

    const trainerPortraitUrl = avatarById(userRow?.avatarId)?.src ?? null;
    let opponentPortraitUrl: string | null = null;
    if (battle.pvpMatchId) {
      const avId = battle.opponentUser?.avatarId ?? battle.pvpMatch?.opponent.avatarId ?? null;
      opponentPortraitUrl = avatarById(avId)?.src ?? null;
    } else if (routeTrainer) {
      opponentPortraitUrl = showdownTrainerSpriteUrl(routeTrainer.spriteSlug);
    } else if (battle.gymTrainerId && battle.gym?.type) {
      opponentPortraitUrl = showdownTrainerSpriteUrl(gymTypeTrainerSpriteSlug(battle.gym.type));
    } else if (battle.gym?.leaderName) {
      opponentPortraitUrl = gymLeaderPortraitUrl(battle.gym.leaderName);
    }

    const battleMode: BattleArenaProps["battleMode"] = battle.pvpMatchId
      ? "pvp"
      : battle.gymId
        ? "gym"
        : "wild";

    const progress =
      battleMode === "wild"
        ? await ensureCampaignProgress(userId)
        : null;
    const farmingLocationId = progress?.farmingLocationId ?? null;
    const locationKind = farmingLocationId
      ? (getKantoLocation(farmingLocationId)?.kind ?? null)
      : null;
    const battleBg = resolveBattleBg({
      battleMode,
      battleId: battle.id,
      locationKind,
      locationId: farmingLocationId,
      gymType: battle.gym?.type ?? null,
      isRouteTrainer: Boolean(routeTrainer),
    });

    initialBattle = {
      battleId: battle.id,
      locale,
      trainerName: session.user.name ?? "Trainer",
      trainerPortraitUrl,
      opponentPortraitUrl,
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
        types: r.species.types,
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
        name: pvpTeam.find((m) => m.slot === currentSlot)?.name ?? battle.wildSpecies.name,
        speciesName:
          pvpTeam.find((m) => m.slot === currentSlot)?.speciesName ?? battle.wildSpecies.name,
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
        power: m.move.power,
        pp: effectivePp(m.currentPp, m.move.pp),
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
      gymName,
      gymLeaderName: battle.gym?.leaderName ?? null,
      gymBadgeName,
      battleMode,
      battleBg,
      pvpMatchId: battle.pvpMatchId,
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
