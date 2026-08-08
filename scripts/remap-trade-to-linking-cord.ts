/**
 * Remap / seed de objetos evolutivos (Wikidex → use-item + gemas).
 *
 * Uso: `npx tsx scripts/remap-trade-to-linking-cord.ts`
 */
import { prisma } from "../src/lib/prisma";
import {
  EXTRA_EVOLUTION_STONES,
  GEM_EVOLUTION_ITEMS,
} from "../src/lib/evolution-items";
import { remapEvolutionItemsFromCatalog } from "../prisma/seed/items";

async function seedGemEvolutionItems() {
  for (const item of GEM_EVOLUTION_ITEMS) {
    if (item.skipCreate) {
      await prisma.item.updateMany({
        where: { name: item.name },
        data: {
          buyPrice: 0,
          gemPrice: item.gemPrice,
          effectText: item.effectText,
        },
      });
      continue;
    }
    await prisma.item.upsert({
      where: { name: item.name },
      create: {
        name: item.name,
        type: "EVOLUTION_STONE",
        buyPrice: 0,
        gemPrice: item.gemPrice,
        effectText: item.effectText,
      },
      update: {
        buyPrice: 0,
        gemPrice: item.gemPrice,
        effectText: item.effectText,
        type: "EVOLUTION_STONE",
      },
    });
  }

  for (const stone of EXTRA_EVOLUTION_STONES) {
    await prisma.item.upsert({
      where: { name: stone.name },
      create: {
        name: stone.name,
        type: "EVOLUTION_STONE",
        buyPrice: stone.buyPrice,
        effectText: stone.effectText,
      },
      update: {
        buyPrice: stone.buyPrice,
        effectText: stone.effectText,
      },
    });
  }
}

async function main() {
  console.log("→ Sembrando objetos evolutivos (gemas + piedras extra)...");
  await seedGemEvolutionItems();

  const remapped = await remapEvolutionItemsFromCatalog();
  console.log(`→ Remapeadas ${remapped} especies.`);

  const sample = await prisma.species.findMany({
    where: {
      id: { in: [65, 94, 186, 208, 212, 230, 233] },
    },
    select: { id: true, name: true, evolveTrigger: true, evolveItem: true },
    orderBy: { id: "asc" },
  });
  console.table(sample);

  const gems = await prisma.item.findMany({
    where: { gemPrice: { gt: 0 } },
    select: { name: true, type: true, gemPrice: true, buyPrice: true },
    orderBy: { gemPrice: "desc" },
  });
  console.table(gems);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
