/**
 * Partículas y fondos de batalla de Pokémon Showdown (/fx/).
 *
 * Estrategia: families sólidas por tipo + overrides de moves frecuentes /
 * icónicos. El arena coreografía stream / scatter / drain / bolt / slash.
 *
 * Por defecto apunta al CDN público. Espejo opcional:
 *   NEXT_PUBLIC_SHOWDOWN_FX_BASE=/showdown-fx
 *
 * @see https://play.pokemonshowdown.com/fx/
 */

import { drainFraction } from "@/lib/move-effects";

const DEFAULT_FX_BASE = "https://play.pokemonshowdown.com/fx";

export function showdownFxBase(): string {
  return (process.env.NEXT_PUBLIC_SHOWDOWN_FX_BASE ?? DEFAULT_FX_BASE).replace(/\/$/, "");
}

export function showdownFxUrl(file: string): string {
  return `${showdownFxBase()}/${file.replace(/^\//, "")}`;
}

export type BattleBgId =
  | "meadow"
  | "forest"
  | "route"
  | "mountain"
  | "beach"
  | "beachshore"
  | "river"
  | "deepsea"
  | "city"
  | "desert"
  | "thunderplains"
  | "dampcave"
  | "earthycave"
  | "icecave"
  | "volcanocave";

export function showdownBattleBgUrl(id: BattleBgId = "meadow"): string {
  return showdownFxUrl(`bg-${id}.png`);
}

/** Cómo dibujar el golpe en el arena. */
export type MoveFxStyle =
  | "projectile"
  | "contact"
  | "bolt"
  | "stream"
  | "scatter"
  | "drain"
  | "slash";

export type MoveFxGlow =
  | "fire"
  | "water"
  | "electric"
  | "grass"
  | "poison"
  | "psychic"
  | "ghost"
  | "ice"
  | "dragon"
  | "fairy"
  | "dark"
  | "neutral";

export type MoveFxResolved = {
  file: string;
  /** Archivos alternos para scatter/stream (si hay). */
  files?: string[];
  style: MoveFxStyle;
  /** Partículas en stream/scatter/drain (default 1). */
  count: number;
  glow?: MoveFxGlow;
};

type MoveFxDef = Omit<MoveFxResolved, "count"> & { count?: number };

