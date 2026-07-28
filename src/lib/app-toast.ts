/**
 * Toast global mínimo, mismo patrón de evento que coin-fx: cualquier cliente
 * dispara `showToast(...)` y el `<AppToastViewport>` del layout lo muestra.
 * Para éxitos cortos ("Compraste 3× Poción") y errores que antes se
 * tragaban en silencio (claim diario, favorito, evolución…).
 */
export const APP_TOAST_EVENT = "pokerpg:app-toast";

export type AppToastKind = "success" | "error" | "info";

export type AppToastDetail = {
  message: string;
  kind: AppToastKind;
};

export function showToast(message: string, kind: AppToastKind = "info"): void {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(
    new CustomEvent<AppToastDetail>(APP_TOAST_EVENT, { detail: { message, kind } }),
  );
}
