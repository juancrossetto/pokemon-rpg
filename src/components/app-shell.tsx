import { getMessages } from "next-intl/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { CombatLockGate } from "@/components/combat-lock-gate";
import { I18nClientProvider } from "@/components/i18n-client-provider";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCombatLock, enforceCombatLockInLayout, stripLocale } from "@/lib/battle-lock";

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
  const session = await auth();
  if (session?.user?.id) {
    const headerStore = await headers();
    const raw = headerStore.get("x-pathname") ?? "";
    let pathname = raw;
    try {
      if (raw.includes("://")) pathname = new URL(raw).pathname;
    } catch {
      /* keep raw */
    }
    const path = stripLocale(pathname);
    const onAuthPage = path === "/login" || path === "/register";

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (!user && !onAuthPage) {
      const loginPath = `/${locale}/login`;
      redirect(
        `/api/auth/clear-stale-session?callbackUrl=${encodeURIComponent(loginPath)}`,
      );
    }
    if (user) {
      await enforceCombatLockInLayout(session.user.id, locale);
    }
  }
  const combatLock = session?.user ? await getCombatLock(session.user.id) : null;
  const messages = await getMessages();

  return (
    <I18nClientProvider locale={locale} messages={messages}>
      <Providers>
        <CombatLockGate lock={combatLock} />
        <SiteHeader combatLock={combatLock} />
        <div
          className={`app-main relative z-10 flex min-h-0 flex-1 flex-col pt-[calc(3.5rem+env(safe-area-inset-top))] xl:pt-14${
            session?.user ? " pb-bottom-nav" : ""
          }`}
        >
          {children}
        </div>
      </Providers>
    </I18nClientProvider>
  );
}
