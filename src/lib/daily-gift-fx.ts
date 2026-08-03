/**
 * Señal para reabrir el Daily Reward desde la campanita u otros clientes.
 * Comparte la clave de sessionStorage con `daily-gift-modal.tsx`.
 */
export const DAILY_GIFT_SEEN_KEY = "pokerpg:daily-gift-seen";
export const DAILY_GIFT_OPEN_EVENT = "pokerpg:daily-gift-open";

/** Limpia el "ya lo vi" de la sesión y avisa a los listeners del modal. */
export function openDailyRewardModal(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DAILY_GIFT_SEEN_KEY);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(DAILY_GIFT_OPEN_EVENT));
}
