import { prisma } from "../../src/lib/prisma";
import type { HeldEffect } from "../../src/generated/prisma/client";

// Set real curado de objetos equipables (Gen III+, verificado contra las
// categorías reales de PokeAPI: choice/held-items/type-enhancement/in-a-pinch).
// heldValue es genérico: multiplicador (Choice/Life Orb/Eviolite/tipo),
// fracción de HP máx (Leftovers/Sitrus) o probabilidad (King's Rock/Quick Claw).
const HELD_ITEMS: {
  name: string;
  effect: HeldEffect;
  value: number;
  stat?: "atk" | "spAtk" | "speed";
  boostType?: string;
  buyPrice: number;
  gemPrice?: number;
  effectText: string;
}[] = [
  {
    name: "Leftovers",
    effect: "LEFTOVERS",
    value: 1 / 16,
    buyPrice: 4000,
    effectText: "Restaura 1/16 del HP máximo al final de cada turno propio.",
  },
  {
    name: "Choice Band",
    effect: "CHOICE_LOCK",
    value: 1.5,
    stat: "atk",
    buyPrice: 3500,
    effectText: "×1.5 de Ataque, pero solo se puede usar el primer movimiento elegido.",
  },
  {
    name: "Choice Specs",
    effect: "CHOICE_LOCK",
    value: 1.5,
    stat: "spAtk",
    buyPrice: 3500,
    effectText: "×1.5 de Ataque Especial, pero solo se puede usar el primer movimiento elegido.",
  },
  {
    name: "Choice Scarf",
    effect: "CHOICE_LOCK",
    value: 1.5,
    stat: "speed",
    buyPrice: 3500,
    effectText: "×1.5 de Velocidad, pero solo se puede usar el primer movimiento elegido.",
  },
  {
    name: "Life Orb",
    effect: "LIFE_ORB",
    value: 0.3,
    buyPrice: 4500,
    effectText: "+30% de poder en movimientos que dañan, con 10% de retroceso del HP máximo.",
  },
  {
    name: "Focus Sash",
    effect: "FOCUS_SASH",
    value: 0,
    buyPrice: 3000,
    effectText: "Si tiene el HP máximo, sobrevive con 1 HP a un golpe que lo dejaría K.O. Un solo uso.",
  },
  {
    name: "Eviolite",
    effect: "EVIOLITE",
    value: 0.5,
    buyPrice: 3000,
    effectText: "+50% de Defensa y Defensa Especial si la especie todavía puede evolucionar.",
  },
  {
    name: "King's Rock",
    effect: "FLINCH_CHANCE",
    value: 0.1,
    // Gemas: también es objeto evolutivo (Politoed / Slowking). Sin monedas
    // para no duplicar sink — la tienda lo lista por gemPrice.
    buyPrice: 0,
    gemPrice: 7,
    effectText:
      "Evoluciona a Poliwhirl y Slowpoke. En combate: 10% de flinch tras un golpe.",
  },
  {
    name: "Quick Claw",
    effect: "QUICK_CLAW",
    value: 0.2,
    buyPrice: 2500,
    effectText: "20% de probabilidad de actuar primero, sin importar la Velocidad.",
  },
  {
    name: "Sitrus Berry",
    effect: "SITRUS_BERRY",
    value: 0.25,
    buyPrice: 400,
    effectText: "Al caer al 50% de HP o menos, restaura 25% del HP máximo. Se consume al usarse.",
  },
  {
    name: "Lum Berry",
    effect: "LUM_BERRY",
    value: 0,
    buyPrice: 500,
    effectText: "Cura cualquier alteración de estado apenas se aplica. Se consume al usarse.",
  },
  {
    name: "Charcoal",
    effect: "TYPE_BOOST",
    value: 0.2,
    boostType: "fire",
    buyPrice: 2000,
    effectText: "+20% de poder en movimientos de tipo Fuego.",
  },
  {
    name: "Mystic Water",
    effect: "TYPE_BOOST",
    value: 0.2,
    boostType: "water",
    buyPrice: 2000,
    effectText: "+20% de poder en movimientos de tipo Agua.",
  },
  {
    name: "Miracle Seed",
    effect: "TYPE_BOOST",
    value: 0.2,
    boostType: "grass",
    buyPrice: 2000,
    effectText: "+20% de poder en movimientos de tipo Planta.",
  },
  {
    name: "Magnet",
    effect: "TYPE_BOOST",
    value: 0.2,
    boostType: "electric",
    buyPrice: 2000,
    effectText: "+20% de poder en movimientos de tipo Eléctrico.",
  },
  {
    name: "Exp. Share",
    effect: "EXP_SHARE",
    // Misma fracción que la banca participante (BENCH_XP_SHARE): el mon que
    // no pelea cobra la mitad de la EXP de la victoria.
    value: 0.5,
    buyPrice: 0,
    effectText:
      "Si lo lleva un Pokémon del equipo que no pelea, recibe la mitad de la EXP de la victoria.",
  },
];

export async function seedHeldItems() {
  console.log(`→ Objetos equipables (${HELD_ITEMS.length})...`);
  for (const item of HELD_ITEMS) {
    const isBerry = item.effect === "SITRUS_BERRY" || item.effect === "LUM_BERRY";
    await prisma.item.upsert({
      where: { name: item.name },
      create: {
        name: item.name,
        type: isBerry ? "BERRY" : "HELD",
        buyPrice: item.buyPrice,
        gemPrice: item.gemPrice ?? null,
        effectText: item.effectText,
        heldEffect: item.effect,
        heldValue: item.value,
        heldStat: item.stat ?? null,
        heldBoostType: item.boostType ?? null,
      },
      update: {
        buyPrice: item.buyPrice,
        gemPrice: item.gemPrice ?? null,
        effectText: item.effectText,
        heldEffect: item.effect,
        heldValue: item.value,
        heldStat: item.stat ?? null,
        heldBoostType: item.boostType ?? null,
      },
    });
  }
}
