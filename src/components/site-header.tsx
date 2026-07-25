import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentEnergy } from "@/lib/energy";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { MobileChrome } from "@/components/mobile-chrome";
import { NavLinks, type DesktopNavLink } from "@/components/nav-links";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { listNotifications } from "@/lib/notifications";
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
        select: {
          coins: true,
          avatarId: true,
          energy: true,
          energyMax: true,
          energyUpdatedAt: true,
        },
      })
    : null;
  const energy = user
    ? getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt)
    : null;
  const energyMax = user?.energyMax ?? null;
  const energyPct =
    energy !== null && energyMax !== null && energyMax > 0
      ? Math.max(0, Math.min(100, (energy / energyMax) * 100))
      : 0;
  const notifications = session?.user
    ? await listNotifications(session.user.id)
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
        { href: "/ranking", label: t("ranking"), icon: "trophy" },
        { href: "/login", label: t("login"), icon: "login" },
        { href: "/register", label: t("register"), icon: "person_add" },
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
    : [{ href: "/ranking", label: t("ranking") }];

  const desktopMoreLinks: DesktopNavLink[] = session?.user
    ? [
        { href: "/shop", label: t("shop"), icon: "storefront" },
        { href: "/pvp", label: t("pvp"), icon: "sports_mma" },
        { href: "/ranking", label: t("ranking"), icon: "trophy" },
        { href: "/clans", label: t("clans"), icon: "groups" },
        { href: "/pc", label: t("pc"), icon: "storage" },
        { href: "/inventory", label: t("inventory"), icon: "inventory_2" },
      ]
    : [];

  const moreLinks = session?.user
    ? [
        { href: "/pokedex", label: t("pokedex"), icon: "auto_stories" },
        { href: "/shop", label: t("shop"), icon: "storefront" },
        { href: "/pvp", label: t("pvp"), icon: "sports_mma" },
        { href: "/ranking", label: t("ranking"), icon: "trophy" },
        { href: "/clans", label: t("clans"), icon: "groups" },
        { href: "/pc", label: t("pc"), icon: "storage" },
        { href: "/inventory", label: t("inventory"), icon: "inventory_2" },
      ]
    : [];

  const brandHref = lockedHref ?? (session?.user ? "/" : "/login");

  return (
    <>
      {/* TopAppBar (desktop) */}
      <nav className="fixed top-0 w-full z-50 hidden h-16 md:flex justify-between items-center gap-4 px-6 bg-background/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="flex items-center min-w-0">
          <Link href={brandHref} className="shrink-0">
            <BrandLogo alt={t("brand")} priority sizes="80px" className="h-9 w-auto" />
          </Link>
          {lockedHref && lockedLabel ? (
            <div className="ml-4 flex items-center gap-1">
              <Link
                href={lockedHref}
                className="inline-flex items-center gap-1.5 rounded-md bg-pokeball-red/15 border border-pokeball-red/50 px-3 py-1 text-label-sm text-pokeball-red font-bold"
              >
                <span className="material-symbols-outlined text-[16px]!">
                  {lock?.kind === "gym" ? "military_tech" : "swords"}
                </span>
                {lockedLabel}
              </Link>
            </div>
          ) : (
            desktopLinks.length > 0 && (
              <NavLinks
                links={desktopLinks}
                moreLinks={desktopMoreLinks}
                moreLabel={t("more")}
              />
            )
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user && energy !== null && energyMax !== null && (
            <span
              className="flex flex-col gap-0.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-sky-300"
              title={t("energy")}
              aria-label={`${t("energy")}: ${energy}/${energyMax}`}
            >
              <span className="flex items-center gap-1 text-label-sm font-mono leading-none">
                <span className="material-symbols-outlined text-[16px]!">bolt</span>
                {energy}
                <span className="text-sky-300/55">/{energyMax}</span>
              </span>
              <span className="h-0.5 w-full overflow-hidden rounded-full bg-sky-400/20">
                <span
                  className="block h-full rounded-full bg-sky-400/80"
                  style={{ width: `${energyPct}%` }}
                />
              </span>
            </span>
          )}

          {user && (
            <span className="flex items-center gap-1 rounded-full border border-electric-yellow/25 bg-electric-yellow/10 px-2.5 py-1 text-label-sm text-electric-yellow font-mono">
              <span className="material-symbols-outlined text-[16px]!">paid</span>
              {user.coins}
            </span>
          )}

          <LocaleSwitcher currentLocale={locale} label={t("language")} />

          {session?.user && notifications && (
            <NotificationsBell
              initialItems={notifications.items}
              initialUnread={notifications.unreadCount}
            />
          )}

          {session?.user ? (
            <UserMenu
              name={session.user.name ?? "?"}
              avatarId={user?.avatarId ?? null}
              logoutLabel={t("logout")}
              trainerLabel={t("trainer")}
              teamLabel={t("teamShort")}
              inventoryLabel={t("inventory")}
              pcLabel={t("pc")}
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
                className="text-label-md rounded-md bg-pokeball-red px-3 py-1.5 text-white hover:bg-pokeball-red/80 transition-colors"
              >
                {t("register")}
              </Link>
            </div>
          )}
        </div>
      </nav>

      <MobileChrome
        brand={t("brand")}
        brandHref={brandHref}
        locale={locale}
        languageLabel={t("language")}
        energy={energy}
        energyMax={energyMax}
        energyLabel={t("energy")}
        coins={user?.coins ?? null}
        userName={session?.user ? (session.user.name ?? "?") : null}
        avatarId={user?.avatarId ?? null}
        logoutLabel={t("logout")}
        trainerLabel={t("trainer")}
        teamLabel={t("teamShort")}
        inventoryLabel={t("inventory")}
        pcLabel={t("pc")}
        lockedHref={lockedHref}
        lockedLabel={lockedLabel}
        lockedIcon={lock?.kind === "gym" ? "military_tech" : "swords"}
        primary={primary}
        moreLinks={moreLinks}
        moreLabel={t("more")}
        loginLabel={t("login")}
        registerLabel={t("register")}
        notifications={notifications}
      />
    </>
  );
}
