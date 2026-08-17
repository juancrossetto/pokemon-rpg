/** Pokémon NPC de reserva si no hay otro jugador en cola. */
export const WONDER_NPC_POOL = [
  16, 19, 21, 23, 27, 29, 32, 41, 43, 46, 48, 52, 54, 56, 60, 69, 74, 81, 88, 92, 96, 98, 100,
  109, 116, 118, 129,
] as const;

export function wonderNpcSpecies(roll: number): number {
  const index = Math.floor(Math.max(0, Math.min(0.999999, roll)) * WONDER_NPC_POOL.length);
  return WONDER_NPC_POOL[index]!;
}

export function wonderNpcLevel(offeredLevel: number, roll: number): number {
  const jitter = Math.floor(roll * 5) - 2;
  return Math.max(5, Math.min(80, offeredLevel + jitter));
}
