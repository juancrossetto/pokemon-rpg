/**
 * Señal ligera para animar el badge de monedas del header sin un store global.
 * Cualquier action/cliente puede avisar un delta; el badge anima de inmediato
 * y el `router.refresh` / revalidate termina alineando el valor del server.
 */
export const COIN_DELTA_EVENT = "pokerpg:coin-delta";

export type CoinDeltaDetail = { delta: number };

export function announceCoinDelta(delta: number): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta === 0) return;
  window.dispatchEvent(
    new CustomEvent<CoinDeltaDetail>(COIN_DELTA_EVENT, { detail: { delta } }),
  );
}
