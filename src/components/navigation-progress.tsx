"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { PokeballLoader } from "@/components/pokeball-loader";

/**
 * Feedback inmediato al toque (atenúa el main). Por debajo de ~100ms el
 * cambio se lee como respuesta directa; evita la sensación de app congelada
 * mientras llega el RSC.
 */
const DIM_DELAY_MS = 80;
/**
 * Umbral del Pokéball. Por debajo se percibe como respuesta directa; por
 * encima el usuario necesita el spinner de siempre.
 */
const SHOW_DELAY_MS = 280;
/** Fade-out del overlay al completar la navegación. */
const HIDE_MS = 180;

function setNavPendingAttr(on: boolean) {
  if (on) {
    document.documentElement.dataset.navPending = "";
  } else {
    delete document.documentElement.dataset.navPending;
  }
}

/**
 * Navegación tipo app nativa: la pantalla actual se queda hasta que llega
 * la nueva. Al toque se atenúa el contenido; si tarda de verdad, aparece el
 * mismo Pokéball de siempre como overlay (sin desmontar la ruta).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const t = useTranslations("loading");
  const [phase, setPhase] = useState<"idle" | "pending" | "done">("idle");
  const dimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const visibleRef = useRef(false);

  const clearTimers = () => {
    if (dimTimerRef.current) {
      clearTimeout(dimTimerRef.current);
      dimTimerRef.current = null;
    }
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const start = useEffectEvent(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    clearTimers();

    dimTimerRef.current = setTimeout(() => {
      dimTimerRef.current = null;
      setNavPendingAttr(true);
    }, DIM_DELAY_MS);

    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      visibleRef.current = true;
      setNavPendingAttr(true);
      setPhase("pending");
    }, SHOW_DELAY_MS);
  });

  const finish = useEffectEvent(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimers();
    setNavPendingAttr(false);

    if (!visibleRef.current) {
      setPhase("idle");
      return;
    }

    visibleRef.current = false;
    setPhase("done");
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setPhase("idle");
    }, HIDE_MS);
  });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      start();
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      finish();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(
    () => () => {
      clearTimers();
      setNavPendingAttr(false);
    },
    [],
  );

  if (phase === "idle") return null;

  return (
    <div
      className="nav-pending"
      data-phase={phase}
      role="status"
      aria-live="polite"
      aria-busy={phase === "pending"}
    >
      <div className="nav-pending__scrim" aria-hidden />
      <PokeballLoader label={t("syncing")} />
    </div>
  );
}
