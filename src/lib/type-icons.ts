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
