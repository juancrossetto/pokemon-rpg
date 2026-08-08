// 1 punto de energía cada 30 minutos — ver dossier de diseño: la energía limita
// cuánto se puede grindear y es el control de inflación principal.
//
// Llenar 30 puntos tarda 15h, así que una barra vacía ya no se recupera dentro
// de la misma sesión y el jugador tiene que elegir en qué gasta. Es el único
// número que hay que tocar para recalibrar el ritmo del juego.
export const REGEN_MS_PER_POINT = 30 * 60 * 1000;

/**
 * Costo de cada actividad.
 *
 * Estos tres números estaban repetidos como constantes locales en cuatro
 * archivos (`start-encounter`, `battle/page`, `pvp`, `start-pvp-battle`), así
 * que no había ningún lugar donde leer "cuánto cuesta jugar" — ni para
 * recalibrar el ritmo ni para mostrárselo al jugador, que era justamente lo
 * que faltaba: la barra se vaciaba sin que nada dijera en qué se fue.
 */

/** Costo por encuentro salvaje. Un stage puede pisarlo con `energyCost`. */
export const WILD_ENCOUNTER_ENERGY_COST = 1;

/**
 * Costo por combate contra un entrenador subordinado del pasillo del gimnasio.
 *
 * Vale la mitad que el líder: el pasillo son 3-5 peleas de trámite antes de la
 * que importa, y cobrarlas a 2 hacía que una corrida completa se comiera la
 * barra entera y el jugador llegara al líder sin poder pelearlo.
 */
export const GYM_TRAINER_BATTLE_ENERGY_COST = 1;

/** Costo por combate contra el líder de gimnasio. */
export const GYM_LEADER_BATTLE_ENERGY_COST = 2;

/** Costo del próximo combate de una corrida, según contra quién toque. */
export function gymBattleEnergyCost(kind: "trainer" | "leader"): number {
  return kind === "leader" ? GYM_LEADER_BATTLE_ENERGY_COST : GYM_TRAINER_BATTLE_ENERGY_COST;
}

/** Costo por combate de PvP. */
export const PVP_BATTLE_ENERGY_COST = 1;

/** Cooldown entre avisos in-app de "energía llena" (anti-spam). */
export const ENERGY_FULL_NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

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

/**
 * Ms hasta que la barra esté llena, o `null` si ya lo está.
 * Suma los ticks restantes al mismo ritmo que `getCurrentEnergy`.
 */
export function msUntilEnergyFull(
  energy: number,
  energyMax: number,
  energyUpdatedAt: Date,
  now: number = Date.now(),
): number | null {
  const current = getCurrentEnergy(energy, energyMax, energyUpdatedAt);
  if (current >= energyMax) return null;
  const pointsNeeded = energyMax - current;
  const toNext = msUntilNextEnergyPoint(energy, energyMax, energyUpdatedAt, now);
  if (toNext == null) return null;
  return toNext + (pointsNeeded - 1) * REGEN_MS_PER_POINT;
}

/** `mm:ss` para el contador del header. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
