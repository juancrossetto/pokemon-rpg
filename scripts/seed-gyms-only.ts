import { seedGyms } from "../prisma/seed/gyms";
import { prisma } from "../src/lib/prisma";

/** Solo re-siembra gimnasios desde JSON (sin tocar especies/items). */
async function main() {
  await seedGyms();
  const sample = await prisma.gym.findMany({
    where: { isElite: false },
    select: {
      regionId: true,
      order: true,
      name: true,
      trainers: {
        select: { team: { select: { id: true } } },
        orderBy: { slot: "asc" },
      },
      team: { select: { id: true } },
    },
    orderBy: [{ regionId: "asc" }, { order: "asc" }],
  });
  for (const g of sample) {
    const parties = g.trainers.map((t) => t.team.length).join(",");
    console.log(
      g.regionId,
      g.order,
      g.name,
      "trainers",
      g.trainers.length,
      "[" + parties + "]",
      "leader",
      g.team.length,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
