import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp, calculateStat } from "@/lib/stats";
import { wildCombatantStats } from "@/lib/combatant";
import { effectivePp } from "@/lib/battle";
import { getCurrentEnergy, WILD_ENCOUNTER_ENERGY_COST } from "@/lib/energy";
import { getActiveGymRun, getActiveTowerRun } from "@/lib/battle-lock";
import { healCooldownMsLeft, healRushCost } from "@/lib/healing";
import { BattleScreen } from "@/components/battle-screen";
import { isReviveItemName } from "@/lib/squad-bag";
import type { BattleArenaProps, OpponentPartyMember } from "@/components/battle-arena";
import type { BattleLobbyData } from "@/lib/battle-lobby";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  campaignMapSrc,
  findLocation,
  findStage,
  regionMapSrc,
  stageEncounterRate,
} from "@/lib/campaign";
import { loadMapLocations } from "@/lib/campaign/map-data";
import { spriteFor } from "@/lib/shiny";
import { getRouteTrainer } from "@/lib/campaign/trainers";
import { avatarById, npcTrainerPortraitUrl, showdownTrainerSpriteUrl } from "@/lib/avatars";
import { gymLeaderPortraitUrl, gymTypeTrainerSpriteSlug } from "@/lib/gym-art";
import { parseTeamSnap } from "@/lib/pvp/team";
import { resolveBattleBg } from "@/lib/battle-bg";
import { parseDoublesFieldB } from "@/lib/doubles";
import {
  BATTLE_AUTO_UNLOCK_LEVEL,
  isBattleAutoUnlocked,
} from "@/lib/battle-auto";
import { battleUsesTurnTimer, nextTurnDeadline } from "@/lib/battle-turn-timer";
import { closeBattleIfIdle } from "@/lib/close-battle-if-idle";
import { isTutorialBattle } from "@/lib/battle-tutorial";

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

  let battle = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      pokemonInstance: {
        include: {
          species: true,
          moves: { include: { move: true }, orderBy: { slot: "asc" } },
        },
      },
      pokemonInstanceB: {
        include: {
          species: true,
          moves: { include: { move: true }, orderBy: { slot: "asc" } },
        },
      },
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
      clanWarBattle: {
        select: {
          id: true,
          opponentTeam: true,
          war: { select: { clanAId: true, clanBId: true } },
        },
      },
      opponentUser: { select: { username: true, avatarId: true } },
    },
  });

  if (battle) {
    if (await closeBattleIfIdle(battle, locale)) {
      battle = null;
    } else if (battleUsesTurnTimer(battle) && !battle.turnDeadlineAt) {
      const deadline = nextTurnDeadline();
      await prisma.battleSession.update({
        where: { id: battle.id },
        data: { turnDeadlineAt: deadline },
      });
      battle = { ...battle, turnDeadlineAt: deadline };
    } else if (!battleUsesTurnTimer(battle) && battle.turnDeadlineAt) {
      await prisma.battleSession.update({
        where: { id: battle.id },
        data: { turnDeadlineAt: null },
      });
      battle = { ...battle, turnDeadlineAt: null };
    }
  }

  let initialBattle: BattleArenaProps | null = null;
  let hasHealthyTeam = true;
  let lobby: BattleLobbyData | null = null;

  if (!battle) {
    // En un desafío de gym/torre no se puede escapar al encuentro salvaje para curar.
    // Importante: NO redirigir acá automáticamente. Si el server action de
    // batalla revalida el layout, un redirect mata la animación de KO
    // y el cartel de resultado. CombatLockGate + el CTA del resumen llevan
    // al jugador de vuelta cuando corresponde.
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

    const towerRun = await getActiveTowerRun(userId);
    if (towerRun) {
      return (
        <BattleScreen
          initialBattle={null}
          locale={locale}
          hasHealthyTeam={true}
          lobby={null}
          towerContinue
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
        include: {
          item: {
            select: {
              type: true,
              name: true,
              catchMultiplier: true,
              healAmount: true,
              buyPrice: true,
            },
          },
        },
      }),
      prisma.battleSession.findMany({
        where: {
          userId,
          // Solo salvajes de Aventura: sin gimnasio, torre, PvP, guerra ni
          // entrenadores de ruta (esos también usan BattleSession).
          gymId: null,
          gymRunId: null,
          towerRunId: null,
          pvpMatchId: null,
          clanWarBattleId: null,
          routeTrainerId: null,
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
      .map((i) => ({
        name: i.item.name,
        quantity: i.quantity,
        potency: i.item.catchMultiplier,
      }))
      .sort(
        (a, b) =>
          (b.potency ?? 0) - (a.potency ?? 0) ||
          b.quantity - a.quantity ||
          a.name.localeCompare(b.name),
      );
    const heals = inventory
      .filter((i) => i.item.type === "POTION" && i.item.healAmount != null)
      .map((i) => ({
        name: i.item.name,
        quantity: i.quantity,
        potency: i.item.healAmount,
      }))
      .sort(
        (a, b) =>
          (a.potency ?? 0) - (b.potency ?? 0) ||
          b.quantity - a.quantity ||
          a.name.localeCompare(b.name),
      );

    const stage = findStage(progress.farmingStageId)?.stage;
    const location = findLocation(progress.farmingLocationId)?.location;
    const energyCost = stage?.energyCost ?? WILD_ENCOUNTER_ENERGY_COST;

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
      heals,
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
    const pvpTeam = battle.pvpMatchId
      ? parseTeamSnap(battle.pvpMatch?.opponentTeam)
      : battle.clanWarBattleId
        ? parseTeamSnap(battle.clanWarBattle?.opponentTeam)
        : [];

    const [pokeballs, potions, partyRows, opponentTeam, userRow, autoUnlockLevels] =
      await Promise.all([
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
      battle.pvpMatchId || battle.clanWarBattleId
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
      prisma.pokemonInstance.findMany({
        where: {
          ownerId: userId,
          level: { gte: BATTLE_AUTO_UNLOCK_LEVEL },
        },
        select: { level: true },
        take: 3,
      }),
    ]);

    const autoBattleUnlocked = isBattleAutoUnlocked(
      autoUnlockLevels.map((row) => row.level),
    );
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
                spriteUrl: spriteFor(battle.wildSpecies.spriteUrl, battle.wildIsShiny),
                fainted: false,
                active: true,
              },
            ];

    // Un entrenador de ruta tiene nombre propio: no es un "Pokémon salvaje".
    const routeTrainer = battle.routeTrainerId ? getRouteTrainer(battle.routeTrainerId) : null;
    const tCampaign = await getTranslations("campaign");
    const tBattle = await getTranslations("battle");
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
    const tutorialBattle = isTutorialBattle(battle);
    const opponentName =
      battle.pvpMatchId || battle.clanWarBattleId
        ? pvpOpponentName
        : routeTrainer
          ? tCampaign(routeTrainer.nameKey)
          : tutorialBattle
            ? tBattle("tutorialRival")
            : (battle.gymTrainer?.name ?? battle.gym?.leaderName ?? null);

    const trainerPortraitUrl = avatarById(userRow?.avatarId)?.src ?? null;
    let opponentPortraitUrl: string | null = null;
    if (battle.pvpMatchId || battle.clanWarBattleId) {
      const avId = battle.opponentUser?.avatarId ?? battle.pvpMatch?.opponent.avatarId ?? null;
      opponentPortraitUrl = avatarById(avId)?.src ?? null;
    } else if (routeTrainer) {
      opponentPortraitUrl = npcTrainerPortraitUrl(routeTrainer.spriteSlug, "thumb");
    } else if (battle.gymTrainerId && battle.gym?.type) {
      opponentPortraitUrl = showdownTrainerSpriteUrl(gymTypeTrainerSpriteSlug(battle.gym.type));
    } else if (battle.gym?.leaderName) {
      opponentPortraitUrl = gymLeaderPortraitUrl(battle.gym.leaderName);
    }

    const battleMode: BattleArenaProps["battleMode"] =
      battle.pvpMatchId || battle.clanWarBattleId
        ? "pvp"
        : battle.towerRunId
          ? "tower"
          : battle.gymId
            ? "gym"
            : "wild";

    const progress =
      battleMode === "wild"
        ? await ensureCampaignProgress(userId)
        : null;
    const farmingLocationId = progress?.farmingLocationId ?? null;
    const locationKind = farmingLocationId
      ? (findLocation(farmingLocationId)?.location.kind ?? null)
      : null;
    const battleBg = resolveBattleBg({
      battleMode,
      battleId: battle.id,
      locationKind,
      locationId: farmingLocationId,
      gymType: battle.gym?.type ?? null,
      isRouteTrainer: Boolean(routeTrainer),
    });

    let encounterPlace: BattleArenaProps["encounterPlace"] = null;
    if (battleMode === "wild" && progress) {
      const loc = findLocation(progress.farmingLocationId)?.location;
      const stage = findStage(progress.farmingStageId)?.stage;
      if (loc) {
        encounterPlace = {
          title: tCampaign(loc.nameKey),
          subtitle: stage ? tCampaign(stage.nameKey) : null,
          iconUrl: campaignMapSrc(loc.id),
        };
      }
    } else if (battleMode === "tower" && battle.towerRunId) {
      const floorFromLog = [...battle.log]
        .reverse()
        .find((line) => line.startsWith("towerFloor:"));
      let floorNumber: number | null = floorFromLog
        ? Number(floorFromLog.slice("towerFloor:".length))
        : null;
      if (floorNumber == null || Number.isNaN(floorNumber)) {
        const run = await prisma.towerRun.findUnique({
          where: { id: battle.towerRunId },
          select: { currentFloor: true },
        });
        floorNumber = run?.currentFloor ?? null;
      }
      if (floorNumber != null) {
        encounterPlace = {
          title: tBattle("towerFloorLabel", { floor: floorNumber }),
          subtitle: tBattle("towerTitle"),
          iconUrl: "/nav/tower-icon.png",
        };
      }
    }

    const isDouble = battle.format === "DOUBLE";
    const fieldB = isDouble ? parseDoublesFieldB(battle.fieldB) : null;
    const instB = battle.pokemonInstanceB;
    const wildBSpecies =
      fieldB?.wild.speciesId != null
        ? await prisma.species.findUnique({ where: { id: fieldB.wild.speciesId } })
        : null;

    initialBattle = {
      battleId: battle.id,
      locale,
      trainerName: session.user.name ?? "Trainer",
      trainerPortraitUrl,
      opponentPortraitUrl,
      opponentName,
      format: isDouble ? "DOUBLE" : "SINGLE",
      pokeballs: pokeballs.map((p) => ({
        itemId: p.itemId,
        name: p.item.name,
        quantity: p.quantity,
      })),
      potions: potions
        .filter(
          (p) => p.item.healAmount != null || isReviveItemName(p.item.name),
        )
        .map((p) => {
          const isRevive = isReviveItemName(p.item.name);
          return {
            itemId: p.itemId,
            name: p.item.name,
            quantity: p.quantity,
            healAmount: p.item.healAmount ?? 0,
            kind: (isRevive ? "revive" : "heal") as "heal" | "revive",
          };
        }),
      party: partyRows.map((r) => ({
        instanceId: r.id,
        name: r.nickname ?? r.species.name,
        speciesName: r.species.name,
        level: r.level,
        spriteUrl: spriteFor(r.species.spriteUrl, r.isShiny),
        isShiny: r.isShiny,
        currentHp:
          r.id === instance.id
            ? instance.currentHp
            : r.id === instB?.id
              ? instB.currentHp
              : r.currentHp,
        maxHp: calculateMaxHp(r.species.baseHp, r.level, r.ptConstitution),
        types: r.species.types,
      })),
      player: {
        instanceId: instance.id,
        name: instance.nickname ?? instance.species.name,
        speciesName: instance.species.name,
        level: instance.level,
        spriteUrl: spriteFor(instance.species.spriteUrl, instance.isShiny),
        isShiny: instance.isShiny,
        currentHp: instance.currentHp,
        maxHp: playerMaxHp,
      },
      playerB:
        isDouble && instB
          ? {
              instanceId: instB.id,
              name: instB.nickname ?? instB.species.name,
              speciesName: instB.species.name,
              level: instB.level,
              spriteUrl: spriteFor(instB.species.spriteUrl, instB.isShiny),
              isShiny: instB.isShiny,
              currentHp: instB.currentHp,
              maxHp: calculateMaxHp(
                instB.species.baseHp,
                instB.level,
                instB.ptConstitution,
              ),
            }
          : null,
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
      wildB:
        isDouble && fieldB && wildBSpecies
          ? {
              name: wildBSpecies.name,
              speciesName: wildBSpecies.name,
              level: fieldB.wild.level,
              spriteUrl: spriteFor(wildBSpecies.spriteUrl, fieldB.wild.isShiny),
              isShiny: fieldB.wild.isShiny,
              currentHp: fieldB.wild.currentHp,
              maxHp: fieldB.wild.maxHp,
              types: wildBSpecies.types,
            }
          : null,
      moves: instance.moves.map((m) => ({
        moveId: m.moveId,
        name: m.move.name,
        type: m.move.type,
        power: m.move.power,
        accuracy: m.move.accuracy,
        category: m.move.category,
        pp: effectivePp(m.currentPp, m.move.pp),
        maxPp: m.move.pp,
        target: m.move.target ?? null,
        effectText: m.move.effectText ?? null,
      })),
      movesB:
        isDouble && instB
          ? instB.moves.map((m) => ({
              moveId: m.moveId,
              name: m.move.name,
              type: m.move.type,
              power: m.move.power,
              accuracy: m.move.accuracy,
              category: m.move.category,
              pp: effectivePp(m.currentPp, m.move.pp),
              maxPp: m.move.pp,
              target: m.move.target ?? null,
              effectText: m.move.effectText ?? null,
            }))
          : undefined,
      initialLog: battle.log,
      opponentParty:
        isDouble && fieldB && wildBSpecies
          ? [
              {
                slot: 1,
                name: battle.wildSpecies.name,
                spriteUrl: spriteFor(battle.wildSpecies.spriteUrl, battle.wildIsShiny),
                fainted: battle.wildCurrentHp <= 0,
                active: true,
              },
              {
                slot: 2,
                name: wildBSpecies.name,
                spriteUrl: spriteFor(wildBSpecies.spriteUrl, fieldB.wild.isShiny),
                fainted: fieldB.wild.currentHp <= 0,
                active: true,
              },
            ]
          : opponentParty,
      playerStatus: battle.playerStatus,
      wildStatus: battle.wildStatus,
      playerBStatus: fieldB?.player.status ?? null,
      wildBStatus: fieldB?.wild.status ?? null,
      playerStats: {
        atk: calculateStat(instance.species.baseAttack, instance.ptStrength, instance.level),
        spAtk: calculateStat(
          instance.species.baseSpAtk,
          instance.ptIntelligence,
          instance.level,
        ),
        speed: calculateStat(instance.species.baseSpeed, instance.ptSpeed, instance.level),
      },
      playerBStats:
        isDouble && instB
          ? {
              atk: calculateStat(instB.species.baseAttack, instB.ptStrength, instB.level),
              spAtk: calculateStat(
                instB.species.baseSpAtk,
                instB.ptIntelligence,
                instB.level,
              ),
              speed: calculateStat(instB.species.baseSpeed, instB.ptSpeed, instB.level),
            }
          : null,
      wildStats: (() => {
        const pvpActive = pvpTeam.find((m) => m.slot === currentSlot);
        if (pvpActive) {
          return {
            def: pvpActive.stats.def,
            spDef: pvpActive.stats.spDef,
            speed: pvpActive.stats.speed,
          };
        }
        const stats = wildCombatantStats(battle.wildSpecies, battle.wildLevel);
        return { def: stats.def, spDef: stats.spDef, speed: stats.speed };
      })(),
      wildBStats:
        isDouble && fieldB && wildBSpecies
          ? (() => {
              const stats = wildCombatantStats(wildBSpecies, fieldB.wild.level);
              return { def: stats.def, spDef: stats.spDef, speed: stats.speed };
            })()
          : null,
      playerChoiceLockMoveId: battle.playerChoiceLockMoveId,
      playerChargeMoveId: battle.playerChargeMoveId,
      playerChargeMoveIdB: fieldB?.player.chargeMoveId ?? null,
      gymId: battle.gymId,
      gymRunId: battle.gymRunId,
      towerRunId: battle.towerRunId,
      gymType: battle.gym?.type ?? null,
      gymName,
      gymLeaderName: battle.gym?.leaderName ?? null,
      gymBadgeName,
      battleMode,
      battleBg,
      encounterPlace,
      pvpMatchId: battle.pvpMatchId,
      turnDeadlineAt: battle.turnDeadlineAt?.toISOString() ?? null,
      fleeAttempts: battle.fleeAttempts,
      autoBattleUnlocked,
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
