"use client";

import { useEffect } from "react";

/**
 * Bloqueo de scroll del body con conteo de referencias.
 *
 * Antes cada overlay (modales, sheets, pickers, el drawer "Más", la pantalla de
 * batalla…) manejaba `document.body.style.overflow` por su cuenta, y había dos
 * criterios distintos para soltarlo: unos restauraban el valor previo y otros
 * lo vaciaban. Con dos overlays encimados eso rompe de las dos formas:
 *
 * - El de arriba captura `prev = "hidden"` (puesto por el de abajo). Si el de
 *   abajo se cierra primero, el de arriba al cerrar **repone `hidden`** y la
 *   página queda sin scroll aunque no haya nada abierto — sólo se arregla
 *   recargando. Es el "se traba y no me deja avanzar".
 * - Al revés, el que vacía suelta el scroll mientras el de abajo sigue abierto,
 *   y el fondo se mueve detrás del overlay.
 *
 * Con un contador único hay una sola verdad: el body se bloquea cuando entra el
 * primer interesado y se restaura cuando sale el último.
 */
let holders = 0;
/** Valor original del body, capturado sólo al tomar el primer lock. */
let restoreTo: string | null = null;

/** Toma el lock y devuelve la función para soltarlo (idempotente). */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (holders === 0) {
    restoreTo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  holders += 1;

  let released = false;
  return () => {
    // Un release que se llama dos veces (StrictMode, cleanup + handler manual)
    // no puede descontar de más: dejaría el scroll suelto con overlays abiertos.
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) {
      document.body.style.overflow = restoreTo ?? "";
      restoreTo = null;
    }
  };
}

/** Mantiene el scroll bloqueado mientras `active` sea true. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}

/** Sólo para tests: reinicia el contador entre casos. */
export function __resetScrollLockForTests(): void {
  holders = 0;
  restoreTo = null;
}
