"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

/** Long-press en touch/pen antes de reordenar. */
export const TOUCH_REORDER_MS = 280;
/** En mouse: arrancar el drag tras este desplazamiento. */
export const MOUSE_START_PX = 6;
/**
 * En touch: si el dedo se mueve más que esto ANTES del long-press,
 * asumimos scroll del rail (no cancelamos el pointer: lo manejamos nosotros).
 */
export const TOUCH_SCROLL_PX = 10;

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
 * Touch en un carrusel: el browser suele robar el gesto para scrollear y
 * dispara `pointercancel` — por eso sólo el primer Pokémon (sin scroll)
 * reordenaba. Acá capturamos el pointer al tocar y:
 * - sin mover mucho + long-press → drag
 * - mover en horizontal → scrolleamos el rail nosotros
 * - mouse → drag tras unos px
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
    try {
      target.setPointerCapture(pointerId);
    } catch {
      /* already released */
    }
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

      // Touch: capturar YA para que el browser no robe el gesto al scrollear
      // el carrusel (eso dejaba sólo usable la primera card).
      if (e.pointerType !== "mouse") {
        try {
          target.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
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
        const dist = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);

        if (origin.pointerType === "mouse") {
          if (dist < MOUSE_START_PX) return;
          beginDrag(e.currentTarget, e.pointerId, e.clientX, e.clientY);
        } else if (dist > TOUCH_SCROLL_PX) {
          // El usuario quiere scrollear el carrusel, no reordenar.
          clearTimer();
          origin.scrolling = true;
          skipClickRef.current = true;
          e.preventDefault();
          if (origin.rail) {
            const dx = e.clientX - origin.x;
            origin.rail.scrollLeft = origin.railStartScroll - dx;
          }
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
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
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
