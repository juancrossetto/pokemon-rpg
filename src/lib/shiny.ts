/**
 * Variocolor (shiny).
 *
 * El dossier los fija tan raros como en el juego oficial: 1 entre 4096. Esa
 * escasez es genuina, no de volumen, y es lo que hace que muevan el mercado.
 *
 * La tirada ocurre **al generar el encuentro**, no al capturar: el jugador
 * tiene que poder ver que es variocolor mientras pelea, que es de donde sale
 * la emoción. El resultado viaja en `BattleSession.wildIsShiny` y se copia a la
 * `PokemonInstance` si lo atrapa.
 */
export const SHINY_ODDS = 4096;

export function rollShiny(odds: number = SHINY_ODDS): boolean {
  return Math.floor(Math.random() * odds) === 0;
}

/**
 * Sprite variocolor del CDN de PokeAPI. Los sprites normales viven en
 * `.../official-artwork/<id>.png` y los shiny en `.../official-artwork/shiny/<id>.png`,
 * así que alcanza con reescribir la URL que ya tenemos guardada.
 */
export function shinySpriteUrl(spriteUrl: string): string {
  if (!spriteUrl) return spriteUrl;
  if (spriteUrl.includes("/official-artwork/shiny/")) return spriteUrl;
  if (spriteUrl.includes("/official-artwork/")) {
    return spriteUrl.replace("/official-artwork/", "/official-artwork/shiny/");
  }
  if (spriteUrl.includes("/home/shiny/")) return spriteUrl;
  if (spriteUrl.includes("/home/")) {
    return spriteUrl.replace("/home/", "/home/shiny/");
  }
  // Sprites "pixel" clásicos: .../pokemon/25.png → .../pokemon/shiny/25.png
  return spriteUrl.replace(/\/pokemon\/(\d+\.png)$/, "/pokemon/shiny/$1");
}

/** Devuelve el sprite correcto según si la instancia es variocolor. */
export function spriteFor(spriteUrl: string, isShiny: boolean): string {
  return isShiny ? shinySpriteUrl(spriteUrl) : spriteUrl;
}
