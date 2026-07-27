"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TurnEvent } from "@/lib/battle";
import { effectivePp, mergeBattleParticipantIds } from "@/lib/battle";
import { calculateMaxHp } from "@/lib/stats";
import { hasHealthyBackup } from "@/lib/team";
import { runWildCounterAttack } from "@/lib/wild-counter";

const MAX_LOG_LINES = 20;

export interface SwitchPokemonResult {
  newPlayer: {
    instanceId: string;
    name: string;
    speciesName: string;
    level: number;
    spriteUrl: string;
    currentHp: number;
    maxHp: number;
    moves: { moveId: number; name: string; type: string; power: number | null; pp: number; maxPp: number }[];
  };
  counterAttack: TurnEvent | null;
  outcome: "continues" | "lost" | "fainted";
}

export async function switchPokemon(
  sessionId: string,
  newInstanceId: string,
  locale: string,
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
    include: {
      species: { include: { evolvesTo: { select: { id: true } } } },
      moves: { include: { move: true }, orderBy: { slot: "asc" } },
      heldItem: true,
    },
  });
  if (!newInstance || newInstance.id === battle.pokemonInstanceId || newInstance.currentHp <= 0) {
    return null;
  }

  const newName = newInstance.nickname ?? newInstance.species.name;
  const newMoves = newInstance.moves.map((m) => ({
    moveId: m.moveId,
    name: m.move.name,
    type: m.move.type,
    power: m.move.power,
    pp: effectivePp(m.currentPp, m.move.pp),
    maxPp: m.move.pp,
  }));
  // Siempre incluir al que sale y al que entra: el lead puede faltar en
  // participantIds si la sesión nació con el default [] o un create viejo.
  const participantIds = mergeBattleParticipantIds(
    battle.participantIds,
    battle.pokemonInstanceId,
    newInstance.id,
  );
  const outgoingHp = battle.pokemonInstance.currentHp;

  const clearPlayerStatus = {
    playerStatus: null as null,
    playerSleepTurns: 0,
    playerAtkStage: 0,
    playerDefStage: 0,
    playerSpeStage: 0,
    // El objeto equipado del que entra puede ser otro (o ninguno) — el lock
    // de Choice y el consumo de Focus Sash/Sitrus/Lum son por Pokémon.
    playerChoiceLockMoveId: null as number | null,
    playerItemConsumed: false,
  };

  if (forced) {
    // El KO del saliente ya se persistió en battle-move (currentHp: 0).
    await prisma.battleSession.update({
      where: { id: battle.id },
      data: {
        pokemonInstanceId: newInstance.id,
        participantIds,
        ...clearPlayerStatus,
        log: [...battle.log, `switchForced:${newName}`].slice(-MAX_LOG_LINES),
      },
    });

    revalidatePath(`/${locale}/team`);

    return {
      newPlayer: {
        instanceId: newInstance.id,
        name: newName,
        speciesName: newInstance.species.name,
        level: newInstance.level,
        spriteUrl: newInstance.species.spriteUrl,
        currentHp: newInstance.currentHp,
        maxHp: calculateMaxHp(newInstance.species.baseHp, newInstance.level, newInstance.ptConstitution),
        moves: newMoves,
      },
      counterAttack: null,
      outcome: "continues",
    };
  }

  const counter = await runWildCounterAttack({
    ...battle,
    pokemonInstance: {
      ...newInstance,
      species: newInstance.species,
    },
    ...clearPlayerStatus,
  });

  const playerHp = counter.playerHp;
  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, newInstance.id));
  const lostBattle = fainted && !mustSwitch;
  const finalLog = [...battle.log, `switch:${newName}`].slice(-MAX_LOG_LINES);

  await prisma.$transaction([
    // Persistir HP del que sale (por si el último turno no flusheó) y del que entra.
    prisma.pokemonInstance.update({
      where: { id: battle.pokemonInstanceId },
      data: { currentHp: Math.max(0, outgoingHp) },
    }),
    prisma.pokemonInstance.update({ where: { id: newInstance.id }, data: { currentHp: playerHp } }),
    prisma.battleSession.update({
      where: { id: battle.id },
      data: {
        pokemonInstanceId: newInstance.id,
        log: finalLog,
        participantIds,
        ...clearPlayerStatus,
        ...counter.statePatch,
        // el statePatch puede pisar playerStatus con el del counter (sobre el que entró)
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

  if (lostBattle && battle.gymId) {
    const { notifyGymResult } = await import("@/lib/notifications");
    await notifyGymResult(userId, battle.gymId, false);
  }

  revalidatePath(`/${locale}/team`);

  return {
    newPlayer: {
      instanceId: newInstance.id,
      name: newName,
      speciesName: newInstance.species.name,
      level: newInstance.level,
      spriteUrl: newInstance.species.spriteUrl,
      currentHp: playerHp,
      maxHp: calculateMaxHp(newInstance.species.baseHp, newInstance.level, newInstance.ptConstitution),
      moves: newMoves,
    },
    counterAttack: counter.counterAttack,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
  };
}
