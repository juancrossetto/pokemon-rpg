"use client";

import { useEffect } from "react";
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
 */
export function CombatLockGate({ lock }: { lock: CombatLock }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!lock) return;
    if (isAllowedPath(pathname, lock)) return;
    if (lock.kind === "battle") {
      router.replace("/battle");
      return;
    }
    router.replace(`/gyms/${lock.gymId}/run`);
  }, [lock, pathname, router]);

  return null;
}
