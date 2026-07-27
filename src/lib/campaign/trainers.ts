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
  speciesId: number;
  level: number;
  coinReward: number;
};

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
    speciesId,
    level,
    coinReward,
  };
}

/** Dos entrenadores por ruta/cueva; las ciudades y gimnasios no tienen. */
export const ROUTE_TRAINERS: RouteTrainer[] = [
  trainer("route-1", "youngster", 16, 5, 60),
  trainer("route-2", "bug_catcher", 13, 7, 80),
  trainer("viridian-forest", "bug_catcher_2", 11, 9, 100),
  trainer("viridian-forest", "camper", 10, 10, 110),
  trainer("route-3", "lass", 21, 12, 130),
  trainer("mt-moon", "hiker", 74, 14, 160),
  trainer("mt-moon", "rocket_grunt", 41, 16, 190),
  trainer("route-5", "picnicker", 43, 17, 200),
  trainer("route-11", "gambler", 96, 20, 240),
  trainer("rock-tunnel", "hiker_2", 95, 22, 280),
  trainer("rock-tunnel", "pokemaniac", 105, 24, 320),
  trainer("route-8", "super_nerd", 58, 25, 340),
  trainer("route-16", "biker", 88, 27, 380),
  trainer("route-15", "beauty", 44, 30, 430),
  trainer("route-19", "swimmer", 72, 33, 480),
  trainer("route-21", "fisherman", 98, 36, 540),
];

export function trainersForLocation(locationId: string): RouteTrainer[] {
  return ROUTE_TRAINERS.filter((t) => t.locationId === locationId);
}

export function getRouteTrainer(id: string): RouteTrainer | undefined {
  return ROUTE_TRAINERS.find((t) => t.id === id);
}
