// Posiciones de las 8 ciudades de gimnasio sobre public/gyms/maps/kanto-lgpe.png
// (mapa LGPE / Wikidex, 736×649). Coordenadas en % del contenedor.
export interface GymMapPoint {
  order: number;
  city: string;
  x: number;
  y: number;
}

export const GYM_MAP_POINTS: GymMapPoint[] = [
  { order: 1, city: "Pewter City", x: 18, y: 21 },
  { order: 2, city: "Cerulean City", x: 62, y: 15 },
  { order: 3, city: "Vermilion City", x: 62, y: 59 },
  { order: 4, city: "Celadon City", x: 46, y: 34 },
  { order: 5, city: "Fuchsia City", x: 52, y: 83 },
  { order: 6, city: "Saffron City", x: 62, y: 34 },
  { order: 7, city: "Cinnabar Island", x: 18, y: 96 },
  { order: 8, city: "Viridian City", x: 18, y: 52 },
];

export const KANTO_MAP_IMAGE = "/gyms/maps/kanto-lgpe.png";
