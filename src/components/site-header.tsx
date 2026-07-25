import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { MobileChrome } from "@/components/mobile-chrome";
import { NavLinks, type DesktopNavLink } from "@/components/nav-links";
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
        { href: "/", label: t("home"), icon: "home" },
        { href: "/battle", label: t("battle"), icon: "swords" },
        { href: "/gyms", label: t("gyms"), icon: "military_tech" },
        { href: "/market", label: t("market"), icon: "storefront" },
      ]
    : [
        { href: "/", label: t("home"), icon: "home" },
        { href: "/pokedex", label: t("pokedex"), icon: "auto_stories" },
      ];

  // Desktop: Home primero; Equipo vive en el menú del avatar.
  const desktopLinks: DesktopNavLink[] = session?.user
    ? [
        { href: "/", label: t("home") },
        { href: "/market", label: t("market") },
        { href: "/battle", label: t("battle") },
        { href: "/gyms", label: t("gyms") },
        { href: "/pokedex", label: t("pokedex") },
      ]
    : [
        { href: "/", label: t("home") },
        { href: "/pokedex", label: t("pokedex") },
      ];

  const desktopMoreLinks: DesktopNavLink[] = session?.user
    ? [
        { href: "/pvp", label: t("pvp"), icon: "sports_mma" },
        { href: "/ranking", label: t("ranking"), icon: "trophy" },
        { href: "/clans", label: t("clans"), icon: "groups" },
        { href: "/pc", label: t("pc"), icon: "storage" },
      ]
    : [];

  const moreLinks = session?.user
    ? [
        { href: "/pokedex", label: t("pokedex"), icon: "auto_stories" },
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
      <nav className="fixed top-0 w-full z-50 hidden h-16 md:flex justify-between items-center gap-4 px-6 bg-background/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="flex items-center min-w-0">
          <Link
            href={lockedHref ?? "/"}
            className="text-headline-lg font-black text-pokeball-red tracking-tighter shrink-0"
          >
            {t("brand")}
          </Link>
          {lockedHref && lockedLabel ? (
            <div className="ml-4 flex items-center gap-1">
              <Link
                href={lockedHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-pokeball-red/15 border border-pokeball-red/50 px-3 py-1 text-label-sm text-pokeball-red font-bold"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {lock?.kind === "gym" ? "military_tech" : "swords"}
                </span>
                {lockedLabel}
              </Link>
            </div>
          ) : (
            <NavLinks
              links={desktopLinks}
              moreLinks={desktopMoreLinks}
              moreLabel={t("more")}
            />
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <span className="flex items-center gap-1 rounded-full border border-electric-yellow/25 bg-electric-yellow/10 px-2.5 py-1 text-label-sm text-electric-yellow font-mono">
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
              teamLabel={t("teamShort")}
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
        teamLabel={t("teamShort")}
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
