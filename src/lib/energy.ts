// 1 punto de energía cada 30 minutos — ver dossier de diseño: la energía limita
// cuánto se puede grindear y es el control de inflación principal.
//
// Llenar 20 puntos tarda 10h, así que una barra vacía ya no se recupera dentro
// de la misma sesión y el jugador tiene que elegir en qué gasta. Es el único
// número que hay que tocar para recalibrar el ritmo del juego.
export const REGEN_MS_PER_POINT = 30 * 60 * 1000;

/** Costo por combate de gimnasio (subordinado o líder). */
export const GYM_BATTLE_ENERGY_COST = 2;

export function getCurrentEnergy(energy: number, energyMax: number, energyUpdatedAt: Date): number {
  const elapsedMs = Date.now() - energyUpdatedAt.getTime();
  const regenerated = Math.floor(elapsedMs / REGEN_MS_PER_POINT);
  return Math.min(energyMax, energy + regenerated);
}

/**
 * Milisegundos hasta el próximo punto de energía, o `null` si ya está llena.
 *
 * Se calcula sobre el mismo resto que usa `getCurrentEnergy`, así el contador
 * llega a cero justo cuando esa función devuelve un punto más — si se estimara
 * por separado, el reloj y el número quedarían desfasados.
 */
export function msUntilNextEnergyPoint(
  energy: number,
  energyMax: number,
  energyUpdatedAt: Date,
  now: number = Date.now(),
): number | null {
  if (getCurrentEnergy(energy, energyMax, energyUpdatedAt) >= energyMax) return null;
  const elapsedMs = now - energyUpdatedAt.getTime();
  const remainder = elapsedMs % REGEN_MS_PER_POINT;
  return REGEN_MS_PER_POINT - remainder;
}

/** `mm:ss` para el contador del header. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
