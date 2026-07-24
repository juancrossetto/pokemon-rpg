import { prisma } from "@/lib/prisma";

// Determina contra quién se pelea a continuación en una corrida de gimnasio:
// el próximo entrenador subordinado sin vencer, o el líder si ya no quedan.
export async function currentGymRunOpponent(gymId: string, clearedTrainerSlots: number) {
  const nextTrainer = await prisma.gymTrainer.findUnique({
    where: { gymId_slot: { gymId, slot: clearedTrainerSlots + 1 } },
    include: { team: { orderBy: { slot: "asc" } } },
  });
  if (nextTrainer) {
    return {
      kind: "trainer" as const,
      trainerId: nextTrainer.id,
      trainerName: nextTrainer.name,
      team: nextTrainer.team,
    };
  }

  const leaderTeam = await prisma.gymPokemon.findMany({ where: { gymId }, orderBy: { slot: "asc" } });
  return { kind: "leader" as const, trainerId: null, trainerName: null, team: leaderTeam };
}
