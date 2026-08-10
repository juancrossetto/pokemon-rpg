/**
 * Wallpapers por tipo principal para las cards del Active Squad (mobile).
 * Assets en `/public/home/squad-wallpapers/{type}.png`.
 *
 * Alias de archivos de origen:
 * - earth-card → ground
 * - sinister-card → dark
 * - normal-png → normal
 */
const SQUAD_TYPE_WALLPAPERS: Partial<Record<string, string>> = {
  normal: "/home/squad-wallpapers/normal.png",
  fire: "/home/squad-wallpapers/fire.png",
  water: "/home/squad-wallpapers/water.png",
  grass: "/home/squad-wallpapers/grass.png",
  electric: "/home/squad-wallpapers/electric.png",
  ice: "/home/squad-wallpapers/ice.png",
  fighting: "/home/squad-wallpapers/fighting.png",
  poison: "/home/squad-wallpapers/poison.png",
  ground: "/home/squad-wallpapers/ground.png",
  flying: "/home/squad-wallpapers/flying.png",
  psychic: "/home/squad-wallpapers/psychic.png",
  bug: "/home/squad-wallpapers/bug.png",
  rock: "/home/squad-wallpapers/rock.png",
  ghost: "/home/squad-wallpapers/ghost.png",
  dragon: "/home/squad-wallpapers/dragon.png",
  dark: "/home/squad-wallpapers/dark.png",
  steel: "/home/squad-wallpapers/steel.png",
  fairy: "/home/squad-wallpapers/fairy.png",
};

export function squadTypeWallpaper(type: string): string | null {
  return SQUAD_TYPE_WALLPAPERS[type.toLowerCase()] ?? null;
}
