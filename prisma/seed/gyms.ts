import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../src/lib/prisma";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Gimnasios por región — un JSON por liga en data/gyms/<regionId>.json.
// Los entrenadores subordinados son genéricos (inventados). Upsert por
// (regionId, order) para poder sembrar Johto sin pisar Kanto.

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

const GYMS_DIR = path.join(__dirname, "data", "gyms");

async function loadRegionGymFiles(): Promise<Array<{ regionId: string; gyms: GymJson[] }>> {
  const entries = await readdir(GYMS_DIR);
  const packs: Array<{ regionId: string; gyms: GymJson[] }> = [];
  for (const file of entries) {
    if (!file.endsWith(".json")) continue;
    const regionId = file.replace(/\.json$/, "");
    const raw = await readFile(path.join(GYMS_DIR, file), "utf8");
    packs.push({ regionId, gyms: JSON.parse(raw) as GymJson[] });
  }
  return packs.sort((a, b) => a.regionId.localeCompare(b.regionId));
}

export async function seedGyms() {
  console.log("→ Gimnasios...");
  const packs = await loadRegionGymFiles();
  for (const { regionId, gyms } of packs) {
    console.log(`  región ${regionId} (${gyms.length} nodos)`);
    for (const gymData of gyms) {
      const gym = await prisma.gym.upsert({
        where: {
          regionId_order: { regionId, order: gymData.order },
        },
        create: {
          regionId,
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
}
