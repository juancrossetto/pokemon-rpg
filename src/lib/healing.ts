/**
 * Centro Pokémon (dossier): "gratis pero con tiempo de regeneración, o pago
 * para instantáneo".
 *
 * Es un sumidero de economía, no una comodidad: si curar es gratis, instantáneo
 * e ilimitado, las pociones no tienen razón de existir y nada frena la
 * inflación de monedas. Con cooldown, o esperás o pagás.
 *
 * Excepción: hasta que el Pokémon más fuerte del equipo llega al nivel
 * `HEAL_FREE_UNTIL_LEVEL`, el centro es gratis e ilimitado — arranque suave
 * para perfiles nuevos.
 */
export const HEAL_COOLDOWN_MINUTES = 30;

/** Nivel máximo de equipo inclusive: curación gratis sin cooldown ni rush. */
export const HEAL_FREE_UNTIL_LEVEL = 20;

/** Costo base por saltear la espera, más un extra por cada Pokémon herido. */
export const HEAL_RUSH_BASE_COST = 60;
export const HEAL_RUSH_COST_PER_MEMBER = 40;

export function healRushCost(hurtMembers: number): number {
  return HEAL_RUSH_BASE_COST + Math.max(0, hurtMembers) * HEAL_RUSH_COST_PER_MEMBER;
}

/** `true` mientras el Pokémon más alto del equipo no supera el umbral. */
export function isPokemonCenterFree(teamMaxLevel: number): boolean {
  return teamMaxLevel <= HEAL_FREE_UNTIL_LEVEL;
}

export function healCooldownMsLeft(lastHealAt: Date | null, now: Date = new Date()): number {
  if (!lastHealAt) return 0;
  const elapsed = now.getTime() - lastHealAt.getTime();
  return Math.max(0, HEAL_COOLDOWN_MINUTES * 60_000 - elapsed);
}

export function minutesLeft(ms: number): number {
  return Math.ceil(ms / 60_000);
}
