"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Refresca los datos del servidor cada N segundos sin recargar la página.
 *
 * El dossier pedía Socket.io + Redis para el PvP en tiempo real. Eso necesita
 * un proceso de servidor propio que el App Router no mantiene (las route
 * handlers no sobreviven entre requests), así que sería montar un servidor
 * custom aparte. Para lo que el PvP necesita hoy —ver que alguien te desafió y
 * cómo quedó tu rating— un refresh incremental da el mismo resultado visible
 * sin sumar infraestructura. `router.refresh()` re-renderiza en el servidor y
 * hace diff en el cliente: no pierde estado ni scroll.
 */
export function LiveRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    // Sin sentido refrescar una pestaña que nadie está mirando.
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
