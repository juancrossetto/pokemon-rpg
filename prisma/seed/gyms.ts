import { prisma } from "../../src/lib/prisma";
import gymsData from "./data/gyms.json";

// 8 gimnasios secuenciales de Kanto (Rojo/Azul) — líder y equipo real según
// Bulbapedia. Los entrenadores subordinados son genéricos (inventados, no
// personajes con nombre propio de los juegos oficiales) — no hay ninguna API
// con esa info porque no existe fuera de nuestro propio diseño. Los datos en
// sí viven en data/gyms.json (no acá) para poder editarlos sin tocar código.
interface GymJson {
  order: number;
  gym: string;
  leader: string;
  badgeName: string;
  type: string;
  coinReward: number;
  isElite?: boolean;
  trainers: { name: string; pokemon: { name: string; level: number }[] }[];
  pokemon: { name: string; level: number }[];
}

export async function seedGyms() {
  console.log("→ Gimnasios...");
  for (const gymData of gymsData as GymJson[]) {
    const gym = await prisma.gym.upsert({
      where: { order: gymData.order },
      create: {
        order: gymData.order,
        name: gymData.gym,
        leaderName: gymData.leader,
        badgeName: gymData.badgeName,
        type: gymData.type,
        coinReward: gymData.coinReward,
        isElite: gymData.isElite ?? false,
      },
      update: {
        name: gymData.gym,
        leaderName: gymData.leader,
        badgeName: gymData.badgeName,
        type: gymData.type,
        coinReward: gymData.coinReward,
        isElite: gymData.isElite ?? false,
      },
    });

    for (let i = 0; i < gymData.pokemon.length; i++) {
      const member = gymData.pokemon[i];
      const slot = i + 1;
      const species = await prisma.species.findUniqueOrThrow({ where: { name: member.name } });
      await prisma.gymPokemon.upsert({
        where: { gymId_slot: { gymId: gym.id, slot } },
        create: { gymId: gym.id, slot, speciesId: species.id, level: member.level },
        update: { speciesId: species.id, level: member.level },
      });
    }

    for (let i = 0; i < gymData.trainers.length; i++) {
      const trainerData = gymData.trainers[i];
      const trainerSlot = i + 1;
      const trainer = await prisma.gymTrainer.upsert({
        where: { gymId_slot: { gymId: gym.id, slot: trainerSlot } },
        create: { gymId: gym.id, slot: trainerSlot, name: trainerData.name },
        update: { name: trainerData.name },
      });

      for (let j = 0; j < trainerData.pokemon.length; j++) {
        const member = trainerData.pokemon[j];
        const slot = j + 1;
        const species = await prisma.species.findUniqueOrThrow({ where: { name: member.name } });
        await prisma.gymTrainerPokemon.upsert({
          where: { gymTrainerId_slot: { gymTrainerId: trainer.id, slot } },
          create: { gymTrainerId: trainer.id, slot, speciesId: species.id, level: member.level },
          update: { speciesId: species.id, level: member.level },
        });
      }
    }
  }
}
