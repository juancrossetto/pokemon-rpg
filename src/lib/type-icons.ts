import { showdownSpritesBase } from "@/lib/showdown-sprites";

// Material Symbols usado para representar cada tipo — medallas de gimnasio,
// badges de tipo con ícono. Ver src/lib/type-colors.ts para el color a juego.
export const TYPE_ICONS: Record<string, string> = {
  normal: "circle",
  fire: "local_fire_department",
  water: "water_drop",
  electric: "bolt",
  grass: "grass",
  ice: "ac_unit",
  fighting: "sports_martial_arts",
  poison: "science",
  ground: "landscape",
  flying: "air",
  psychic: "psychiatry",
  bug: "bug_report",
  rock: "diamond",
  ghost: "nights_stay",
  dragon: "auto_awesome",
  dark: "dark_mode",
  steel: "shield",
  fairy: "star",
};

export function typeIcon(type: string): string {
  return TYPE_ICONS[type] ?? "help";
}

/** Badge de tipo con texto de Showdown (`sprites/types/Water.png`). */
export function showdownTypeBadgeUrl(type: string): string {
  const name = type.trim().toLowerCase();
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return `${showdownSpritesBase()}/types/${capitalized}.png`;
}

/** Solo el símbolo del tipo, sin texto (`sprites/typeicons/Water.png`). */
export function showdownTypeSymbolUrl(type: string): string {
  const name = type.trim().toLowerCase();
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return `${showdownSpritesBase()}/typeicons/${capitalized}.png`;
}

/** Ícono de categoría de movimiento (`sprites/categories/Physical.png`). */
export function showdownCategoryIconUrl(
  category: "PHYSICAL" | "SPECIAL" | "STATUS",
): string {
  const name =
    category === "PHYSICAL" ? "Physical" : category === "SPECIAL" ? "Special" : "Status";
  return `${showdownSpritesBase()}/categories/${name}.png`;
}
