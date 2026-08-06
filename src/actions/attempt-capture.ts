"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { attemptCapture as rollCapture } from "@/lib/capture";
import type { TurnEvent } from "@/lib/battle";
import { getMovesetForLevel } from "@/lib/moveset";
import { calculateMaxHp, calculateStat, unspentPointsForLevel, xpForLevel } from "@/lib/stats";
import { hasHealthyBackup } from "@/lib/team";
import { captureStatusBonus } from "@/lib/status";
import { getZoneContext, grantZoneMastery } from "@/lib/zone-progress";
import { completeFarmingStageOnWildWin } from "@/lib/campaign/sync";
import { runWildCounterAttack } from "@/lib/wild-counter";
import { revalidateCombatUi } from "@/lib/battle-lock";
import { markSpeciesSeen } from "@/lib/pokedex-seen";
import { SHINY_CATCH_REWARD, spriteFor } from "@/lib/shiny";
import { closeBattleIfIdle } from "@/lib/close-battle-if-idle";

const MAX_LOG_LINES = 20;
const TEAM_SIZE = 6;

export interface CapturedPokemonInfo {
  instanceId: string;
  speciesId: number;
  name: string;
  level: number;
  spriteUrl: string;
  types: string[];
  maxHp: number;
  stats: { attack: number; defense: number; spAtk: number; spDef: number; speed: number };
  moves: { moveId: number; name: string; type: string; pp: number }[];
  /** true si el equipo estaba lleno y fue al PC. */
  sentToPc: boolean;
  isShiny: boolean;
  shinyReward: { coins: number; gems: number } | null;
}

export interface AttemptCaptureResult {
  caught: boolean;
  shakes: number;
  ballName: string;
  counterAttack: TurnEvent | null;
  playerHpAfter: number;
  outcome: "caught" | "continues" | "lost" | "fainted";
  capturedPokemon: CapturedPokemonInfo | null;
}

