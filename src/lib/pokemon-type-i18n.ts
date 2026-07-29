/** Localiza un tipo de Pokémon (`fire` → Fuego) vía `pokedex.pokemonTypes`. */
export function localizePokemonType(
  t: { has: (key: string) => boolean; (key: string): string },
  type: string,
): string {
  const key = type.toLowerCase();
  return t.has(key) ? t(key) : type;
}
