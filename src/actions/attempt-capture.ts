"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { attemptCapture as rollCapture } from "@/lib/capture";
import { resolveMoveUse, type TurnEvent } from "@/lib/battle";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { getMovesetForLevel } from "@/lib/moveset";
import { xpForLevel } from "@/lib/stats";
import { hasHealthyBackup } from "@/lib/team";

const MAX_LOG_LINES = 20;
const TEAM_SIZE = 6;

export interface AttemptCaptureResult {
  caught: boolean;
  shakes: number;
  ballName: string;
  counterAttack: TurnEvent | null; // si falla, el salvaje contraataca
  playerHpAfter: number;
  outcome: "caught" | "continues" | "lost" | "fainted";
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
        pokemonInstance: { include: { species: true, moves: { include: { move: true } } } },
        wildSpecies: true,
      },
    }),
    prisma.inventoryItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    }),
  ]);
  if (!battle) return null;
  if (!inventoryItem || inventoryItem.quantity < 1) return null;
  if (inventoryItem.item.type !== "POKEBALL") return null;

  const ball = inventoryItem.item;
  const instance = battle.pokemonInstance;

  // La ball se consume siempre, atrape o no — como en los juegos reales.
  await prisma.inventoryItem.update({
    where: { userId_itemId: { userId, itemId } },
    data: { quantity: { decrement: 1 } },
  });

  const roll = rollCapture(
    battle.wildCurrentHp,
    battle.wildMaxHp,
    battle.wildSpecies.captureRate,
    ball.catchMultiplier ?? 1,
  );

  if (roll.caught) {
    const openSlot = await nextOpenTeamSlot(userId);
    const moveIds = await getMovesetForLevel(battle.wildSpeciesId, battle.wildLevel);
    const log = [
      ...battle.log,
      `¡Lanzaste ${ball.name}!`,
      `¡Atrapaste a ${battle.wildSpecies.name}!`,
    ].slice(-MAX_LOG_LINES);

    await prisma.$transaction([
      prisma.pokemonInstance.create({
        data: {
          ownerId: userId,
          speciesId: battle.wildSpeciesId,
          level: battle.wildLevel,
          xp: xpForLevel(battle.wildLevel),
          currentHp: battle.wildCurrentHp,
          teamSlot: openSlot,
          moves: { create: moveIds.map((moveId, i) => ({ moveId, slot: i + 1 })) },
        },
      }),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: { status: "CAUGHT", log },
      }),
      prisma.battleLog.create({
        data: { kind: "PVE_WILD", userId, userWon: true },
      }),
    ]);

    revalidatePath(`/${locale}/team`);

    return {
      caught: true,
      shakes: roll.shakes,
      ballName: ball.name,
      counterAttack: null,
      playerHpAfter: instance.currentHp,
      outcome: "caught",
    };
  }

  // Falló: la ball se rompe y el salvaje ataca (el jugador "gastó" su turno).
  const wildMoves = await prisma.move.findMany({ where: { id: { in: battle.wildMoveIds } } });
  const wildMove = wildMoves[Math.floor(Math.random() * wildMoves.length)];
  const playerStats = playerCombatantStats(instance.species, instance.level, instance);
  const wildStats = wildCombatantStats(battle.wildSpecies, battle.wildLevel);

  const result = resolveMoveUse(wildStats, playerStats, wildMove);
  const wildName = battle.wildSpecies.name;
  let playerHp = instance.currentHp;
  const log = [...battle.log, `¡Lanzaste ${ball.name}!`, `${wildName} se liberó...`];
  let counterAttack: TurnEvent | null = null;

  if (result.hit && wildMove.category !== "STATUS") {
    playerHp = Math.max(0, playerHp - result.damage);
    log.push(`${wildName} usó ${wildMove.name} e hizo ${result.damage} de daño.`);
    if (result.effectiveness > 1) log.push("¡Es súper efectivo!");
    else if (result.effectiveness > 0 && result.effectiveness < 1) log.push("No es muy efectivo...");
    else if (result.effectiveness === 0) log.push("No tuvo efecto...");
    counterAttack = {
      side: "wild",
      moveName: wildMove.name,
      hit: true,
      isStatus: false,
      damage: result.damage,
      effectiveness: result.effectiveness,
      hpAfter: playerHp,
    };
  } else if (!result.hit) {
    log.push(`${wildName} usó ${wildMove.name} pero falló.`);
    counterAttack = {
      side: "wild",
      moveName: wildMove.name,
      hit: false,
      isStatus: false,
      damage: 0,
      effectiveness: 1,
      hpAfter: playerHp,
    };
  } else {
    log.push(`${wildName} usó ${wildMove.name}.`);
    counterAttack = {
      side: "wild",
      moveName: wildMove.name,
      hit: true,
      isStatus: true,
      damage: 0,
      effectiveness: 1,
      hpAfter: playerHp,
    };
  }

  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, instance.id));
  const lostBattle = fainted && !mustSwitch;
  if (fainted) log.push(`${instance.nickname ?? instance.species.name} se debilitó.`);
  const finalLog = log.slice(-MAX_LOG_LINES);

  await prisma.$transaction([
    prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: playerHp } }),
    prisma.battleSession.update({
      where: { id: battle.id },
      data: lostBattle ? { status: "LOST", log: finalLog } : { log: finalLog },
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
    counterAttack,
    playerHpAfter: playerHp,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
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
  return null; // equipo lleno → va al almacenamiento (PC)
}
