/**
 * Overlay de cambio de idioma fuera del árbol React.
 * El soft-nav de locale remonta `[locale]/layout` y se lleva el
 * NavigationProgress; este nodo vive en `document.body` y sobrevive.
 *
 * Asset: `/loaders/spinner_pokeball.gif` (Pokéball girando).
 */

const OVERLAY_ID = "locale-switch-overlay";
const SPINNER_SRC = "/loaders/spinner_pokeball.gif";

export function showLocaleSwitchOverlay(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(OVERLAY_ID)) return;

  document.documentElement.dataset.navPending = "";

  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.className = "locale-switch-overlay";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-busy", "true");
  el.innerHTML = `<div class="locale-switch-overlay__ball"><img src="${SPINNER_SRC}" alt="" decoding="async" /></div>`;
  document.body.appendChild(el);
}

export function hideLocaleSwitchOverlay(): void {
  if (typeof document === "undefined") return;
  document.getElementById(OVERLAY_ID)?.remove();
  delete document.documentElement.dataset.navPending;
}
