"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveMoveUse, type TurnEvent } from "@/lib/battle";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { calculateMaxHp } from "@/lib/stats";
import { hasHealthyBackup } from "@/lib/team";

const MAX_LOG_LINES = 20;

export interface SwitchPokemonResult {
  newPlayer: {
    instanceId: string;
    name: string;
    level: number;
    spriteUrl: string;
    currentHp: number;
    maxHp: number;
    moves: { moveId: number; name: string; type: string; pp: number }[];
  };
  counterAttack: TurnEvent | null;
  outcome: "continues" | "lost" | "fainted";
}

export async function switchPokemon(
  sessionId: string,
  newInstanceId: string,
  locale: string,
  // Un cambio voluntario gasta el turno (el salvaje ataca al que entra). Un
  // cambio forzado por debilitamiento no: el turno ya se gastó cuando el
  // Pokémon anterior cayó, así que el que entra no recibe golpe gratis.
  forced = false,
): Promise<SwitchPokemonResult | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    where: { id: sessionId, userId, status: "ACTIVE" },
    include: { pokemonInstance: { include: { species: true } }, wildSpecies: true },
  });
  if (!battle) return null;

  const newInstance = await prisma.pokemonInstance.findFirst({
    where: { id: newInstanceId, ownerId: userId, teamSlot: { not: null } },
    include: { species: true, moves: { include: { move: true }, orderBy: { slot: "asc" } } },
  });
  if (!newInstance || newInstance.id === battle.pokemonInstanceId || newInstance.currentHp <= 0) {
    return null;
  }

  const oldName = battle.pokemonInstance.nickname ?? battle.pokemonInstance.species.name;
  const newName = newInstance.nickname ?? newInstance.species.name;
  const newMoves = newInstance.moves.map((m) => ({
    moveId: m.moveId,
    name: m.move.name,
    type: m.move.type,
    pp: m.move.pp,
  }));
  const participantIds = battle.participantIds.includes(newInstance.id)
    ? battle.participantIds
    : [...battle.participantIds, newInstance.id];

  if (forced) {
    const log = [...battle.log, `${oldName} no puede continuar. ¡Adelante, ${newName}!`].slice(-MAX_LOG_LINES);

    await prisma.battleSession.update({
      where: { id: battle.id },
      data: { pokemonInstanceId: newInstance.id, log, participantIds },
    });

    revalidatePath(`/${locale}/team`);

    return {
      newPlayer: {
        instanceId: newInstance.id,
        name: newName,
        level: newInstance.level,
        spriteUrl: newInstance.species.spriteUrl,
        currentHp: newInstance.currentHp,
        maxHp: calculateMaxHp(newInstance.species.baseHp, newInstance.level),
        moves: newMoves,
      },
      counterAttack: null,
      outcome: "continues",
    };
  }

  // Cambiar de Pokémon gasta el turno completo: el salvaje ataca al que entra.
  const wildMoves = await prisma.move.findMany({ where: { id: { in: battle.wildMoveIds } } });
  const wildMove = wildMoves[Math.floor(Math.random() * wildMoves.length)];
  const wildStats = wildCombatantStats(battle.wildSpecies, battle.wildLevel);
  const newPlayerStats = playerCombatantStats(newInstance.species, newInstance.level, newInstance);

  const result = resolveMoveUse(wildStats, newPlayerStats, wildMove);
  const wildName = battle.wildSpecies.name;
  let playerHp = newInstance.currentHp;
  const log = [...battle.log, `¡Volvé, ${oldName}! ¡Adelante, ${newName}!`];
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
      moveType: wildMove.type,
      category: wildMove.category,
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
      moveType: wildMove.type,
      category: wildMove.category,
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
      moveType: wildMove.type,
      category: wildMove.category,
      hit: true,
      isStatus: true,
      damage: 0,
      effectiveness: 1,
      hpAfter: playerHp,
    };
  }

  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, newInstance.id));
  const lostBattle = fainted && !mustSwitch;
  if (fainted) log.push(`${newName} se debilitó.`);
  const finalLog = log.slice(-MAX_LOG_LINES);

  await prisma.$transaction([
    prisma.pokemonInstance.update({ where: { id: newInstance.id }, data: { currentHp: playerHp } }),
    prisma.battleSession.update({
      where: { id: battle.id },
      data: {
        pokemonInstanceId: newInstance.id,
        log: finalLog,
        participantIds,
        ...(lostBattle ? { status: "LOST" } : {}),
      },
    }),
    ...(lostBattle
      ? [
          prisma.battleLog.create({
            data: {
              kind: battle.gymId ? ("PVE_GYM" as const) : ("PVE_WILD" as const),
              userId,
              userWon: false,
              gymId: battle.gymId,
            },
          }),
        ]
      : []),
    ...(lostBattle && battle.gymId
      ? [prisma.gymAttempt.create({ data: { userId, gymId: battle.gymId, won: false } })]
      : []),
    ...(lostBattle && battle.gymRunId
      ? [prisma.gymRun.update({ where: { id: battle.gymRunId }, data: { status: "ABANDONED" } })]
      : []),
  ]);

  revalidatePath(`/${locale}/team`);

  return {
    newPlayer: {
      instanceId: newInstance.id,
      name: newName,
      level: newInstance.level,
      spriteUrl: newInstance.species.spriteUrl,
      currentHp: playerHp,
      maxHp: calculateMaxHp(newInstance.species.baseHp, newInstance.level),
      moves: newMoves,
    },
    counterAttack,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
  };
}
