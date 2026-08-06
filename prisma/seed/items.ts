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
  { name: "Hyper Potion", buyPrice: 1500, healAmount: 200 },
  { name: "Max Potion", buyPrice: 2500, healAmount: 9999 },
  { name: "Full Restore", buyPrice: 3000, healAmount: 9999 },
] as const;

// Potas de PP (healAmount null: no entran en curación de HP).
const PP_POTIONS = [
  { name: "Ether", buyPrice: 1200, effectText: "Restaura 10 PP de un movimiento." },
  { name: "Max Ether", buyPrice: 2000, effectText: "Restaura todos los PP de un movimiento." },
  { name: "Elixir", buyPrice: 3000, effectText: "Restaura 10 PP de todos los movimientos." },
  { name: "Max Elixir", buyPrice: 4500, effectText: "Restaura todos los PP de todos los movimientos." },
] as const;

/*
  Revivir: fuera de combate, sólo si currentHp <= 0.
  Precios en monedas (ver análisis economía): utility crítica pero consumible.
  Sin gemas — las gemas quedan para destinos permanentes (Cordón) / skips.
*/
const REVIVES = [
  {
    name: "Revive",
    buyPrice: 1600,
    effectText: "Reanima a un Pokémon debilitado con la mitad de sus PS.",
  },
  {
    name: "Max Revive",
    buyPrice: 3800,
    effectText: "Reanima a un Pokémon debilitado con todos sus PS.",
  },
] as const;

// Bayas comerciables (dossier: consumibles del mercado). Por ahora son
// catálogo + efecto descriptivo; el uso en batalla se suma después.
const BERRIES = [
  { name: "Oran Berry", buyPrice: 150, effectText: "Restaura 10 HP." },
  { name: "Sitrus Berry", buyPrice: 400, effectText: "Restaura 30 HP." },
  { name: "Leppa Berry", buyPrice: 250, effectText: "Restaura 10 PP de un movimiento." },
  { name: "Rare Candy", buyPrice: 4800, effectText: "Sube 1 nivel al Pokémon." },
] as const;

// Piedras de evolución comerciables. El flujo de evolución se suma después;
// sin estos ítems el mercado no cubría el catálogo del dossier.
const EVOLUTION_STONES = [
  { name: "Fire Stone", buyPrice: 2100, effectText: "Evoluciona ciertas especies de tipo Fuego." },
  { name: "Water Stone", buyPrice: 2100, effectText: "Evoluciona ciertas especies de tipo Agua." },
  { name: "Thunder Stone", buyPrice: 2100, effectText: "Evoluciona ciertas especies de tipo Eléctrico." },
  { name: "Leaf Stone", buyPrice: 2100, effectText: "Evoluciona ciertas especies de tipo Planta." },
  { name: "Moon Stone", buyPrice: 2100, effectText: "Evoluciona ciertas especies (p. ej. Clefairy)." },
] as const;

/**
 * Cordón Unión: reemplaza al intercambio.
 *
 * En Kanto hay cuatro especies que en los juegos evolucionan solo por
 * intercambio (Kadabra, Machoke, Graveler, Haunter). Sin sistema de trueque
 * quedaban inalcanzables, así que se resuelve como lo hizo la propia saga en
 * Escarlata/Púrpura: un objeto que dispara esa evolución.
 *
 * Es el único ítem que se paga con gemas: son cuatro de los Pokémon más
 * fuertes de la región y la moneda premium necesitaba un destino real —hasta
 * ahora el contador del header siempre marcaba cero.
 *
 * Lleva `type: EVOLUTION_STONE` a propósito, aunque no sea una piedra: es el
 * tipo por el que filtra `loadOwnedEvolutionItems`, así que entra solo en la
 * lista de objetos de evolución disponibles.
 */
const LINKING_CORD = {
  name: "Linking Cord",
  buyPrice: 0,
  gemPrice: 8,
  effectText: "Evoluciona a las especies que normalmente requieren intercambio.",
} as const;

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

  console.log("→ Objetos (Potas de PP)...");
  for (const potion of PP_POTIONS) {
    await prisma.item.upsert({
      where: { name: potion.name },
      create: {
        name: potion.name,
        type: "POTION",
        buyPrice: potion.buyPrice,
        effectText: potion.effectText,
        healAmount: null,
      },
      update: {
        buyPrice: potion.buyPrice,
        effectText: potion.effectText,
        healAmount: null,
      },
    });
  }

  console.log("→ Objetos (Revivir)...");
  for (const revive of REVIVES) {
    await prisma.item.upsert({
      where: { name: revive.name },
      create: {
        name: revive.name,
        type: "POTION",
        buyPrice: revive.buyPrice,
        effectText: revive.effectText,
        healAmount: null,
      },
      update: {
        buyPrice: revive.buyPrice,
        effectText: revive.effectText,
        healAmount: null,
      },
    });
  }

  console.log("→ Objetos (Bayas)...");
  for (const berry of BERRIES) {
    await prisma.item.upsert({
      where: { name: berry.name },
      create: {
        name: berry.name,
        type: "BERRY",
        buyPrice: berry.buyPrice,
        effectText: berry.effectText,
      },
      update: { buyPrice: berry.buyPrice, effectText: berry.effectText },
    });
  }

  console.log("→ Objeto (Cordón Unión)...");
  await prisma.item.upsert({
    where: { name: LINKING_CORD.name },
    create: {
      name: LINKING_CORD.name,
      type: "EVOLUTION_STONE",
      buyPrice: LINKING_CORD.buyPrice,
      gemPrice: LINKING_CORD.gemPrice,
      effectText: LINKING_CORD.effectText,
    },
    update: {
      buyPrice: LINKING_CORD.buyPrice,
      gemPrice: LINKING_CORD.gemPrice,
      effectText: LINKING_CORD.effectText,
    },
  });

  console.log("→ Objetos (Piedras de evolución)...");
  for (const stone of EVOLUTION_STONES) {
    await prisma.item.upsert({
      where: { name: stone.name },
      create: {
        name: stone.name,
        type: "EVOLUTION_STONE",
        buyPrice: stone.buyPrice,
        effectText: stone.effectText,
      },
      update: { buyPrice: stone.buyPrice, effectText: stone.effectText },
    });
  }
}
