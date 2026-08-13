/**
 * Entrenadores de ruta.
 *
 * Son contenido estático, igual que las locations: no hace falta una tabla ni
 * un seed para definirlos, solo para registrar a quién venciste. Cada uno se
 * pelea una vez y deja la zona marcada como "limpia".
 *
 * Un Pokémon por entrenador a propósito: el combate reusa el motor de encuentro
 * salvaje tal cual. Los equipos de varios (con cambios) ya existen en los
 * gimnasios, y esa maquinaria es la del pasillo de gimnasio, no la de una ruta.
 */
export type RouteTrainer = {
  id: string;
  locationId: string;
  /** Clave i18n del nombre — se muestran traducidos como todo lo demás. */
  nameKey: string;
  /** Slug del sprite en Showdown (`sprites/trainers/{slug}.png`). */
  spriteSlug: string;
  speciesId: number;
  level: number;
  coinReward: number;
};

/**
 * Contenido (`hiker_2`, `bug_catcher`) → slug CDN de Showdown (`hiker`, `bugcatcher`).
 * Sufijos `_2`, `_3`… son variantes del mismo clase visual.
 */
export function routeTrainerShowdownSlug(contentSlug: string): string {
  return contentSlug.replace(/_\d+$/, "").replace(/_/g, "");
}

function trainer(
  locationId: string,
  slug: string,
  speciesId: number,
  level: number,
  coinReward: number,
): RouteTrainer {
  return {
    id: `${locationId}-${slug}`,
    locationId,
    nameKey: `trainers.${slug}`,
    spriteSlug: routeTrainerShowdownSlug(slug),
    speciesId,
    level,
    coinReward,
  };
}

/** Dos entrenadores por ruta/cueva; las ciudades y gimnasios no tienen. */
export const ROUTE_TRAINERS: RouteTrainer[] = [
  // Rattata Nv.3: el inicial Planta no pelea contra volador (Pidgey resiste Grass).
  trainer("route-1", "youngster", 19, 3, 50),
  trainer("route-2", "bug_catcher", 13, 5, 70),
  trainer("viridian-forest", "bug_catcher_2", 11, 6, 90),
  trainer("viridian-forest", "camper", 10, 7, 100),
  trainer("route-3", "lass", 21, 10, 120),
  trainer("mt-moon", "hiker", 74, 12, 150),
  trainer("mt-moon", "rocket_grunt", 41, 14, 180),
  trainer("route-5", "picnicker", 43, 15, 190),
  trainer("route-11", "gambler", 96, 18, 220),
  trainer("rock-tunnel", "hiker_2", 95, 20, 260),
  trainer("rock-tunnel", "pokemaniac", 105, 22, 300),
  trainer("route-8", "super_nerd", 58, 23, 320),
  trainer("route-16", "biker", 88, 25, 360),
  trainer("route-15", "beauty", 44, 28, 410),
  trainer("route-19", "swimmer", 72, 31, 460),
  trainer("route-21", "fisherman", 98, 34, 520),
];

export function trainersForLocation(locationId: string): RouteTrainer[] {
  return ROUTE_TRAINERS.filter((t) => t.locationId === locationId);
}

/** Sin entrenadores en la zona, o todos ya vencidos. */
export function areLocationTrainersDefeated(
  locationId: string,
  defeatedTrainerIds: readonly string[] = [],
): boolean {
  const trainers = trainersForLocation(locationId);
  if (trainers.length === 0) return true;
  const done = new Set(defeatedTrainerIds);
  return trainers.every((t) => done.has(t.id));
}

export function getRouteTrainer(id: string): RouteTrainer | undefined {
  return ROUTE_TRAINERS.find((t) => t.id === id);
}
