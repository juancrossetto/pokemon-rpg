import { prisma } from "../../src/lib/prisma";

// Multiplicadores reales de los juegos clásicos (Gen III+). Master Ball usa
// un valor altísimo para que la fórmula de captura dé siempre "atrapado" en
// vez de tener un caso especial separado.
const POKEBALLS = [
  { name: "Poke Ball", buyPrice: 200, catchMultiplier: 1 },
  { name: "Great Ball", buyPrice: 600, catchMultiplier: 1.5 },
  { name: "Ultra Ball", buyPrice: 1200, catchMultiplier: 2 },
  { name: "Master Ball", buyPrice: 0, catchMultiplier: 255 },
] as const;

// Cantidades reales de los juegos clásicos. Full Restore usa un valor
// altísimo para que la curación quede siempre acotada al HP máximo del
// Pokémon (mismo patrón que Master Ball con catchMultiplier).
const POTIONS = [
  { name: "Potion", buyPrice: 300, healAmount: 20 },
  { name: "Super Potion", buyPrice: 700, healAmount: 50 },
  { name: "Full Restore", buyPrice: 3000, healAmount: 9999 },
] as const;

export async function seedItems() {
  console.log("→ Objetos (Poké Balls)...");
  for (const ball of POKEBALLS) {
    await prisma.item.upsert({
      where: { name: ball.name },
      create: {
        name: ball.name,
        type: "POKEBALL",
        buyPrice: ball.buyPrice,
        catchMultiplier: ball.catchMultiplier,
      },
      update: { buyPrice: ball.buyPrice, catchMultiplier: ball.catchMultiplier },
    });
  }

  console.log("→ Objetos (Pociones)...");
  for (const potion of POTIONS) {
    await prisma.item.upsert({
      where: { name: potion.name },
      create: {
        name: potion.name,
        type: "POTION",
        buyPrice: potion.buyPrice,
        healAmount: potion.healAmount,
      },
      update: { buyPrice: potion.buyPrice, healAmount: potion.healAmount },
    });
  }
}
