// Posiciones estilizadas (no geográficamente exactas) de las 8 ciudades de
// gimnasio sobre un mapa abstracto de Kanto — layout relativo real (Pewter
// al norte de Viridian, Cerulean bien al norte, Vermilion en la costa
// sudeste, Celadon/Saffron centrales, Fuchsia al sur, Cinnabar es una isla
// al sudoeste). Coordenadas en % sobre el contenedor del mapa.
export interface GymMapPoint {
  order: number;
  city: string;
  x: number;
  y: number;
}

export const GYM_MAP_POINTS: GymMapPoint[] = [
  { order: 1, city: "Pewter City", x: 19, y: 52 },
  { order: 2, city: "Cerulean City", x: 44, y: 20 },
  { order: 3, city: "Vermilion City", x: 50, y: 70 },
  { order: 4, city: "Celadon City", x: 38, y: 47 },
  { order: 5, city: "Fuchsia City", x: 50, y: 82 },
  { order: 6, city: "Saffron City", x: 60, y: 50 },
  { order: 7, city: "Cinnabar Island", x: 15, y: 88 },
  { order: 8, city: "Viridian City", x: 19, y: 72 },
];
