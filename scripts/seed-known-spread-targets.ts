import { prisma } from "../src/lib/prisma";

async function main() {
  const foes = [
    "rock-slide",
    "razor-leaf",
    "growl",
    "tail-whip",
    "string-shot",
    "sweet-scent",
    "snarl",
    "glaciate",
  ];
  const all = [
    "earthquake",
    "surf",
    "discharge",
    "lava-plume",
    "teeter-dance",
    "brutal-swing",
    "petal-blizzard",
    "sludge-wave",
    "bulldoze",
    "explosion",
    "self-destruct",
    "magnitude",
    "boomburst",
  ];
  const a = await prisma.move.updateMany({
    where: { name: { in: foes } },
    data: { target: "all-opponents" },
  });
  const b = await prisma.move.updateMany({
    where: { name: { in: all } },
    data: { target: "all-other-pokemon" },
  });
  console.log({ foesUpdated: a.count, allUpdated: b.count });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
