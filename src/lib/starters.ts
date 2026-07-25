export const STARTER_SPECIES_IDS = [1, 4, 7] as const; // Bulbasaur, Charmander, Squirtle

/**
 * El rival del combate tutorial elige siempre el inicial que te gana por tipo,
 * como en los juegos oficiales: Bulbasaur → Charmander → Squirtle → Bulbasaur.
 * Da una primera batalla con desventaja real, que es donde se aprende que los
 * tipos importan.
 */
const RIVAL_BY_STARTER: Record<number, number> = {
  1: 4, // Bulbasaur (planta) ← Charmander (fuego)
  4: 7, // Charmander (fuego) ← Squirtle (agua)
  7: 1, // Squirtle (agua) ← Bulbasaur (planta)
};

export function rivalStarterFor(speciesId: number): number {
  return RIVAL_BY_STARTER[speciesId] ?? 4;
}
