/**
 * Cadena de farm / rematch rápido en la misma sesión.
 * Sirve para acortar la intro VS y mostrar rachas en el resultado.
 */

const STORAGE_KEY = "battle-farm-chain";
/** Ventana para contar batallas seguidas (ms). */
const CHAIN_WINDOW_MS = 12 * 60 * 1000;

export type BattleFarmMode = "wild" | "gym" | "pvp" | "tower";

type FarmChain = {
  mode: BattleFarmMode;
  locationKey: string;
  count: number;
  at: number;
};

function readChain(): FarmChain | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FarmChain;
    if (
      !parsed ||
      typeof parsed.count !== "number" ||
      typeof parsed.at !== "number" ||
      typeof parsed.mode !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeChain(chain: FarmChain) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chain));
  } catch {
    // sessionStorage bloqueado — sin cadena.
  }
}

/**
 * Registra el inicio de una batalla fresca. Devuelve el índice en la cadena
 * (1 = primera, 2+ = rematch/farm).
 */
export function noteBattleChainStart(
  mode: BattleFarmMode,
  locationKey = "default",
): number {
  const now = Date.now();
  const prev = readChain();
  const same =
    prev &&
    prev.mode === mode &&
    prev.locationKey === locationKey &&
    now - prev.at < CHAIN_WINDOW_MS;
  const count = same ? prev.count + 1 : 1;
  writeChain({ mode, locationKey, count, at: now });
  return count;
}

export function getBattleChainCount(): number {
  const chain = readChain();
  if (!chain) return 0;
  if (Date.now() - chain.at > CHAIN_WINDOW_MS) return 0;
  return chain.count;
}

/** Segunda+ pelea wild/tower en la ventana → intro VS corta. */
export function shouldShortenBattleIntro(
  mode: BattleFarmMode,
  locationKey = "default",
): boolean {
  if (mode !== "wild" && mode !== "tower") return false;
  const prev = readChain();
  if (!prev) return false;
  if (prev.mode !== mode || prev.locationKey !== locationKey) return false;
  if (Date.now() - prev.at > CHAIN_WINDOW_MS) return false;
  // count ya incluye la pelea actual tras noteBattleChainStart.
  return prev.count >= 2;
}