export async function attemptCapture(
  sessionId: string,
  itemId: string,
  locale: string,
): Promise<AttemptCaptureResult | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const [battle, inventoryItem] = await Promise.all([
    prisma.battleSession.findFirst({
      where: { id: sessionId, userId, status: "ACTIVE" },
      include: {
        pokemonInstance: {
          include: {
            species: { include: { evolvesTo: { select: { id: true } } } },
            moves: { include: { move: true } },
            heldItem: true,
          },
        },
        wildSpecies: true,
      },
    }),
    prisma.inventoryItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    }),
  ]);
  if (!battle) return null;
  if (battle.gymId || battle.routeTrainerId) return null;
  if (!inventoryItem || inventoryItem.quantity < 1) return null;
  if (inventoryItem.item.type !== "POKEBALL") return null;
  if (await closeBattleIfIdle(battle, locale)) {
    return {
      caught: false,
      shakes: 0,
      ballName: inventoryItem.item.name,
      counterAttack: null,
      playerHpAfter: battle.pokemonInstance.currentHp,
      outcome: "lost",
      capturedPokemon: null,
    };
  }

  const ball = inventoryItem.item;
  const instance = battle.pokemonInstance;

  await prisma.inventoryItem.update({
    where: { userId_itemId: { userId, itemId } },
    data: { quantity: { decrement: 1 } },
  });

  // Mastery de la zona: sube la probabilidad de captura donde más farmeaste.
  const zone = battle.gymId ? null : await getZoneContext(userId);
  const masteryMultiplier = 1 + (zone?.bonuses.capture ?? 0) / 100;

  const roll = rollCapture(
    battle.wildCurrentHp,
    battle.wildMaxHp,
    battle.wildSpecies.captureRate,
    (ball.catchMultiplier ?? 1) * masteryMultiplier,
    captureStatusBonus(battle.wildStatus),
  );

  if (roll.caught) {
    const openSlot = await nextOpenTeamSlot(userId);
    const moveIds = await getMovesetForLevel(battle.wildSpeciesId, battle.wildLevel);
    const moves = await prisma.move.findMany({ where: { id: { in: moveIds } } });
    const log = [...battle.log, `ball:${ball.name}`, `caught:${battle.wildSpecies.name}`].slice(
      -MAX_LOG_LINES,
    );

    const newInstance = await prisma.pokemonInstance.create({
      data: {
        ownerId: userId,
        speciesId: battle.wildSpeciesId,
        level: battle.wildLevel,
        xp: xpForLevel(battle.wildLevel),
        currentHp: battle.wildCurrentHp,
        teamSlot: openSlot,
        // El variocolor se decidió al generar el encuentro; acá solo viaja.
        isShiny: battle.wildIsShiny,
        // Mismo pool que si hubiera subido 1→L: el jugador decide cómo gastarlo.
        unspentPoints: unspentPointsForLevel(battle.wildLevel),
        moves: {
          create: moveIds.map((moveId, i) => {
            const m = moves.find((x) => x.id === moveId);
            return { moveId, slot: i + 1, currentPp: m?.pp ?? 20 };
          }),
        },
      },
    });

    const shinyReward = battle.wildIsShiny
      ? { coins: SHINY_CATCH_REWARD.coins, gems: SHINY_CATCH_REWARD.gems }
      : null;

    await prisma.$transaction([
      prisma.battleSession.update({
        where: { id: battle.id },
        data: { status: "CAUGHT", log },
      }),
      prisma.battleLog.create({
        data: { kind: "PVE_WILD", userId, userWon: true },
      }),
      ...(shinyReward
        ? [
            prisma.user.update({
              where: { id: userId },
              data: {
                coins: { increment: shinyReward.coins },
                gems: { increment: shinyReward.gems },
              },
            }),
          ]
        : []),
    ]);

    await markSpeciesSeen(userId, battle.wildSpeciesId);

    // Misma progresión de campaña que un KO: capturar también completa el stage.
    if (!battle.towerRunId) {
      await completeFarmingStageOnWildWin(userId);
      if (zone) await grantZoneMastery(userId, zone.locationId);
    }

    revalidatePath(`/${locale}/team`);
    revalidatePath(`/${locale}/pokedex`);
    revalidatePath(`/${locale}/campaign`);
    revalidateCombatUi(locale);

    const movesById = new Map(moves.map((m) => [m.id, m]));
    const species = battle.wildSpecies;

    return {
      caught: true,
      shakes: roll.shakes,
      ballName: ball.name,
      counterAttack: null,
      playerHpAfter: instance.currentHp,
      outcome: "caught",
      capturedPokemon: {
        instanceId: newInstance.id,
        speciesId: species.id,
        name: species.name,
        level: battle.wildLevel,
        spriteUrl: spriteFor(species.spriteUrl, battle.wildIsShiny),
        types: species.types,
        maxHp: calculateMaxHp(species.baseHp, battle.wildLevel),
        stats: {
          attack: calculateStat(species.baseAttack, 0, battle.wildLevel),
          defense: calculateStat(species.baseDefense, 0, battle.wildLevel),
          spAtk: calculateStat(species.baseSpAtk, 0, battle.wildLevel),
          spDef: calculateStat(species.baseSpDef, 0, battle.wildLevel),
          speed: calculateStat(species.baseSpeed, 0, battle.wildLevel),
        },
        moves: moveIds.map((id) => {
          const m = movesById.get(id)!;
          return { moveId: m.id, name: m.name, type: m.type, pp: m.pp };
        }),
        sentToPc: openSlot === null,
        isShiny: battle.wildIsShiny,
        shinyReward,
      },
    };
  }

  const counter = await runWildCounterAttack(battle);
  const playerHp = counter.playerHp;
  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, instance.id));
  const lostBattle = fainted && !mustSwitch;
  const finalLog = [...battle.log, `ball:${ball.name}`, "brokeFree"].slice(-MAX_LOG_LINES);

  await prisma.$transaction([
    prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: playerHp } }),
    prisma.battleSession.update({
      where: { id: battle.id },
      data: lostBattle
        ? { status: "LOST", log: finalLog, turnDeadlineAt: null, ...counter.statePatch }
        : { log: finalLog, turnDeadlineAt: null, ...counter.statePatch },
    }),
    ...(lostBattle
      ? [prisma.battleLog.create({ data: { kind: "PVE_WILD" as const, userId, userWon: false } })]
      : []),
  ]);

  revalidatePath(`/${locale}/team`);

  return {
    caught: false,
    shakes: roll.shakes,
    ballName: ball.name,
    counterAttack: counter.counterAttack,
    playerHpAfter: playerHp,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
    capturedPokemon: null,
  };
}

async function nextOpenTeamSlot(userId: string): Promise<number | null> {
  const team = await prisma.pokemonInstance.findMany({
    where: { ownerId: userId, teamSlot: { not: null } },
    select: { teamSlot: true },
  });
  const taken = new Set(team.map((p) => p.teamSlot));
  for (let slot = 1; slot <= TEAM_SIZE; slot++) {
    if (!taken.has(slot)) return slot;
  }
  return null;
}
