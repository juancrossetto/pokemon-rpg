"use server";

import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { getMovesetForLevel } from "@/lib/moveset";
import { currentGymRunOpponent } from "@/lib/gym-run";

// Arranca la batalla contra el próximo oponente de una corrida ya iniciada
// (el entrenador subordinado que sigue, o el líder si ya no quedan).
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
  if (!run) return;

  const lead = await prisma.pokemonInstance.findFirst({ where: { ownerId: userId, teamSlot: 1 } });
  if (!lead || lead.currentHp <= 0) return;

  const opponent = await currentGymRunOpponent(run.gymId, run.clearedTrainerSlots);
  const firstMon = opponent.team[0];
  if (!firstMon) return;

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

  await prisma.battleSession.create({
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
    },
  });

  redirect({ href: "/battle", locale });
}
