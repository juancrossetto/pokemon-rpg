"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";
import {
  clearBootSplashPending,
  markNavWarmupDone,
  peekNavWarmupDone,
} from "@/lib/boot-splash";

function setSplashProgress(value: number) {
  const splash = document.getElementById("boot-splash");
  if (!splash) return;
  const progress = Math.max(0, Math.min(100, Math.round(value)));
  for (const fill of splash.querySelectorAll<HTMLElement>(".boot-splash-fill")) {
    fill.style.width = `${progress}%`;
  }
  for (const label of splash.querySelectorAll<HTMLElement>(".boot-splash-pct")) {
    label.textContent = `${progress}%`;
  }
  splash.setAttribute("aria-valuenow", String(progress));
  splash.setAttribute("aria-label", `Cargando ${progress}%`);
}

function dismissSplash() {
  const splash = document.getElementById("boot-splash");
  clearBootSplashPending();
  markNavWarmupDone();
  setSplashProgress(100);
  for (const video of splash?.querySelectorAll("video") ?? []) video.pause();
  splash?.classList.add("boot-splash--out");
  splash?.setAttribute("aria-busy", "false");
  splash?.setAttribute("aria-hidden", "true");
  document.documentElement.classList.remove("boot-splash-pending");
  document.documentElement.classList.add("boot-splash-done");
}

/**
 * El splash sólo cubre el arranque real del shell autenticado.
 *
 * Next 16 ya agenda el prefetch de links visibles e intención del usuario. El
 * antiguo warmup recorría todas las pantallas y mantenía el juego bloqueado
 * entre 5,5 y 12 segundos, incluso cuando el home ya estaba listo. Al montar
 * este componente el shell y sus providers ya llegaron: se libera en el
 * siguiente frame y las rutas quedan a cargo del scheduler nativo de Next.
 */
export function AppBootWarmup() {
  const pathname = usePathname();
  const releaseFrame = useRef<number | null>(null);

  useEffect(() => {
    if (peekNavWarmupDone()) {
      dismissSplash();
      return;
    }

    const firstFrame = requestAnimationFrame(() => {
      setSplashProgress(100);
      releaseFrame.current = requestAnimationFrame(dismissSplash);
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (releaseFrame.current !== null) cancelAnimationFrame(releaseFrame.current);
      releaseFrame.current = null;
    };
  }, [pathname]);

  return null;
}
