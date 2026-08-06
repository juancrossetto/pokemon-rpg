/**
 * Kanto + Johto. Se puede sumar cualquier trío inicial de otra generación sin
 * tocar nada más: todos son planta/fuego/agua, así que el triángulo del
 * tutorial (y el counter-pick del rival) se mantiene intacto. Lo que NO va acá
 * es un inicial suelto fuera del triángulo — rompe esa lección.
 */
export const STARTER_SPECIES_IDS = [
  1, 4, 7, // Bulbasaur, Charmander, Squirtle
  152, 155, 158, // Chikorita, Cyndaquil, Totodile
] as const;

/**
 * El rival del combate tutorial elige siempre el inicial que te gana por tipo,
 * como en los juegos oficiales: planta → fuego → agua → planta. Da una primera
 * batalla con desventaja real, que es donde se aprende que los tipos importan.
 * El contrincante sale del mismo trío que elegiste, así el arranque queda
 * coherente con la generación que el jugador tocó.
 */
const RIVAL_BY_STARTER: Record<number, number> = {
  // Kanto
  1: 4, // Bulbasaur (planta) ← Charmander (fuego)
  4: 7, // Charmander (fuego) ← Squirtle (agua)
  7: 1, // Squirtle (agua) ← Bulbasaur (planta)
  // Johto
  152: 155, // Chikorita (planta) ← Cyndaquil (fuego)
  155: 158, // Cyndaquil (fuego) ← Totodile (agua)
  158: 152, // Totodile (agua) ← Chikorita (planta)
};

export function rivalStarterFor(speciesId: number): number {
  return RIVAL_BY_STARTER[speciesId] ?? 4;
}
