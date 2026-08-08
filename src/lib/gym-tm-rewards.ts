// MT que regala cada líder al vencerlo la primera vez — mismo espíritu que
// los juegos reales (el líder te da una MT de su tipo). Elegido a mano entre
// las MTs reales de Rojo/Azul (ver prisma/seed/machines.ts) que son del tipo
// de cada gimnasio — todas existen de verdad, no hay tipos sin MT real acá.
export const GYM_TM_REWARD_BY_TYPE: Record<string, string> = {
  rock: "rock-slide",
  water: "bubble-beam",
  electric: "thunderbolt",
  grass: "solar-beam",
  poison: "toxic",
  psychic: "psychic",
  fire: "fire-blast",
  ground: "earthquake",
};

/**
 * Objeto held extra al ganar la medalla (primera vez). Brock (roca) regala
 * Exp. Share para que el equipo crezca temprano sin forzar un solo carry.
 */
export const GYM_HELD_ITEM_REWARD_BY_TYPE: Record<string, string> = {
  rock: "Exp. Share",
};
