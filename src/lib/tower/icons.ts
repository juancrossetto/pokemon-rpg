import { showdownTrainerSpriteUrl } from "@/lib/avatars";
import type { TowerFloor, TowerFloorType } from "./types";

/** Sprites estáticos PokeAPI (GitHub) — ya whitelisted en next.config. */
export function pokeApiSpriteUrl(speciesId: number, kind: "icon" | "artwork" = "icon"): string {
  if (kind === "artwork") {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${speciesId}.png`;
}

/** Trainers de Showdown para guardianes (no son líderes de gimnasio de Aventura). */
const GUARDIAN_TRAINER_SLUGS = [
  "cynthia",
  "steven",
  "lance",
  "red",
  "blue",
  "wallace",
] as const;

export function towerGuardianTrainerUrl(floorNumber: number): string {
  const idx = Math.max(0, Math.floor(floorNumber / 10) - 1) % GUARDIAN_TRAINER_SLUGS.length;
  return showdownTrainerSpriteUrl(GUARDIAN_TRAINER_SLUGS[idx]!);
}

export type TowerFloorNodeVisual =
  | { kind: "pokemon"; src: string; speciesId: number }
  | { kind: "trainer"; src: string }
  | { kind: "glyph"; icon: string };

/** Qué mostrar en el nodo del riel según tipo de piso. */
export function floorNodeVisual(floor: TowerFloor): TowerFloorNodeVisual {
  if (floor.type === "rest") {
    // Jigglypuff (#39): descanso = canción / brillos, no cama genérica.
    return {
      kind: "pokemon",
      src: pokeApiSpriteUrl(39, "icon"),
      speciesId: 39,
    };
  }
  if (floor.type === "boss") {
    return { kind: "trainer", src: towerGuardianTrainerUrl(floor.floorNumber) };
  }
  const lead = floor.enemies[0];
  if (lead) {
    return {
      kind: "pokemon",
      src: pokeApiSpriteUrl(lead.speciesId, "icon"),
      speciesId: lead.speciesId,
    };
  }
  const glyphByType: Record<TowerFloorType, string> = {
    normal: "swords",
    elite: "local_fire_department",
    boss: "skull",
    rest: "auto_awesome",
  };
  return { kind: "glyph", icon: glyphByType[floor.type] };
}
