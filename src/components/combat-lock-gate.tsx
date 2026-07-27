"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { CombatLock } from "@/lib/battle-lock";

function isAllowedPath(pathname: string, lock: NonNullable<CombatLock>): boolean {
  if (pathname === "/login" || pathname === "/register") return true;
  if (lock.kind === "battle") return pathname === "/battle";
  if (lock.kind === "gym") {
    return pathname === `/gyms/${lock.gymId}/run` || pathname === "/battle";
  }
  return true;
}

/**
 * Si el jugador está en combate / gym y hardcodea otra ruta en la URL,
 * lo mandamos de vuelta. Complementa los redirects de servidor en cada page.
 *
 * Evita bucles: si el lock de gym está stale (corrida ya cerrada) el server
 * redirige /run → ficha del gym, y sin tope el gate volvía a mandar a /run.
 */
export function CombatLockGate({ lock }: { lock: CombatLock }) {
  const pathname = usePathname();
  const router = useRouter();
  const lockKind = lock?.kind ?? null;
  const gymId = lock?.kind === "gym" ? lock.gymId : null;
  const bounceRef = useRef(0);

  useEffect(() => {
    bounceRef.current = 0;
  }, [lockKind, gymId]);

  useEffect(() => {
    if (!lockKind) return;
    const activeLock =
      lockKind === "gym" && gymId ? ({ kind: "gym", gymId } as const) : ({ kind: "battle" } as const);
    if (isAllowedPath(pathname, activeLock)) {
      bounceRef.current = 0;
      return;
    }

    if (bounceRef.current >= 2) {
      // Lock probablemente desactualizado tras abandonar/ganar — pedimos RSC fresco.
      router.refresh();
      return;
    }
    bounceRef.current += 1;

    if (lockKind === "battle") {
      if (pathname !== "/battle") router.replace("/battle");
      return;
    }
    const runPath = `/gyms/${gymId}/run`;
    if (pathname !== runPath) router.replace(runPath);
  }, [lockKind, gymId, pathname, router]);

  return null;
}
