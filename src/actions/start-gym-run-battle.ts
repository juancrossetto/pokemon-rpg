"use server";

import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { getMovesetForLevel } from "@/lib/moveset";
import { currentGymRunOpponent } from "@/lib/gym-run";
import { gymBattleEnergyCost, getCurrentEnergy } from "@/lib/energy";
import { revalidateCombatUi } from "@/lib/battle-lock";
import { nextTurnDeadline } from "@/lib/battle-turn-timer";

// Arranca la batalla contra el próximo oponente de una corrida ya iniciada
// (subordinado o líder). La energía se descuenta ACÁ, al iniciar — no al
// ganar/perder. Si después perdés o abandonás la corrida, no se reembolsa.
// El costo depende de contra quién toque (`gymBattleEnergyCost`), así que hay
// que resolver el oponente ANTES de validar la energía: chequear contra el
// costo del líder rechazaría un combate de subordinado que sí se puede pagar.
export async function startGymRunBattle(gymRunId: string, locale: string) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  const existingBattle = await prisma.battleSession.findFirst({ where: { userId, status: "ACTIVE" } });
  if (existingBattle) {
    redirect({ href: "/battle", locale });
    return;
  }

  const run = await prisma.gymRun.findFirst({
    where: { id: gymRunId, userId, status: "ACTIVE" },
    include: { gym: true },
  });
  if (!run) {
    redirect({ href: "/gyms", locale });
    return;
  }

  const [user, lead, opponent] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { energy: true, energyMax: true, energyUpdatedAt: true },
    }),
    // Primer vivo del equipo (no sólo el slot 1): si el líder cayó en la
    // corrida, igual podés seguir con el resto. Antes era un `return` mudo.
    prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: { not: null }, currentHp: { gt: 0 } },
      orderBy: { teamSlot: "asc" },
    }),
    currentGymRunOpponent(run.gymId, run.clearedTrainerSlots),
  ]);

  if (!lead) {
    redirect({ href: `/gyms/${run.gymId}/run?err=fainted_lead`, locale });
    return;
  }

  const energyCost = gymBattleEnergyCost(opponent.kind);
  const currentEnergy = getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt);
  if (currentEnergy < energyCost) {
    redirect({ href: `/gyms/${run.gymId}/run?err=no_energy`, locale });
    return;
  }

  const firstMon = opponent.team[0];
  if (!firstMon) {
    redirect({ href: `/gyms/${run.gymId}/run?err=no_opponent`, locale });
    return;
  }

  const wildMaxHp = calculateMaxHp(
    (await prisma.species.findUniqueOrThrow({ where: { id: firstMon.speciesId } })).baseHp,
    firstMon.level,
  );
  const wildMoveIds = await getMovesetForLevel(firstMon.speciesId, firstMon.level);
  const wildMoves = await prisma.move.findMany({ where: { id: { in: wildMoveIds } } });
  const wildMovePp = wildMoveIds.map((id) => wildMoves.find((m) => m.id === id)?.pp ?? 20);
  const opponentSpecies = await prisma.species.findUniqueOrThrow({ where: { id: firstMon.speciesId } });

  const introLog =
    opponent.kind === "trainer"
      ? [`challengeTrainer:${opponent.trainerName}`, `sendOut:${opponentSpecies.name}`]
      : [`challengeLeader:${run.gym.leaderName}:${run.gym.name}`, `sendOut:${opponentSpecies.name}`];

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        energy: currentEnergy - energyCost,
        energyUpdatedAt: new Date(),
      },
    }),
    prisma.battleSession.create({
      data: {
        userId,
        pokemonInstanceId: lead.id,
        gymId: run.gymId,
        gymRunId: run.id,
        gymTrainerId: opponent.trainerId,
        gymPokemonSlot: firstMon.slot,
        wildSpeciesId: firstMon.speciesId,
        wildLevel: firstMon.level,
        wildCurrentHp: wildMaxHp,
        wildMaxHp,
        wildMoveIds,
        wildMovePp,
        log: introLog,
        participantIds: [lead.id],
        turnDeadlineAt: nextTurnDeadline(),
      },
    }),
  ]);

  // Actualiza la energía del navbar apenas arranca el combate.
  revalidateCombatUi(locale);
  redirect({ href: "/battle", locale });
}
