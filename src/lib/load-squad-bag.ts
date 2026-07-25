import { prisma } from "@/lib/prisma";
import {
  HEAL_BERRIES,
  PP_RESTORE_ITEMS,
  type SquadBagCounts,
} from "@/lib/squad-bag";

const PP_NAMES = PP_RESTORE_ITEMS.map((i) => i.name);

/** Totales de consumibles del menú contextual (equipo / PC). Sólo server. */
export async function loadSquadBagCounts(userId: string): Promise<SquadBagCounts> {
  const rows = await prisma.inventoryItem.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
      OR: [
        { item: { type: "POTION", healAmount: { not: null } } },
        {
          item: {
            name: { in: [...HEAL_BERRIES, ...PP_NAMES, "Rare Candy"] },
          },
        },
      ],
    },
    include: {
      item: { select: { name: true, type: true, healAmount: true, buyPrice: true } },
    },
    orderBy: { item: { healAmount: "asc" } },
  });

  let heal = 0;
  let healItemName = "Potion";
  let healPicked = false;
  let leppa = 0;
  let ppItemName = "Ether";
  let ppPicked = false;
  let rareCandy = 0;

  const potions = rows
    .filter((r) => r.item.type === "POTION" && r.item.healAmount != null)
    .sort((a, b) => (a.item.healAmount ?? 0) - (b.item.healAmount ?? 0));

  for (const p of potions) {
    heal += p.quantity;
    if (!healPicked) {
      healItemName = p.item.name;
      healPicked = true;
    }
  }

  for (const name of HEAL_BERRIES) {
    const berry = rows.find((r) => r.item.name === name);
    if (!berry) continue;
    heal += berry.quantity;
    if (!healPicked) {
      healItemName = berry.item.name;
      healPicked = true;
    }
  }

  const ppStacks = rows
    .filter((r) => PP_NAMES.includes(r.item.name as (typeof PP_NAMES)[number]))
    .map((r) => {
      const spec = PP_RESTORE_ITEMS.find((i) => i.name === r.item.name)!;
      return { ...r, spec };
    })
    .sort((a, b) => {
      if (a.spec.allMoves !== b.spec.allMoves) return a.spec.allMoves ? 1 : -1;
      if (a.spec.amount !== b.spec.amount) return a.spec.amount - b.spec.amount;
      return a.item.buyPrice - b.item.buyPrice;
    });

  for (const s of ppStacks) {
    leppa += s.quantity;
    if (!ppPicked) {
      ppItemName = s.item.name;
      ppPicked = true;
    }
  }

  for (const r of rows) {
    if (r.item.name === "Rare Candy") rareCandy += r.quantity;
  }

  return { heal, healItemName, leppa, ppItemName, rareCandy };
}
