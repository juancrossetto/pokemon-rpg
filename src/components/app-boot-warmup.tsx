"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  clearBootSplashPending,
  hasAuthSessionCookie,
  markNavWarmupDone,
  peekBootSplashPending,
  peekNavWarmupDone,
} from "@/lib/boot-splash";
import { navWarmupHrefs } from "@/lib/navigation";

/** Tiempo mínimo visible para apreciar el video y leer el %. */
const MIN_VISIBLE_MS = 3200;
/** Tope duro: no dejar al jugador trabado si la red falla. */
const MAX_WAIT_MS = 12000;
/** Pausa entre prefetches para no saturar el hilo / la red. */
const PREFETCH_GAP_MS = 120;
/** Holgura final para que los RSC en vuelo terminen de cachearse. */
const SETTLE_MS = 400;
/** Cold start sin sesión: splash corto pero apreciable (tapa el blanco). */
const GUEST_VISIBLE_MS = 2200;

/** Evita re-prefetchar la misma ruta en el ciclo de vida de la pestaña. */
const prefetchedHrefs = new Set<string>();

function setSplashProgress(value: number) {
  const splash = document.getElementById("boot-splash");
  if (!splash) return;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  for (const fill of splash.querySelectorAll<HTMLElement>(".boot-splash-fill")) {
    fill.style.width = `${v}%`;
  }
  for (const pct of splash.querySelectorAll<HTMLElement>(".boot-splash-pct")) {
    pct.textContent = `${v}%`;
  }
  splash.setAttribute("aria-valuenow", String(v));
  splash.setAttribute("aria-label", `Cargando ${v}%`);
}

function showSplash() {
  const splash = document.getElementById("boot-splash");
  if (!splash) return;
  document.documentElement.classList.add("boot-splash-pending");
  document.documentElement.classList.remove("boot-splash-done");
  splash.classList.remove("boot-splash--out");
  splash.setAttribute("aria-hidden", "false");
  splash.setAttribute("aria-busy", "true");
  setSplashProgress(0);
}

function hideSplash() {
  const splash = document.getElementById("boot-splash");
  clearBootSplashPending();
  markNavWarmupDone();
  setSplashProgress(100);
  for (const video of splash?.querySelectorAll("video") ?? []) {
    video.pause();
  }
  window.setTimeout(() => {
    splash?.classList.add("boot-splash--out");
    splash?.setAttribute("aria-busy", "false");
    splash?.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("boot-splash-pending");
    document.documentElement.classList.add("boot-splash-done");
  }, 320);
}

function dismissSplashWithoutWarmup() {
  clearBootSplashPending();
  document.documentElement.classList.remove("boot-splash-pending");
  document.documentElement.classList.add("boot-splash-done");
  document.getElementById("boot-splash")?.classList.add("boot-splash--out");
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Al abrir la app (una vez por sesión): muestra Charizard en mobile / Pokéball
 * en desktop con barra de %, y detrás precarga todas las pantallas de la nav.
 *
 * El splash ya puede estar visible desde el HTML/SSR (evita lienzo blanco).
 * Acá decidimos si hacemos warmup bloqueante o lo cerramos al toque.
 */
export function AppBootWarmup() {
  const router = useRouter();
  const pathname = usePathname();
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/register") {
      dismissSplashWithoutWarmup();
      return;
    }

    if (peekNavWarmupDone()) {
      dismissSplashWithoutWarmup();
      return;
    }

    const needsBlockingWarmup =
      peekBootSplashPending() || hasAuthSessionCookie();

    // Cold start sin sesión: el banner ya tapó el blanco; dejamos apreciar el video.
    if (!needsBlockingWarmup) {
      showSplash();
      const startedAt = performance.now();
      let cancelled = false;
      const tick = window.setInterval(() => {
        if (cancelled) return;
        const t = Math.min(1, (performance.now() - startedAt) / GUEST_VISIBLE_MS);
        setSplashProgress(t * 100);
      }, 80);
      const t = window.setTimeout(() => {
        window.clearInterval(tick);
        setSplashProgress(100);
        hideSplash();
      }, GUEST_VISIBLE_MS);
      return () => {
        cancelled = true;
        window.clearInterval(tick);
        window.clearTimeout(t);
      };
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    const saveData = Boolean(connection?.saveData);

    let cancelled = false;
    let finished = false;
    const startedAt = performance.now();

    const finish = () => {
      if (finished || cancelled) return;
      finished = true;
      hideSplash();
    };

    showSplash();

    prefetchedHrefs.add(pathname);
    const hrefs = navWarmupHrefs().filter((href) => !prefetchedHrefs.has(href));
    const total = Math.max(1, hrefs.length);

    async function run() {
      if (saveData) {
        setSplashProgress(100);
        const elapsed = performance.now() - startedAt;
        if (elapsed < MIN_VISIBLE_MS) await sleep(MIN_VISIBLE_MS - elapsed);
        finish();
        return;
      }

      for (let i = 0; i < hrefs.length; i++) {
        if (cancelled) return;
        if (performance.now() - startedAt > MAX_WAIT_MS) break;

        const href = hrefs[i];
        prefetchedHrefs.add(href);
        try {
          router.prefetch(href);
        } catch {
          /* prefetch best-effort */
        }

        setSplashProgress(((i + 1) / total) * 100);
        await sleep(PREFETCH_GAP_MS);
      }

      setSplashProgress(100);
      await sleep(SETTLE_MS);

      const elapsed = performance.now() - startedAt;
      if (elapsed < MIN_VISIBLE_MS) await sleep(MIN_VISIBLE_MS - elapsed);
      finish();
    }

    const maxTimer = window.setTimeout(finish, MAX_WAIT_MS);

    void run().finally(() => {
      window.clearTimeout(maxTimer);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(maxTimer);
      // Strict Mode: si no terminamos, permitir reintentar en el remount.
      if (!peekNavWarmupDone()) inFlightRef.current = false;
    };
  }, [pathname, router]);

  return null;
}
