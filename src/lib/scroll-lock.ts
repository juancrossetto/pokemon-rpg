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
 *
 * IMPORTANTE (PWA iOS): no tocar `overflow` de `.app-main`. En standalone el
 * scroll vive ahí, pero ponerle `overflow:hidden` hace que WebKit despegue
 * los `position:fixed` (bottom nav) del borde físico — el dock queda flotando
 * sobre el home indicator. Los overlays ya capturan el gesto con su backdrop.
 */
let holders = 0;
/** Valor original del body, capturado sólo al tomar el primer lock. */
let restoreBodyOverflow: string | null = null;

/** Toma el lock y devuelve la función para soltarlo (idempotente). */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (holders === 0) {
    restoreBodyOverflow = document.body.style.overflow;
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
      document.body.style.overflow = restoreBodyOverflow ?? "";
      restoreBodyOverflow = null;
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

/**
 * Contenedor de scroll de la app. En PWA standalone el body está
 * `overflow:hidden` y el scroll real vive acá.
 */
export function getAppScrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(".app-main");
}

function isVerticallyScrollable(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el);
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") {
    return false;
  }
  return el.scrollHeight > el.clientHeight + 1;
}

/** Ancestro con overflow-y scrolleable, o `.app-main` / null. */
export function findVerticalScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent) {
    if (isVerticallyScrollable(parent)) return parent;
    if (parent.classList.contains("app-main")) return parent;
    parent = parent.parentElement;
  }
  return getAppScrollRoot();
}

type ScrollBlock = "start" | "center" | "end" | "nearest";

function targetScrollTop(
  scroller: HTMLElement,
  el: HTMLElement,
  block: ScrollBlock,
  offsetPx: number,
): number {
  const sRect = scroller.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const current = scroller.scrollTop;
  const relTop = eRect.top - sRect.top + current;
  const relBottom = relTop + eRect.height;
  const viewTop = current;
  const viewBottom = current + scroller.clientHeight;
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

  let next = current;
  if (block === "start") {
    next = relTop - offsetPx;
  } else if (block === "center") {
    next = relTop - (scroller.clientHeight - eRect.height) / 2;
  } else if (block === "end") {
    next = relBottom - scroller.clientHeight + offsetPx;
  } else {
    // nearest
    if (relTop < viewTop + offsetPx) next = relTop - offsetPx;
    else if (relBottom > viewBottom - offsetPx) {
      next = relBottom - scroller.clientHeight + offsetPx;
    } else {
      return current;
    }
  }
  return Math.min(max, Math.max(0, next));
}

/**
 * Scroll seguro hacia un elemento: usa el overflow padre (chat, log, riel) o
 * `.app-main`. Evita `Element.scrollIntoView` — en PWA iOS scrollea el window
 * bloqueado y puede dejar la app sin scroll hasta recargar.
 */
export function scrollElementIntoViewSafe(
  el: HTMLElement,
  opts?: {
    behavior?: ScrollBehavior;
    block?: ScrollBlock;
    offsetPx?: number;
    /** Forzar scroll en `.app-main` (p. ej. hero de gimnasio / panel campaign). */
    preferAppMain?: boolean;
  },
): void {
  const behavior = opts?.behavior ?? "smooth";
  const block = opts?.block ?? "nearest";
  const offsetPx = opts?.offsetPx ?? 0;
  const scroller = opts?.preferAppMain
    ? getAppScrollRoot() ?? findVerticalScrollParent(el)
    : findVerticalScrollParent(el);

  if (!scroller) return;

  const top = targetScrollTop(scroller, el, block, offsetPx);
  if (Math.abs(top - scroller.scrollTop) < 1) return;
  scroller.scrollTo({ top, behavior });
}

/**
 * Scroll vertical hacia un elemento en `.app-main`.
 * Preferí `scrollElementIntoViewSafe` si puede haber un overflow intermedio.
 */
export function scrollAppMainToElement(
  el: HTMLElement,
  opts?: { behavior?: ScrollBehavior; offsetPx?: number; block?: ScrollBlock },
): void {
  scrollElementIntoViewSafe(el, {
    behavior: opts?.behavior,
    offsetPx: opts?.offsetPx ?? 12,
    block: opts?.block ?? "start",
    preferAppMain: true,
  });
}

/** Centra un hijo en un carril horizontal (tabs) sin `scrollIntoView`. */
export function scrollChildIntoHorizontalCenter(
  container: HTMLElement,
  child: HTMLElement,
  behavior: ScrollBehavior = "smooth",
): void {
  const left = child.offsetLeft - (container.clientWidth - child.clientWidth) / 2;
  container.scrollTo({ left: Math.max(0, left), behavior });
}

/** Sólo para tests: reinicia el contador entre casos. */
export function __resetScrollLockForTests(): void {
  holders = 0;
  restoreBodyOverflow = null;
}