export function normalizeMoveId(moveName: string | undefined | null): string {
  return (moveName ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

export function impactFxUrl(): string {
  return showdownFxUrl("impact.png");
}

function glowForType(type: string): MoveFxGlow {
  switch (type) {
    case "fire":
      return "fire";
    case "water":
      return "water";
    case "electric":
      return "electric";
    case "grass":
    case "bug":
      return "grass";
    case "poison":
      return "poison";
    case "psychic":
      return "psychic";
    case "ghost":
      return "ghost";
    case "ice":
      return "ice";
    case "dragon":
      return "dragon";
    case "fairy":
      return "fairy";
    case "dark":
      return "dark";
    default:
      return "neutral";
  }
}

/** Defaults SPECIAL por tipo — el grueso de la “calidad percibida”. */
const TYPE_SPECIAL: Record<string, MoveFxDef> = {
  fire: { file: "fireball.png", style: "stream", count: 5, glow: "fire" },
  water: { file: "waterwisp.png", style: "stream", count: 4, glow: "water" },
  ice: { file: "iceball.png", style: "stream", count: 4, glow: "ice" },
  electric: { file: "lightning.png", style: "bolt", count: 1, glow: "electric" },
  grass: {
    file: "leaf1.png",
    files: ["leaf1.png", "leaf2.png"],
    style: "scatter",
    count: 5,
    glow: "grass",
  },
  bug: {
    file: "leaf2.png",
    files: ["leaf1.png", "leaf2.png"],
    style: "scatter",
    count: 4,
    glow: "grass",
  },
  poison: { file: "poisonwisp.png", style: "stream", count: 4, glow: "poison" },
  flying: { file: "feather.png", style: "scatter", count: 5, glow: "neutral" },
  psychic: { file: "energyball.png", style: "stream", count: 4, glow: "psychic" },
  ghost: { file: "shadowball.png", style: "stream", count: 3, glow: "ghost" },
  dark: { file: "blackwisp.png", style: "stream", count: 3, glow: "dark" },
  dragon: { file: "flareball.png", style: "stream", count: 4, glow: "dragon" },
  fairy: { file: "shine.png", style: "stream", count: 4, glow: "fairy" },
  ground: { file: "mudwisp.png", style: "stream", count: 3, glow: "neutral" },
  rock: {
    file: "rock1.png",
    files: ["rock1.png", "rock2.png", "rock3.png"],
    style: "scatter",
    count: 5,
    glow: "neutral",
  },
  steel: { file: "greenmetal1.png", style: "projectile", count: 1, glow: "neutral" },
  fighting: { file: "energyball.png", style: "stream", count: 3, glow: "neutral" },
  normal: { file: "wisp.png", style: "stream", count: 3, glow: "neutral" },
};

/** Defaults PHYSICAL por tipo. */
const TYPE_PHYSICAL: Record<string, MoveFxDef> = {
  fighting: { file: "fist.png", style: "contact", count: 1, glow: "neutral" },
  normal: { file: "fist1.png", style: "contact", count: 1, glow: "neutral" },
  flying: { file: "feather.png", style: "contact", count: 1, glow: "neutral" },
  bug: { file: "leftclaw.png", style: "slash", count: 1, glow: "grass" },
  grass: { file: "leaf2.png", style: "slash", count: 1, glow: "grass" },
  rock: { file: "rock1.png", style: "contact", count: 1, glow: "neutral" },
  ground: { file: "rock1.png", style: "contact", count: 1, glow: "neutral" },
  steel: { file: "greenmetal1.png", style: "contact", count: 1, glow: "neutral" },
  poison: { file: "poisonwisp.png", style: "contact", count: 1, glow: "poison" },
  dark: { file: "blackwisp.png", style: "contact", count: 1, glow: "dark" },
  ghost: { file: "shadowball.png", style: "contact", count: 1, glow: "ghost" },
  fire: { file: "fireball.png", style: "contact", count: 1, glow: "fire" },
  water: { file: "waterwisp.png", style: "contact", count: 1, glow: "water" },
  ice: { file: "iceball.png", style: "contact", count: 1, glow: "ice" },
  electric: { file: "electroball.png", style: "contact", count: 1, glow: "electric" },
  psychic: { file: "energyball.png", style: "contact", count: 1, glow: "psychic" },
  dragon: { file: "flareball.png", style: "contact", count: 1, glow: "dragon" },
  fairy: { file: "shine.png", style: "contact", count: 1, glow: "fairy" },
};

/**
 * Overrides por nombre: top de ownership + staples de combate.
 * Lo no listado cae a TYPE_SPECIAL / TYPE_PHYSICAL.
 */
const MOVE_FX: Record<string, MoveFxDef> = {
  // —— Contacto básico (muy usados) ——
  tackle: { file: "fist1.png", style: "contact" },
  pound: { file: "fist1.png", style: "contact" },
  scratch: { file: "leftclaw.png", style: "slash" },
  "quick-attack": { file: "fist1.png", style: "contact" },
  headbutt: { file: "impact.png", style: "contact" },
  "fury-attack": { file: "fist1.png", style: "contact" },
  "double-slap": { file: "fist1.png", style: "contact" },
  wrap: { file: "web.png", style: "contact" },
  slash: { file: "leftslash.png", style: "slash" },
  "night-slash": { file: "leftslash.png", style: "slash" },
  bite: { file: "topbite.png", files: ["topbite.png", "bottombite.png"], style: "slash" },
  "crunch": { file: "topbite.png", style: "slash" },

  // —— Planta / bicho ——
  "razor-leaf": {
    file: "leaf1.png",
    files: ["leaf1.png", "leaf2.png"],
    style: "scatter",
    count: 6,
    glow: "grass",
  },
  "vine-whip": { file: "leaf2.png", style: "slash", glow: "grass" },
  "magical-leaf": {
    file: "leaf1.png",
    files: ["leaf1.png", "leaf2.png"],
    style: "scatter",
    count: 5,
    glow: "grass",
  },
  "leaf-storm": {
    file: "leaf2.png",
    files: ["leaf1.png", "leaf2.png", "petal.png"],
    style: "scatter",
    count: 7,
    glow: "grass",
  },
  "petal-blizzard": { file: "petal.png", style: "scatter", count: 6, glow: "grass" },
  "petal-dance": { file: "petal.png", style: "scatter", count: 5, glow: "grass" },
  "solar-beam": { file: "energyball.png", style: "stream", count: 5, glow: "grass" },
  "energy-ball": { file: "energyball.png", style: "projectile", glow: "grass" },
  "leech-life": { file: "wisp.png", style: "drain", count: 5, glow: "grass" },
  absorb: { file: "wisp.png", style: "drain", count: 4, glow: "grass" },
  "mega-drain": { file: "leaf1.png", style: "drain", count: 5, glow: "grass" },
  "giga-drain": {
    file: "leaf1.png",
    files: ["leaf1.png", "shine.png"],
    style: "drain",
    count: 6,
    glow: "grass",
  },
  "horn-leech": { file: "leaf1.png", style: "drain", count: 5, glow: "grass" },

  // —— Veneno (muy usado en early game) ——
  acid: { file: "poisonwisp.png", style: "stream", count: 4, glow: "poison" },
  sludge: { file: "poisonwisp.png", style: "stream", count: 4, glow: "poison" },
  "sludge-bomb": { file: "poisonwisp.png", style: "stream", count: 5, glow: "poison" },
  smog: { file: "poisonwisp.png", style: "stream", count: 3, glow: "poison" },
  "poison-sting": { file: "poisoncaltrop.png", style: "projectile", glow: "poison" },
  "poison-jab": { file: "poisonwisp.png", style: "contact", glow: "poison" },

  // —— Fuego ——
  ember: { file: "fireball.png", style: "stream", count: 3, glow: "fire" },
  flamethrower: { file: "fireball.png", style: "stream", count: 6, glow: "fire" },
  "fire-blast": { file: "flareball.png", style: "stream", count: 5, glow: "fire" },
  "flame-wheel": { file: "fireball.png", style: "contact", glow: "fire" },
  "fire-punch": { file: "fist.png", style: "contact", glow: "fire" },
  "heat-wave": { file: "fireball.png", style: "scatter", count: 5, glow: "fire" },
  incinerate: { file: "fireball.png", style: "stream", count: 4, glow: "fire" },
  lavaplume: { file: "flareball.png", style: "scatter", count: 5, glow: "fire" },
  "lava-plume": { file: "flareball.png", style: "scatter", count: 5, glow: "fire" },

  // —— Agua / hielo ——
  "water-gun": { file: "waterwisp.png", style: "stream", count: 4, glow: "water" },
  surf: { file: "waterwisp.png", style: "stream", count: 5, glow: "water" },
  "hydro-pump": { file: "waterwisp.png", style: "stream", count: 6, glow: "water" },
  "bubble-beam": { file: "waterwisp.png", style: "stream", count: 4, glow: "water" },
  bubble: { file: "waterwisp.png", style: "scatter", count: 4, glow: "water" },
  "ice-beam": { file: "iceball.png", style: "stream", count: 4, glow: "ice" },
  blizzard: {
    file: "iceball.png",
    files: ["iceball.png", "icicle.png"],
    style: "scatter",
    count: 6,
    glow: "ice",
  },
  "ice-punch": { file: "fist.png", style: "contact", glow: "ice" },
  "aurora-beam": { file: "iceball.png", style: "stream", count: 4, glow: "ice" },

  // —— Eléctrico ——
  "thunder-shock": { file: "electroball.png", style: "stream", count: 3, glow: "electric" },
  thunderbolt: { file: "lightning.png", style: "bolt", glow: "electric" },
  thunder: { file: "lightning.png", style: "bolt", glow: "electric" },
  discharge: { file: "electroball.png", style: "scatter", count: 5, glow: "electric" },
  "thunder-punch": { file: "fist.png", style: "contact", glow: "electric" },
  "volt-tackle": { file: "electroball.png", style: "contact", glow: "electric" },
  "parabolic-charge": { file: "electroball.png", style: "drain", count: 4, glow: "electric" },

  // —— Psíquico ——
  confusion: { file: "energyball.png", style: "stream", count: 3, glow: "psychic" },
  psybeam: { file: "energyball.png", style: "stream", count: 5, glow: "psychic" },
  psychic: { file: "energyball.png", style: "stream", count: 5, glow: "psychic" },
  "psyshock": { file: "energyball.png", style: "stream", count: 4, glow: "psychic" },
  "zen-headbutt": { file: "energyball.png", style: "contact", glow: "psychic" },

  // —— Fantasma / siniestro ——
  "shadow-ball": { file: "shadowball.png", style: "projectile", glow: "ghost" },
  "night-shade": { file: "shadowball.png", style: "stream", count: 3, glow: "ghost" },
  lick: { file: "shadowball.png", style: "contact", glow: "ghost" },
  "shadow-claw": { file: "leftclaw.png", style: "slash", glow: "ghost" },
  "dark-pulse": { file: "blackwisp.png", style: "stream", count: 4, glow: "dark" },
  "sucker-punch": { file: "fist1.png", style: "contact", glow: "dark" },

  // —— Volador ——
  gust: { file: "feather.png", style: "scatter", count: 5 },
  peck: { file: "feather.png", style: "contact" },
  "drill-peck": { file: "feather.png", style: "contact" },
  "wing-attack": { file: "feather.png", style: "contact" },
  "aerial-ace": { file: "feather.png", style: "slash" },
  "air-slash": { file: "leftslash.png", style: "slash" },
  "brave-bird": { file: "feather.png", style: "contact" },
  hurricane: { file: "feather.png", style: "scatter", count: 6 },

  // —— Lucha ——
  "low-kick": { file: "foot.png", style: "contact" },
  "karate-chop": { file: "leftchop.png", style: "slash" },
  "brick-break": { file: "fist.png", style: "contact" },
  "close-combat": { file: "fist.png", style: "contact" },
  "drain-punch": { file: "fist.png", style: "drain", count: 4, glow: "grass" },
  "mega-punch": { file: "fist.png", style: "contact" },
  "mega-kick": { file: "foot.png", style: "contact" },
  "high-jump-kick": { file: "foot.png", style: "contact" },
  "focus-blast": { file: "energyball.png", style: "projectile", glow: "neutral" },

  // —— Tierra / roca / acero ——
  earthquake: {
    file: "rock1.png",
    files: ["rock1.png", "rock2.png", "mudwisp.png"],
    style: "scatter",
    count: 6,
  },
  "earth-power": { file: "mudwisp.png", style: "stream", count: 4 },
  "rock-slide": {
    file: "rock1.png",
    files: ["rock1.png", "rock2.png", "rock3.png"],
    style: "scatter",
    count: 6,
  },
  "stone-edge": { file: "rock3.png", style: "slash" },
  "rock-throw": { file: "rock1.png", style: "projectile" },
  "iron-head": { file: "greenmetal1.png", style: "contact" },
  "flash-cannon": { file: "greenmetal1.png", style: "projectile" },

  // —— Dragón / hada ——
  "dragon-pulse": { file: "flareball.png", style: "stream", count: 4, glow: "dragon" },
  "dragon-claw": { file: "leftclaw.png", style: "slash", glow: "dragon" },
  "dragon-breath": { file: "flareball.png", style: "stream", count: 4, glow: "dragon" },
  "outrage": { file: "flareball.png", style: "contact", glow: "dragon" },
  "moonblast": { file: "moon.png", style: "projectile", glow: "fairy" },
  "dazzling-gleam": { file: "shine.png", style: "scatter", count: 5, glow: "fairy" },
  "draining-kiss": { file: "heart.png", style: "drain", count: 4, glow: "fairy" },

  // —— Normal especial / beam ——
  "hyper-beam": { file: "flareball.png", style: "stream", count: 5 },
  "swift": { file: "shine.png", style: "scatter", count: 5 },
  "tri-attack": {
    file: "fireball.png",
    files: ["fireball.png", "iceball.png", "electroball.png"],
    style: "stream",
    count: 3,
  },
};

function finalize(def: MoveFxDef, type: string): MoveFxResolved {
  return {
    file: def.file,
    files: def.files,
    style: def.style,
    count: def.count ?? 1,
    glow: def.glow ?? glowForType(type),
  };
}

/**
 * Qué dibujar para un golpe dañino.
 * 1) Override por nombre
 * 2) Drain moves (absorb, leech-life…) aunque no tengan override tipado
 * 3) Family SPECIAL / PHYSICAL por tipo
 */
export function resolveMoveFx(
  moveType: string,
  category: "PHYSICAL" | "SPECIAL" | "STATUS" | undefined,
  moveName?: string | null,
): MoveFxResolved {
  const type = moveType.toLowerCase();
  const id = normalizeMoveId(moveName);

  const override = id ? MOVE_FX[id] : undefined;
  if (override) return finalize(override, type);

  // Drenaje genérico si el move drena y no tenía override.
  if (id && drainFraction(id) != null) {
    const base =
      category === "PHYSICAL"
        ? (TYPE_PHYSICAL[type] ?? TYPE_PHYSICAL.normal!)
        : (TYPE_SPECIAL[type] ?? TYPE_SPECIAL.normal!);
    return finalize(
      {
        file: base.file,
        files: base.files,
        style: "drain",
        count: 5,
        glow: "grass",
      },
      type,
    );
  }

  if (category === "PHYSICAL") {
    return finalize(TYPE_PHYSICAL[type] ?? TYPE_PHYSICAL.normal!, type);
  }

  // SPECIAL / desconocido → family tipada
  return finalize(TYPE_SPECIAL[type] ?? TYPE_SPECIAL.normal!, type);
}

/** @deprecated Preferí resolveMoveFx. */
export function resolveMoveProjectile(
  moveType: string,
  category: "PHYSICAL" | "SPECIAL" | "STATUS" | undefined,
  moveName?: string | null,
): MoveFxResolved {
  return resolveMoveFx(moveType, category, moveName);
}

/** @deprecated Usar glowForType vía resolveMoveFx. */
export type MoveFxFamily = "fire" | "water" | "electric" | "grass" | "contact" | "energy";

export function moveFxFamily(moveType: string): MoveFxFamily {
  const t = moveType.toLowerCase();
  if (t === "fire") return "fire";
  if (t === "water" || t === "ice") return "water";
  if (t === "electric") return "electric";
  if (t === "grass" || t === "bug") return "grass";
  if (t === "normal" || t === "fighting" || t === "ground" || t === "rock" || t === "steel") {
    return "contact";
  }
  return "energy";
}
