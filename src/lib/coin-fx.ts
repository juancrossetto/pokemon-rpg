/**
 * Señal ligera para animar el badge de monedas del header sin un store global.
 * Cualquier action/cliente puede avisar un delta; el badge anima de inmediato
 * y el `router.refresh` / revalidate termina alineando el valor del server.
 *
 * El pending en módulo + sessionStorage cubre el caso en que el layout se
 * remonta al revalidar: el badge nuevo arranca desde `coins - delta` y sigue
 * la cuenta, en vez de aparecer ya en el saldo final.
 */
export const COIN_DELTA_EVENT = "pokerpg:coin-delta";

export type CoinDeltaDetail = { delta: number };

const PENDING_KEY = "pokerpg:coin-delta-pending";

let pendingDelta = 0;
let pendingAt = 0;

function writePending(delta: number): void {
  pendingDelta = delta;
  pendingAt = Date.now();
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ delta, at: pendingAt }));
    }
  } catch {
    /* private mode / SSR */
  }
}

function readPending(): { delta: number; at: number } | null {
  if (pendingDelta !== 0 && Date.now() - pendingAt < 8_000) {
    return { delta: pendingDelta, at: pendingAt };
  }
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { delta?: number; at?: number };
    if (
      typeof parsed.delta === "number" &&
      Number.isFinite(parsed.delta) &&
      parsed.delta !== 0 &&
      typeof parsed.at === "number" &&
      Date.now() - parsed.at < 8_000
    ) {
      pendingDelta = parsed.delta;
      pendingAt = parsed.at;
      return { delta: parsed.delta, at: parsed.at };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Reserva el delta sin animar todavía. Sirve cuando el server ya revalidó el
 * layout (saldo nuevo) pero el FX de loot todavía no llegó al header: el badge
 * arranca en `coins - pending` y espera `announceCoinDelta` / `flushPendingCoinDelta`.
 */
export function seedPendingCoinDelta(delta: number): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta === 0) return;
  const next = (readPending()?.delta ?? 0) + delta;
  writePending(next);
}

export function announceCoinDelta(delta: number): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta === 0) return;
  const next = (readPending()?.delta ?? 0) + delta;
  writePending(next);
  window.dispatchEvent(
    new CustomEvent<CoinDeltaDetail>(COIN_DELTA_EVENT, { detail: { delta } }),
  );
}

/** Dispara la animación con el pending ya sembrado (sin sumar otra vez). */
export function flushPendingCoinDelta(): void {
  if (typeof window === "undefined") return;
  const pending = readPending();
  if (!pending || pending.delta === 0) return;
  window.dispatchEvent(
    new CustomEvent<CoinDeltaDetail>(COIN_DELTA_EVENT, {
      detail: { delta: pending.delta },
    }),
  );
}

/** Lee el delta pendiente sin borrarlo (varios badges pueden montar a la vez). */
export function peekPendingCoinDelta(): number {
  return readPending()?.delta ?? 0;
}

/** Limpia el pending cuando la animación ya arrancó o el saldo quedó alineado. */
export function clearPendingCoinDelta(): void {
  pendingDelta = 0;
  pendingAt = 0;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
