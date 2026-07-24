"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEscape } from "@/lib/flee";
import { resolveMoveUse, type TurnEvent } from "@/lib/battle";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { hasHealthyBackup } from "@/lib/team";

const MAX_LOG_LINES = 20;

export interface FleeBattleResult {
  fled: boolean;
  counterAttack: TurnEvent | null; // si falla la fuga, el salvaje ataca gratis
  outcome: "fled" | "continues" | "lost" | "fainted";
}

export async function fleeBattle(sessionId: string, locale: string): Promise<FleeBattleResult | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    // No se puede huir de un combate de gimnasio (entrenador o líder) — la
    // única forma de salir de una corrida es desde el pasillo, entre batallas.
    where: { id: sessionId, userId, status: "ACTIVE", gymId: null },
    include: {
      pokemonInstance: { include: { species: true } },
      wildSpecies: true,
    },
  });
  if (!battle) return null;

  const instance = battle.pokemonInstance;
  const playerStats = playerCombatantStats(instance.species, instance.level, instance);
  const wildStats = wildCombatantStats(battle.wildSpecies, battle.wildLevel);

  if (canEscape(playerStats.speed, wildStats.speed)) {
    await prisma.battleSession.update({
      where: { id: battle.id },
      data: { status: "FLED", log: [...battle.log, "¡Escapaste con éxito!"].slice(-MAX_LOG_LINES) },
    });
    return { fled: true, counterAttack: null, outcome: "fled" };
  }

  // Fuga fallida: el salvaje ataca gratis, como en los juegos reales.
  const wildMoves = await prisma.move.findMany({ where: { id: { in: battle.wildMoveIds } } });
  const wildMove = wildMoves[Math.floor(Math.random() * wildMoves.length)];
  const wildName = battle.wildSpecies.name;
  const result = resolveMoveUse(wildStats, playerStats, wildMove);

  let playerHp = instance.currentHp;
  const log = [...battle.log, "¡No pudiste escapar!"];
  let counterAttack: TurnEvent;

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
    fled: false,
    counterAttack,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
  };
}
