// Posiciones de las 8 ciudades de gimnasio sobre public/gyms/maps/kanto.png
// (mapa esquemático CC0). Coordenadas en % del contenedor.
export interface GymMapPoint {
  order: number;
  city: string;
  x: number;
  y: number;
}

export const GYM_MAP_POINTS: GymMapPoint[] = [
  { order: 1, city: "Pewter City", x: 28, y: 24 },
  { order: 2, city: "Cerulean City", x: 58, y: 22 },
  { order: 3, city: "Vermilion City", x: 58, y: 55 },
  { order: 4, city: "Celadon City", x: 38, y: 42 },
  { order: 5, city: "Fuchsia City", x: 52, y: 74 },
  { order: 6, city: "Saffron City", x: 58, y: 40 },
  { order: 7, city: "Cinnabar Island", x: 24, y: 86 },
  { order: 8, city: "Viridian City", x: 24, y: 52 },
];

export const KANTO_MAP_IMAGE = "/gyms/maps/kanto.png";
