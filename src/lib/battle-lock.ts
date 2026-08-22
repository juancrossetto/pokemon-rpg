import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { routing } from "@/i18n/routing";

/** ¿Hay una BattleSession ACTIVE? (encuentro o gimnasio). */
export async function hasActiveBattle(userId: string): Promise<boolean> {
  const battle = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
  });
  return battle !== null;
}

/** Corrida de gimnasio ACTIVE (pasillo entre combates o durante uno). */
export async function getActiveGymRun(
  userId: string,
): Promise<{ id: string; gymId: string } | null> {
  return prisma.gymRun.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, gymId: true },
  });
}

/** Intento de Torre abierto (incluye pausado). */
export async function getActiveTowerRun(
  userId: string,
  opts?: { includeParked?: boolean },
): Promise<{ id: string; parkedAt: Date | null } | null> {
  return prisma.towerRun.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "AWAITING_BLESSING", "RESTING"] },
      ...(opts?.includeParked ? {} : { parkedAt: null }),
    },
    select: { id: true, parkedAt: true },
  });
}

export type CombatLock =
  | { kind: "battle" }
  | { kind: "gym"; gymId: string }
  | { kind: "tower" }
  | null;

/**
 * Prioriza batalla ACTIVE; si no, corrida de gym ACTIVE; si no, torre.
 *
 * Envuelto en `cache()` de React: el layout lo pide dos veces (guard + prop
 * para el header) y cada página una más vía `redirectIfInBattle`. Sin esto son
 * 6 queries por request donde alcanzan 2 — el lock no puede cambiar en medio
 * del mismo render. La memoización dura solo lo que dura el request.
 */
export const getCombatLock = cache(async (userId: string): Promise<CombatLock> => {
  // Son lecturas independientes. En un pool remoto hacerlas en serie añadía
  // hasta tres idas y vueltas antes de poder pintar cualquier página.
  const [battle, gym, tower] = await Promise.all([
    hasActiveBattle(userId),
    getActiveGymRun(userId),
    getActiveTowerRun(userId, { includeParked: false }),
  ]);
  if (battle) return { kind: "battle" };
  if (gym) return { kind: "gym", gymId: gym.gymId };
  // Pausado = se puede salir a Aventura; no bloquea el resto del juego.
  if (tower) return { kind: "tower" };
  return null;
});

export function stripLocale(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  if ((routing.locales as readonly string[]).includes(parts[0])) {
    const rest = parts.slice(1).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function isAllowedDuringLock(path: string, lock: NonNullable<CombatLock>): boolean {
  if (path === "/login" || path === "/register") return true;
  if (lock.kind === "battle") return path === "/battle";
  if (lock.kind === "tower") return path === "/tower" || path === "/battle";
  return path === `/gyms/${lock.gymId}/run` || path === "/battle";
}

/**
 * Si el jugador está en combate o en un desafío de gimnasio, redirige
 * a /battle o al pasillo del gym. Usar al inicio de páginas que no
 * deben ser accesibles mid-fight / mid-challenge (team, PC, market…).
 */
export async function redirectIfInBattle(userId: string, locale: string): Promise<void> {
  const lock = await getCombatLock(userId);
  if (lock?.kind === "battle") {
    redirect({ href: "/battle", locale });
  }
  if (lock?.kind === "gym") {
    redirect({ href: `/gyms/${lock.gymId}/run`, locale });
  }
  if (lock?.kind === "tower") {
    redirect({ href: "/tower", locale });
  }
}

/**
 * Guard central: lee el path del request (header x-pathname del proxy)
 * y redirige si la ruta no está permitida durante combate/gym.
 * Llamar desde el layout de locale.
 */
export async function enforceCombatLockInLayout(
  userId: string,
  locale: string,
): Promise<void> {
  const lock = await getCombatLock(userId);
  if (!lock) return;

  const headerStore = await headers();
  const raw =
    headerStore.get("x-pathname") ??
    headerStore.get("next-url") ??
    headerStore.get("x-url") ??
    "";
  if (!raw) return;

  let pathname = raw;
  try {
    if (raw.includes("://")) pathname = new URL(raw).pathname;
  } catch {
    /* keep raw */
  }
  const path = stripLocale(pathname);
  if (isAllowedDuringLock(path, lock)) return;

  if (lock.kind === "battle") {
    redirect({ href: "/battle", locale });
  } else if (lock.kind === "tower") {
    redirect({ href: "/tower", locale });
  } else {
    redirect({ href: `/gyms/${lock.gymId}/run`, locale });
  }
}

/** Igual que redirectIfInBattle; retorna true si redirigió (para actions). */
export async function blockIfInCombat(userId: string, locale: string): Promise<boolean> {
  const lock = await getCombatLock(userId);
  if (lock?.kind === "battle") {
    redirect({ href: "/battle", locale });
    return true;
  }
  if (lock?.kind === "gym") {
    redirect({ href: `/gyms/${lock.gymId}/run`, locale });
    return true;
  }
  if (lock?.kind === "tower") {
    redirect({ href: "/tower", locale });
    return true;
  }
  return false;
}

/** Revalida layout (navbar) cuando empieza/termina un combate.
 *  No revalida `/battle`: al cerrar la sesión ACTIVE un refresh RSC
 *  redirigía a `/gyms/.../run` a mitad de la animación de KO. */
export function revalidateCombatUi(locale: string) {
  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/gyms`);
  revalidatePath(`/${locale}/tower`);
}
