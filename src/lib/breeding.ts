/**
 * Cría (dossier).
 *
 * "Podría heredar parte de los puntos ya invertidos de los padres — le da un
 * uso a Pokémon que no usás en batalla y es otro sumidero de economía."
 *
 * Reglas, todas derivadas de esa frase:
 * - Los dos padres tienen que ser tuyos, estar en la PC (no en el equipo) y no
 *   estar publicados. Así el costo real es sacar dos Pokémon de circulación.
 * - La cría hereda la **mitad del promedio** de los puntos invertidos de los
 *   padres, por atributo. Nunca es mejor que sus padres: no rompe la economía.
 * - La especie es la del padre A (sin cadenas de huevo de los juegos oficiales,
 *   que PokeAPI no cubre acá).
 * - El variocolor se tira de nuevo, con las mismas probabilidades que en la
 *   naturaleza: criar no es una fábrica de shinies.
 */
export const BREEDING_COST = 300;
export const BREEDING_HOURS = 4;
/** Los padres tienen que llegar a este nivel para poder criar. */
export const BREEDING_MIN_LEVEL = 15;
export const HATCH_LEVEL = 5;

export type ParentPoints = {
  ptStrength: number;
  ptSpeed: number;
  ptDexterity: number;
  ptIntelligence: number;
  ptConstitution: number;
};

/** Mitad del promedio de los padres, redondeado hacia abajo. */
export function inheritPoints(a: ParentPoints, b: ParentPoints): ParentPoints {
  const half = (x: number, y: number) => Math.floor((x + y) / 4);
  return {
    ptStrength: half(a.ptStrength, b.ptStrength),
    ptSpeed: half(a.ptSpeed, b.ptSpeed),
    ptDexterity: half(a.ptDexterity, b.ptDexterity),
    ptIntelligence: half(a.ptIntelligence, b.ptIntelligence),
    ptConstitution: half(a.ptConstitution, b.ptConstitution),
  };
}

export function hatchReadyAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + BREEDING_HOURS * 60 * 60 * 1000);
}

export function msUntilHatch(readyAt: Date, now: Date = new Date()): number {
  return Math.max(0, readyAt.getTime() - now.getTime());
}
