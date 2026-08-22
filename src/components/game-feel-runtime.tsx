"use client";

import { useEffect, useEffectEvent } from "react";
import { usePathname } from "@/i18n/navigation";
import {
  nativeFeedback,
  type NativeFeedbackKind,
} from "@/lib/native-feedback";

function interactiveTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(
    'button, a[href], [role="button"], [role="tab"], [role="switch"], summary',
  );
}

function feedbackKind(element: HTMLElement): NativeFeedbackKind {
  const explicit = element.dataset.feedback as NativeFeedbackKind | undefined;
  if (explicit) return explicit;
  if (element.matches("a[href]")) return "navigation";
  if (
    element.classList.contains("game-cta") ||
    element.classList.contains("ui-btn-primary") ||
    element.hasAttribute("data-autofocus")
  ) {
    return "confirm";
  }
  return "tap";
}

/**
 * Capa transversal de sensación nativa.
 *
 * Centraliza feedback para que cada botón nuevo nazca con respuesta física,
 * pero permite excluir controles delicados con `data-no-game-feel`.
 */
export function GameFeelRuntime() {
  const pathname = usePathname();

  const onActivate = useEffectEvent((event: PointerEvent) => {
    if (event.button !== 0) return;
    const element = interactiveTarget(event.target);
    if (!element || element.closest("[data-no-game-feel]")) return;
    if (
      element.matches(":disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.closest("[inert]")
    ) {
      return;
    }
    nativeFeedback(feedbackKind(element));
  });

  useEffect(() => {
    document.addEventListener("pointerdown", onActivate, { passive: true });
    return () => document.removeEventListener("pointerdown", onActivate);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.routeArriving = "";
    const timer = window.setTimeout(() => {
      delete html.dataset.routeArriving;
    }, 520);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
