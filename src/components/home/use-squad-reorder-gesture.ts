"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

/** Long-press en touch/pen antes de reordenar. */
export const TOUCH_REORDER_MS = 280;
/** En mouse: arrancar el drag tras este desplazamiento. */
export const MOUSE_START_PX = 6;
/**
 * En touch: umbral para decidir el eje del gesto (scroll página / carrusel /
 * long-press). Por debajo seguimos esperando el hold.
 */
export const TOUCH_AXIS_PX = 10;

export type SquadSlotAttr = "data-team-slot" | "data-squad-slot";

export function slotIndexFromPoint(
  x: number,
  y: number,
  attr: SquadSlotAttr,
): number | null {
  const el = document.elementFromPoint(x, y);
  const host = el?.closest<HTMLElement>(`[${attr}]`);
  if (!host) return null;
  const raw =
    attr === "data-team-slot" ? host.dataset.teamSlot : host.dataset.squadSlot;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function findScrollRail(from: HTMLElement): HTMLElement | null {
  return from.closest<HTMLElement>("[data-squad-rail], [data-team-rail]");
}

function isHorizontallyScrollable(rail: HTMLElement | null): boolean {
  if (!rail) return false;
  return rail.scrollWidth > rail.clientWidth + 2;
}

type Origin = {
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
  memberId: string;
  dragging: boolean;
  /** Scroll horizontal del rail en vez de reorder. */
  scrolling: boolean;
  rail: HTMLElement | null;
  railStartScroll: number;
};

/**
 * Gesto de reorden para cards del squad.
 *
 * Touch sobre un carrusel / grilla:
 * - hold quieto → long-press → drag
 * - movimiento **vertical** dominante → soltar el gesto (scroll de página)
 * - movimiento **horizontal** dominante + rail scrolleable → pan del carrusel
 * - mouse → drag tras unos px
 *
 * No capturamos el pointer al `pointerdown`: si no, iOS no puede pan-y la
 * página y el home se traba encima del equipo.
 */
export function useSquadReorderGesture({
  disabled,
  memberId,
  slotAttr,
  onDragStart,
  onDragHover,
  onDragMove,
  onDragDrop,
  onDragEnd,
}: {
  disabled: boolean;
  memberId: string;
  slotAttr: SquadSlotAttr;
  onDragStart: (id: string) => void;
  onDragHover: (slotIndex: number | null) => void;
  onDragMove?: (clientX: number, clientY: number) => void;
  onDragDrop: (slotIndex: number) => void;
  onDragEnd: () => void;
}) {
  const skipClickRef = useRef(false);
  const originRef = useRef<Origin | null>(null);
  const timerRef = useRef<number | null>(null);
  const onDragStartRef = useRef(onDragStart);
  const onDragHoverRef = useRef(onDragHover);
  const onDragMoveRef = useRef(onDragMove);
  const onDragDropRef = useRef(onDragDrop);
  const onDragEndRef = useRef(onDragEnd);

  useEffect(() => {
    onDragStartRef.current = onDragStart;
    onDragHoverRef.current = onDragHover;
    onDragMoveRef.current = onDragMove;
    onDragDropRef.current = onDragDrop;
    onDragEndRef.current = onDragEnd;
  }, [onDragStart, onDragHover, onDragMove, onDragDrop, onDragEnd]);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    return () => clearTimer();
  }, []);

  function capturePointer(target: HTMLElement, pointerId: number) {
    try {
      target.setPointerCapture(pointerId);
    } catch {
      /* already released */
    }
  }

  function releasePointer(target: HTMLElement, pointerId: number) {
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  }

  function beginDrag(
    target: HTMLElement,
    pointerId: number,
    clientX: number,
    clientY: number,
  ) {
    const origin = originRef.current;
    if (!origin || origin.dragging || origin.scrolling) return;
    origin.dragging = true;
    skipClickRef.current = true;
    onDragStartRef.current(origin.memberId);
    onDragMoveRef.current?.(clientX, clientY);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* no haptic */
    }
    capturePointer(target, pointerId);
  }

  function finishDrag(clientX: number, clientY: number) {
    const origin = originRef.current;
    clearTimer();
    originRef.current = null;
    if (!origin) return;
    if (origin.scrolling) {
      // Fue scroll del rail: no abrir la ficha.
      skipClickRef.current = true;
      requestAnimationFrame(() => {
        skipClickRef.current = false;
      });
      return;
    }
    if (!origin.dragging) return;
    const slot = slotIndexFromPoint(clientX, clientY, slotAttr);
    if (slot != null) onDragDropRef.current(slot);
    onDragEndRef.current();
    requestAnimationFrame(() => {
      skipClickRef.current = false;
    });
  }

  function cancelDrag() {
    clearTimer();
    const wasDragging = originRef.current?.dragging;
    originRef.current = null;
    if (wasDragging) onDragEndRef.current();
  }

  /** Abandona el gesto para que el scroll vertical de la página siga. */
  function abandonForPageScroll(target: HTMLElement, pointerId: number) {
    clearTimer();
    releasePointer(target, pointerId);
    originRef.current = null;
  }

  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (disabled) return;
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-squad-no-drag]")) return;
      clearTimer();

      const target = e.currentTarget;
      const rail = findScrollRail(target);
      originRef.current = {
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        memberId,
        dragging: false,
        scrolling: false,
        rail,
        railStartScroll: rail?.scrollLeft ?? 0,
      };

      // No capturar acá: con capture, iOS no puede pan-y `.app-main`.
      if (e.pointerType !== "mouse") {
        const pointerId = e.pointerId;
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          const origin = originRef.current;
          if (!origin || origin.pointerId !== pointerId) return;
          if (origin.scrolling) return;
          beginDrag(target, pointerId, origin.x, origin.y);
        }, TOUCH_REORDER_MS);
      }
    },

    onPointerMove(e: PointerEvent<HTMLElement>) {
      const origin = originRef.current;
      if (!origin || origin.pointerId !== e.pointerId) return;

      if (origin.scrolling) {
        e.preventDefault();
        if (origin.rail) {
          const dx = e.clientX - origin.x;
          origin.rail.scrollLeft = origin.railStartScroll - dx;
        }
        return;
      }

      if (!origin.dragging) {
        const dx = e.clientX - origin.x;
        const dy = e.clientY - origin.y;
        const dist = Math.hypot(dx, dy);

        if (origin.pointerType === "mouse") {
          if (dist < MOUSE_START_PX) return;
          beginDrag(e.currentTarget, e.pointerId, e.clientX, e.clientY);
        } else if (dist > TOUCH_AXIS_PX) {
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);

          // Vertical dominante → scroll de página. No preventDefault.
          if (absY >= absX) {
            abandonForPageScroll(e.currentTarget, e.pointerId);
            return;
          }

          // Horizontal: sólo si el rail realmente scrollea (carrusel).
          if (isHorizontallyScrollable(origin.rail)) {
            clearTimer();
            origin.scrolling = true;
            skipClickRef.current = true;
            capturePointer(e.currentTarget, e.pointerId);
            e.preventDefault();
            origin.rail!.scrollLeft = origin.railStartScroll - dx;
            return;
          }

          // Grilla sin overflow-x: cancelar long-press, no trabar el page scroll.
          clearTimer();
          return;
        } else {
          return;
        }
      }

      e.preventDefault();
      onDragMoveRef.current?.(e.clientX, e.clientY);
      onDragHoverRef.current(slotIndexFromPoint(e.clientX, e.clientY, slotAttr));
    },

    onPointerUp(e: PointerEvent<HTMLElement>) {
      const origin = originRef.current;
      if (!origin || origin.pointerId !== e.pointerId) {
        clearTimer();
        return;
      }
      releasePointer(e.currentTarget, e.pointerId);
      finishDrag(e.clientX, e.clientY);
    },

    onPointerCancel() {
      cancelDrag();
    },

    onContextMenu(e: MouseEvent<HTMLElement>) {
      e.preventDefault();
      if (originRef.current && originRef.current.pointerType !== "mouse") {
        e.stopPropagation();
      }
    },

    shouldSkipClick() {
      return skipClickRef.current;
    },
  };
}
