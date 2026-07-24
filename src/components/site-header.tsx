import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import type { CombatLock } from "@/lib/battle-lock";

export async function SiteHeader({ combatLock }: { combatLock: CombatLock }) {
  const [t, session, locale] = await Promise.all([
    getTranslations("nav"),
    auth(),
    getLocale(),
  ]);
  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { coins: true },
      })
    : null;
  const lock = combatLock;
  const lockedHref =
    lock?.kind === "battle" ? "/battle" : lock?.kind === "gym" ? `/gyms/${lock.gymId}/run` : null;
  const lockedLabel = lock?.kind === "battle" ? t("inBattle") : lock?.kind === "gym" ? t("inGym") : null;

  return (
    <>
      {/* TopAppBar (desktop) */}
      <nav className="fixed top-0 w-full z-50 hidden md:flex justify-between items-center px-6 py-2 bg-background/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={lockedHref ?? "/"}
            className="text-headline-lg font-black text-pokeball-red tracking-tighter shrink-0"
          >
            {t("brand")}
          </Link>
          <div className="flex gap-1 ml-4 items-center">
            {lockedHref && lockedLabel ? (
              <Link
                href={lockedHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-pokeball-red/15 border border-pokeball-red/50 px-3 py-1 text-label-sm text-pokeball-red font-bold"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {lock?.kind === "gym" ? "military_tech" : "swords"}
                </span>
                {lockedLabel}
              </Link>
            ) : (
              <>
                <Link
                  href="/pokedex"
                  className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                >
                  {t("pokedex")}
                </Link>
                {session?.user && (
                  <>
                    <Link
                      href="/team"
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                    >
                      {t("team")}
                    </Link>
                    <Link
                      href="/battle"
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                    >
                      {t("battle")}
                    </Link>
                    <Link
                      href="/gyms"
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                    >
                      {t("gyms")}
                    </Link>
                    <Link
                      href="/market"
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                    >
                      {t("market")}
                    </Link>
                    <Link
                      href="/pc"
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                    >
                      {t("pc")}
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <span className="flex items-center gap-1 text-label-md text-electric-yellow font-mono">
              <span className="material-symbols-outlined text-[16px]">paid</span>
              {user.coins}
            </span>
          )}

          <LocaleSwitcher currentLocale={locale} label={t("language")} />

          {session?.user ? (
            <UserMenu
              name={session.user.name ?? "?"}
              logoutLabel={t("logout")}
              trainerLabel={t("trainer")}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
              >
                {t("login")}
              </Link>
              <Link
                href="/register"
                className="text-label-md rounded-lg bg-pokeball-red px-3 py-1 text-white hover:bg-pokeball-red/80 transition-colors"
              >
                {t("register")}
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* BottomNavBar (mobile) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex md:hidden items-stretch h-14 bg-background/98 backdrop-blur-xl border-t border-white/10 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        {lockedHref && lockedLabel ? (
          <Link
            href={lockedHref}
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 text-pokeball-red"
          >
            <span className="material-symbols-outlined text-[22px]">
              {lock?.kind === "gym" ? "military_tech" : "swords"}
            </span>
            <span className="text-[10px] leading-none truncate max-w-full font-bold">{lockedLabel}</span>
          </Link>
        ) : (
          <>
            <Link
              href="/"
              className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 text-pokeball-red"
            >
              <span className="material-symbols-outlined text-[22px]">dashboard</span>
              <span className="text-[10px] leading-none truncate max-w-full">{t("home")}</span>
            </Link>
            <Link
              href="/pokedex"
              className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 text-on-surface-variant hover:text-pokeball-red transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">auto_stories</span>
              <span className="text-[10px] leading-none truncate max-w-full">{t("pokedex")}</span>
            </Link>
            {session?.user && (
              <>
                <Link
                  href="/team"
                  className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 text-on-surface-variant hover:text-pokeball-red transition-colors"
                >
                  <span className="material-symbols-outlined text-[22px]">group</span>
                  <span className="text-[10px] leading-none truncate max-w-full">{t("teamShort")}</span>
                </Link>
                <Link
                  href="/battle"
                  className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 text-on-surface-variant hover:text-pokeball-red transition-colors"
                >
                  <span className="material-symbols-outlined text-[22px]">swords</span>
                  <span className="text-[10px] leading-none truncate max-w-full">{t("battle")}</span>
                </Link>
                <Link
                  href="/market"
                  className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 text-on-surface-variant hover:text-pokeball-red transition-colors"
                >
                  <span className="material-symbols-outlined text-[22px]">storefront</span>
                  <span className="text-[10px] leading-none truncate max-w-full">{t("market")}</span>
                </Link>
                <Link
                  href="/gyms"
                  className="flex flex-col items-center justify-center text-on-surface-variant hover:text-pokeball-red transition-colors px-4 py-1 text-label-sm"
                >
                  <span className="material-symbols-outlined">military_tech</span>
                  {t("gyms")}
                </Link>
              </>
            )}
          </>
        )}
      </nav>
    </>
  );
}
