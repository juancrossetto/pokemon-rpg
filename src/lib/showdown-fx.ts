/**
 * Partículas y fondos de batalla de Pokémon Showdown (/fx/).
 *
 * Por defecto apunta al CDN público. Espejo opcional:
 *   NEXT_PUBLIC_SHOWDOWN_FX_BASE=/showdown-fx
 *
 * @see https://play.pokemonshowdown.com/fx/
 */

const DEFAULT_FX_BASE = "https://play.pokemonshowdown.com/fx";

export function showdownFxBase(): string {
  return (process.env.NEXT_PUBLIC_SHOWDOWN_FX_BASE ?? DEFAULT_FX_BASE).replace(/\/$/, "");
}

export function showdownFxUrl(file: string): string {
  return `${showdownFxBase()}/${file.replace(/^\//, "")}`;
}

export type BattleBgId = "meadow" | "forest" | "route" | "mountain";

export function showdownBattleBgUrl(id: BattleBgId = "meadow"): string {
  return showdownFxUrl(`bg-${id}.png`);
}

export type MoveFxFamily = "fire" | "water" | "electric" | "grass" | "contact" | "energy";

const TYPE_FAMILY: Record<string, MoveFxFamily> = {
  fire: "fire",
  water: "water",
  ice: "water",
  electric: "electric",
  grass: "grass",
  bug: "grass",
  normal: "contact",
  fighting: "contact",
  ground: "contact",
  rock: "contact",
  steel: "contact",
  psychic: "energy",
  ghost: "energy",
  dark: "energy",
  dragon: "energy",
  fairy: "energy",
  poison: "energy",
  flying: "energy",
};

/** Partícula Showdown por tipo (proyectil SPECIAL). */
const TYPE_PROJECTILE: Record<string, string> = {
  fire: "fireball.png",
  water: "waterwisp.png",
  ice: "iceball.png",
  electric: "electroball.png",
  grass: "leaf1.png",
  bug: "leaf2.png",
  poison: "poisonwisp.png",
  ground: "mudwisp.png",
  rock: "rock1.png",
  flying: "feather.png",
  psychic: "energyball.png",
  ghost: "shadowball.png",
  dark: "blackwisp.png",
  dragon: "flareball.png",
  steel: "greenmetal1.png",
  fairy: "shine.png",
  fighting: "fist.png",
  normal: "wisp.png",
};

const FAMILY_PROJECTILE: Record<MoveFxFamily, string> = {
  fire: "fireball.png",
  water: "waterwisp.png",
  electric: "lightning.png",
  grass: "leaf1.png",
  contact: "fist.png",
  energy: "energyball.png",
};

export function moveFxFamily(moveType: string): MoveFxFamily {
  return TYPE_FAMILY[moveType.toLowerCase()] ?? "energy";
}

export function impactFxUrl(): string {
  return showdownFxUrl("impact.png");
}

/**
 * Qué dibujar para un golpe dañino.
 * PHYSICAL → contacto (fist/impact cerca del defensor).
 * SPECIAL → proyectil tipado que viaja.
 */
export function resolveMoveProjectile(
  moveType: string,
  category: "PHYSICAL" | "SPECIAL" | "STATUS" | undefined,
): { file: string; style: "projectile" | "contact" | "bolt" } {
  const type = moveType.toLowerCase();
  const family = moveFxFamily(type);

  if (category === "PHYSICAL" || family === "contact") {
    if (type === "fighting") return { file: "fist.png", style: "contact" };
    if (type === "rock" || type === "ground") return { file: "rock1.png", style: "contact" };
    return { file: "fist1.png", style: "contact" };
  }

  if (type === "electric") {
    return { file: "lightning.png", style: "bolt" };
  }

  const file = TYPE_PROJECTILE[type] ?? FAMILY_PROJECTILE[family];
  return { file, style: "projectile" };
}
