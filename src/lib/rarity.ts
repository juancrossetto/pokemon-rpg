// Rareza y sus estilos. Viven acá y no en market-hub.ts porque ese módulo
// importa `prisma` para sus consultas, y arrastrarlo desde un client component
// mete `pg` en el bundle del browser (rompe el build pidiendo `dns`/`fs`).
// Esto es presentación pura, sin acceso a datos, así que lo puede usar tanto
// el servidor (mercado) como el cliente (inventario).

import type { DexRarity } from "@/lib/pokedex";

export type MarketRarity = "common" | "rare" | "epic" | "legendary";

/** La ficha de inventario solo tiene 4 peldaños; la Pokédex tiene más. */
export function marketRarityFromDex(rarity: DexRarity | undefined): MarketRarity {
  if (rarity === "common") return "common";
  if (rarity === "rare") return "rare";
  if (rarity === "epic") return "epic";
  if (
    rarity === "legendary" ||
    rarity === "mythical" ||
    rarity === "ultraBeast" ||
    rarity === "paradox"
  ) {
    return "legendary";
  }
  return "rare";
}

export const RARITY_STYLES: Record<
  MarketRarity,
  { border: string; text: string; glow: string; stars: number }
> = {
  common: {
    border: "border-white/20",
    text: "text-on-surface-variant",
    glow: "rgba(255,255,255,0.08)",
    stars: 1,
  },
  rare: {
    border: "border-sky-400/45",
    text: "text-sky-300",
    glow: "rgba(56,189,248,0.18)",
    stars: 2,
  },
  epic: {
    border: "border-violet-400/50",
    text: "text-violet-300",
    glow: "rgba(167,139,250,0.22)",
    stars: 3,
  },
  legendary: {
    border: "border-electric-yellow/55",
    text: "text-electric-yellow",
    glow: "rgba(242,192,0,0.28)",
    stars: 5,
  },
};

export function itemRarity(item: {
  name: string;
  type: string;
  buyPrice: number;
  dexRarity?: DexRarity;
}): MarketRarity {
  if (item.type === "FRAGMENT") return marketRarityFromDex(item.dexRarity);
  const name = item.name.toLowerCase();
  if (name.includes("master") || name.includes("full restore")) return "legendary";
  if (item.type === "EVOLUTION_STONE" || item.buyPrice >= 2000) return "epic";
  if (item.buyPrice >= 600) return "rare";
  return "common";
}

export function pokemonRarity(input: {
  isShiny: boolean;
  level: number;
  invested: number;
}): MarketRarity {
  if (input.isShiny) return "legendary";
  if (input.level >= 50 || input.invested >= 40) return "epic";
  if (input.level >= 25 || input.invested >= 15) return "rare";
  return "common";
}

/** % de entrenamiento aproximado (no hay IVs en el esquema). */
export function trainingPercent(invested: number, level: number): number {
  const expected = Math.max(1, (level - 1) * 3);
  return Math.min(100, Math.round((invested / expected) * 100));
}
