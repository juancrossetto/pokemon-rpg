import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { MobileChrome } from "@/components/mobile-chrome";
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
        select: { coins: true, avatarId: true },
      })
    : null;
  const lock = combatLock;
  const lockedHref =
    lock?.kind === "battle" ? "/battle" : lock?.kind === "gym" ? `/gyms/${lock.gymId}/run` : null;
  const lockedLabel = lock?.kind === "battle" ? t("inBattle") : lock?.kind === "gym" ? t("inGym") : null;

  const primary = session?.user
    ? [
        { href: "/", label: t("home"), icon: "dashboard" },
        { href: "/team", label: t("teamShort"), icon: "group" },
        { href: "/battle", label: t("battle"), icon: "swords" },
        { href: "/gyms", label: t("gyms"), icon: "military_tech" },
      ]
    : [
        { href: "/", label: t("home"), icon: "dashboard" },
        { href: "/pokedex", label: t("pokedex"), icon: "auto_stories" },
      ];

  const moreLinks = session?.user
    ? [
        { href: "/pokedex", label: t("pokedex"), icon: "auto_stories" },
        { href: "/market", label: t("market"), icon: "storefront" },
        { href: "/pvp", label: t("pvp"), icon: "sports_mma" },
        { href: "/ranking", label: t("ranking"), icon: "trophy" },
        { href: "/clans", label: t("clans"), icon: "groups" },
        { href: "/pc", label: t("pc"), icon: "storage" },
      ]
    : [
        { href: "/login", label: t("login"), icon: "login" },
        { href: "/register", label: t("register"), icon: "person_add" },
      ];

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
          <div className="flex gap-1 ml-4 items-center flex-wrap">
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
                      href="/pvp"
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                    >
                      {t("pvp")}
                    </Link>
                    <Link
                      href="/gyms"
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                    >
                      {t("gyms")}
                    </Link>
                    <Link
                      href="/ranking"
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                    >
                      {t("ranking")}
                    </Link>
                    <Link
                      href="/clans"
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                    >
                      {t("clans")}
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
              avatarId={user?.avatarId ?? null}
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

      <MobileChrome
        brand={t("brand")}
        locale={locale}
        languageLabel={t("language")}
        coins={user?.coins ?? null}
        userName={session?.user ? (session.user.name ?? "?") : null}
        avatarId={user?.avatarId ?? null}
        logoutLabel={t("logout")}
        trainerLabel={t("trainer")}
        lockedHref={lockedHref}
        lockedLabel={lockedLabel}
        lockedIcon={lock?.kind === "gym" ? "military_tech" : "swords"}
        primary={primary}
        moreLinks={moreLinks}
        moreLabel={t("more")}
        loginLabel={t("login")}
        registerLabel={t("register")}
      />
    </>
  );
}
