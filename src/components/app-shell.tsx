import { Suspense, ViewTransition } from "react";
import { getMessages } from "next-intl/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { CombatLockGate } from "@/components/combat-lock-gate";
import { I18nClientProvider } from "@/components/i18n-client-provider";
import { FriendsRailHost } from "@/components/friends/friends-rail-host";
import { PresenceHeartbeat } from "@/components/friends/presence-heartbeat";
import { getAuthSession } from "@/lib/auth-session";
import { getUserSnapshot } from "@/lib/user-snapshot";
import { AppShellFallback } from "@/components/app-shell-fallback";
import {
  getCombatLock,
  enforceCombatLockInLayout,
  stripLocale,
  type CombatLock,
} from "@/lib/battle-lock";
import { GameRouteAtmosphere } from "@/components/game-route-atmosphere";

/**
 * Shell autenticado: auth + header.
 */
export async function AppShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [session, messages] = await Promise.all([getAuthSession(), getMessages()]);
  let showFriendsRail = false;
  let combatLock: CombatLock = null;
  if (session?.user?.id) {
    const [headerStore, user, lock] = await Promise.all([
      headers(),
      getUserSnapshot(session.user.id),
      getCombatLock(session.user.id),
    ]);
    combatLock = lock;
    const raw = headerStore.get("x-pathname") ?? "";
    let pathname = raw;
    try {
      if (raw.includes("://")) pathname = new URL(raw).pathname;
    } catch {
      /* keep raw */
    }
    const path = stripLocale(pathname);
    const onAuthPage = path === "/login" || path === "/register";

    if (!user && !onAuthPage) {
      const loginPath = `/${locale}/login`;
      redirect(
        `/api/auth/clear-stale-session?callbackUrl=${encodeURIComponent(loginPath)}`,
      );
    }
    if (user) {
      await enforceCombatLockInLayout(session.user.id, locale);
      showFriendsRail = !onAuthPage;
    }
  }
  // Combate, gimnasio y torre ocupan la pantalla: la columna taparía el ring.
  const friendsUserId =
    showFriendsRail && !combatLock ? session?.user?.id : undefined;

  return (
    <I18nClientProvider locale={locale} messages={messages}>
      <Providers>
        <CombatLockGate lock={combatLock} />
        <Suspense fallback={<AppShellFallback locale={locale} />}>
          <SiteHeader combatLock={combatLock} />
        </Suspense>
        {showFriendsRail ? <PresenceHeartbeat /> : null}
        {friendsUserId ? (
          <Suspense fallback={null}>
            <FriendsRailHost locale={locale} userId={friendsUserId} />
          </Suspense>
        ) : null}
        <div
          className={`app-main relative z-10 flex min-h-0 flex-1 flex-col pt-[calc(3.5rem+env(safe-area-inset-top))] xl:pt-14${
            session?.user ? " pb-bottom-nav" : ""
          }`}
        >
          <GameRouteAtmosphere />
          <ViewTransition name="game-route" default="game-route">
            <div className="game-route-content relative z-[1] flex min-h-0 flex-1 flex-col">
              {children}
            </div>
          </ViewTransition>
        </div>
      </Providers>
    </I18nClientProvider>
  );
}
