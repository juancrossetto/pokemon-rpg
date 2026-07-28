/**
 * Emblemas de clan.
 *
 * Fase actual: presets PNG allowlisteados en /public/clans/emblems/.
 * Formato legacy procedural (shape/symbol/colors) se sigue parseando
 * para clanes ya creados y se muestra como fallback SVG.
 */

/** IDs de assets en `public/clans/emblems/{id}.png`. Solo allowlist. */
export const CLAN_EMBLEM_PRESET_IDS = [
  "guild-1",
  "guild-2",
  "guild-3",
  "guild-4",
  "guild-5",
  "guild-6",
  "guild-7",
  "guild-8",
  "guild-9",
  "guild-10",
  "guild-11",
  "guild-12",
  "guild-13",
  "guild-14",
  "guild-15",
  "guild-16",
  "guild-17",
  "guild-18",
  "guild-19",
  "guild-20",
  "guild-21",
  "guild-22",
  "guild-23",
] as const;

export type ClanEmblemPresetId = (typeof CLAN_EMBLEM_PRESET_IDS)[number];

export type ClanEmblemPreset = {
  kind: "preset";
  presetId: ClanEmblemPresetId;
};

/** Legacy — SVG compuesto. */
export type ClanEmblemShape =
  | "shield"
  | "hexagon"
  | "circle"
  | "diamond"
  | "banner"
  | "medallion";

export type ClanEmblemSymbol =
  | "bolt"
  | "flame"
  | "wave"
  | "leaf"
  | "mountain"
  | "wing"
  | "claw"
  | "star"
  | "crown"
  | "moon"
  | "sun"
  | "ball";

export type ClanEmblemProcedural = {
  kind?: "procedural";
  shape: ClanEmblemShape;
  border: "solid" | "double" | "ornate";
  background: "flat" | "split" | "rays";
  pattern?: "none" | "grid" | "dots";
  symbol: ClanEmblemSymbol;
  primaryColor: string;
  secondaryColor: string;
};

export type ClanEmblem = ClanEmblemPreset | ClanEmblemProcedural;

export const DEFAULT_CLAN_EMBLEM: ClanEmblemPreset = {
  kind: "preset",
  presetId: "guild-1",
};

export const EMBLEM_SHAPES: ClanEmblemShape[] = [
  "shield",
  "hexagon",
  "circle",
  "diamond",
  "banner",
  "medallion",
];

export const EMBLEM_SYMBOLS: ClanEmblemSymbol[] = [
  "bolt",
  "flame",
  "wave",
  "leaf",
  "mountain",
  "wing",
  "claw",
  "star",
  "crown",
  "moon",
  "sun",
  "ball",
];

export const EMBLEM_PALETTES: Array<{ primary: string; secondary: string }> = [
  { primary: "#ee1515", secondary: "#1a1a1a" },
  { primary: "#3b82f6", secondary: "#0b1220" },
  { primary: "#22c55e", secondary: "#0a160f" },
  { primary: "#eab308", secondary: "#1a1405" },
  { primary: "#a855f7", secondary: "#140a1c" },
  { primary: "#f97316", secondary: "#1a0e06" },
  { primary: "#14b8a6", secondary: "#061412" },
  { primary: "#f43f5e", secondary: "#1a080c" },
];

const LEGACY_DEFAULT: ClanEmblemProcedural = {
  kind: "procedural",
  shape: "shield",
  border: "solid",
  background: "flat",
  pattern: "none",
  symbol: "star",
  primaryColor: "#ee1515",
  secondaryColor: "#1a1a1a",
};

export function isClanEmblemPresetId(value: string): value is ClanEmblemPresetId {
  return (CLAN_EMBLEM_PRESET_IDS as readonly string[]).includes(value);
}

/** Ruta pública del PNG. Solo válida para IDs allowlisteados. */
export function clanEmblemPresetSrc(presetId: ClanEmblemPresetId): string {
  return `/clans/emblems/${presetId}.png`;
}

export function isPresetEmblem(emblem: ClanEmblem): emblem is ClanEmblemPreset {
  return emblem.kind === "preset";
}

export function parseClanEmblem(raw: unknown): ClanEmblem {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CLAN_EMBLEM };
  const o = raw as Record<string, unknown>;

  // Nuevo formato: { kind: "preset", presetId: "guild-1" }
  if (o.kind === "preset" || typeof o.presetId === "string") {
    const presetId = String(o.presetId ?? "");
    if (isClanEmblemPresetId(presetId)) {
      return { kind: "preset", presetId };
    }
    return { ...DEFAULT_CLAN_EMBLEM };
  }

  // Legacy procedural (clanes creados antes del pack PNG).
  return {
    kind: "procedural",
    shape: EMBLEM_SHAPES.includes(o.shape as ClanEmblemShape)
      ? (o.shape as ClanEmblemShape)
      : LEGACY_DEFAULT.shape,
    border:
      o.border === "double" || o.border === "ornate" || o.border === "solid"
        ? o.border
        : "solid",
    background:
      o.background === "split" || o.background === "rays" || o.background === "flat"
        ? o.background
        : "flat",
    pattern:
      o.pattern === "grid" || o.pattern === "dots" || o.pattern === "none"
        ? o.pattern
        : "none",
    symbol: EMBLEM_SYMBOLS.includes(o.symbol as ClanEmblemSymbol)
      ? (o.symbol as ClanEmblemSymbol)
      : LEGACY_DEFAULT.symbol,
    primaryColor:
      typeof o.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(o.primaryColor)
        ? o.primaryColor
        : LEGACY_DEFAULT.primaryColor,
    secondaryColor:
      typeof o.secondaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(o.secondaryColor)
        ? o.secondaryColor
        : LEGACY_DEFAULT.secondaryColor,
  };
}

/** Serializa solo lo que el backend acepta (presets). */
export function serializeClanEmblem(emblem: ClanEmblem): ClanEmblemPreset {
  if (isPresetEmblem(emblem) && isClanEmblemPresetId(emblem.presetId)) {
    return { kind: "preset", presetId: emblem.presetId };
  }
  return { ...DEFAULT_CLAN_EMBLEM };
}
