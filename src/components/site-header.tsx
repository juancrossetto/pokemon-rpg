import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentEnergy } from "@/lib/energy";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { MobileChrome } from "@/components/mobile-chrome";
import { ResourceBar, type ResourceBarLabels } from "@/components/resource-bar";
import { NavLinks, type NavLabels } from "@/components/nav-links";
import { MOBILE_BAR_GROUPS, NAV_GROUPS, visibleChildren } from "@/lib/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { listNotifications } from "@/lib/notifications";
import type { CombatLock } from "@/lib/battle-lock";
import { HandbookHost } from "@/components/handbook/handbook-modal";
import { HandbookTrigger } from "@/components/handbook/handbook-trigger";

export async function SiteHeader({ combatLock }: { combatLock: CombatLock }) {
  const [t, tUx, tHandbook, session, locale] = await Promise.all([
    getTranslations("nav"),
    getTranslations("ux"),
    getTranslations("handbook"),
    auth(),
    getLocale(),
  ]);
  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          coins: true,
          gems: true,
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
  const resourceLabels: ResourceBarLabels = {
    energy: t("energy"),
    energyFull: t("energyFull"),
    // Estas dos viajan como plantilla, no como texto final: `ResourceBar` es
    // un componente de cliente y reemplaza `{minutes}` y `{time}` con el
    // contador que calcula cada segundo. Pasarle el propio marcador como valor
    // deja el literal intacto y evita el FORMATTING_ERROR de next-intl, que
    // exige un valor para cada variable ICU.
    energyRegen: t("energyRegen", { minutes: "{minutes}" }),
    energyNext: t("energyNext", { time: "{time}" }),
    energyEmptyTitle: tUx("energyEmptyTitle"),
    energyEmptyBody: tUx("energyEmptyBody"),
    energyEmptyWait: tUx("energyEmptyWait"),
    energyEmptyShop: tUx("energyEmptyShop"),
    energyEmptyRewards: tUx("energyEmptyRewards"),
    energyEmptyTeam: tUx("energyEmptyTeam"),
    energyCostsTitle: tUx("energyCostsTitle"),
    energyCostExplore: tUx("energyCostExplore"),
    energyCostGym: tUx("energyCostGym"),
    energyCostPvp: tUx("energyCostPvp"),
    energyPacing: tUx("energyPacing"),
    coins: t("coins"),
    coinsBalance: t("coinsBalance"),
    coinsShop: t("shop"),
    coinsMarket: t("marketPlayers"),
    gems: t("gems"),
    gemsBalance: t("gemsBalance"),
    gemsHint: t("gemsHint"),
    gemsPc: t("pc"),
    close: t("close"),
    resources: t("resources"),
    add: t("resourceAdd"),
  };
  const notifications = session?.user
    ? await listNotifications(session.user.id)
    : null;
  const lock = combatLock;
  const lockedHref =
    lock?.kind === "battle"
      ? "/battle"
      : lock?.kind === "gym"
        ? `/gyms/${lock.gymId}/run`
        : lock?.kind === "tower"
          ? "/tower"
          : null;
  const lockedLabel =
    lock?.kind === "battle"
      ? t("inBattle")
      : lock?.kind === "gym"
        ? t("inGym")
        : lock?.kind === "tower"
          ? t("inTower")
          : null;

  /**
   * Etiquetas de la navegación, resueltas una sola vez en el servidor. Los
   * componentes de navegación son de cliente y no pueden llamar a `t`, así que
   * reciben el diccionario ya traducido en vez de repetir claves.
   */
  const navLabels: NavLabels = {
    text: {
      navigation: t("navigation"),
      ...Object.fromEntries(
        NAV_GROUPS.flatMap((group) => [
          [group.labelKey, t(group.labelKey)],
          ...visibleChildren(group).map((child) => [child.labelKey, t(child.labelKey)] as const),
        ]),
      ),
    },
    description: Object.fromEntries(
      NAV_GROUPS.flatMap((group) =>
        visibleChildren(group).flatMap((child) =>
          child.descriptionKey ? [[child.id, t(child.descriptionKey)] as const] : [],
        ),
      ),
    ),
    home: t("home"),
    soon: t("soon"),
    // Eventos ya no está en la nav: sus pendientes se muestran en el home
    // (quick action + widget), así que no hay badges que calcular acá.
    badges: {},
  };

  /**
   * Bottom bar de mobile: Inicio + tres grupos frecuentes + Menú. Cada grupo
   * apunta a su primer destino, que es el de entrada natural de la sección
   * (Aventura → Viaje, Combate → Batalla salvaje, Colección → Mi equipo).
   */
  const primary = session?.user
    ? [
        { href: "/", label: t("home"), icon: "home", iconSrc: "/nav/home-icon.png?v=4" },
        ...MOBILE_BAR_GROUPS.flatMap((id) => {
          const group = NAV_GROUPS.find((g) => g.id === id);
          const first = group ? visibleChildren(group)[0] : undefined;
          return group && first
            ? [
                {
                  href: first.href,
                  label: t(group.labelKey),
                  icon: group.icon,
                  groupId: group.id,
                  ...(group.id === "combat"
                    ? { iconSrc: "/nav/battle-icon.png?v=4" }
                    : group.id === "adventure"
                      ? { iconSrc: "/nav/adventure-icon.png?v=4" }
                      : group.id === "collection"
                        ? { iconSrc: "/nav/collection-icon.png?v=4" }
                        : {}),
                },
              ]
            : [];
        }),
      ]
    : [
        { href: "/ranking", label: t("ranking"), icon: "trophy" },
        { href: "/login", label: t("login"), icon: "login" },
        { href: "/register", label: t("register"), icon: "person_add" },
      ];

  const brandHref = lockedHref ?? (session?.user ? "/" : "/login");

  return (
    <>
      {/* TopAppBar (desktop) */}
      {/*
        El navbar completo entra recién en `lg`. Medido: el cluster izquierdo
        (logo + 6 categorías) pide ~650px y el derecho (recursos + idioma +
        campana + avatar) ~340px. Estaba activándose en `md` (768px), donde
        "Combate" se montaba encima del medidor de energía y "Comunidad" sobre
        el avatar. A 1024 entraba por 17px, que es lo mismo que no entrar: con
        las etiquetas en inglés o portugués vuelve a romperse. Así que el
        navbar completo va desde `xl`, y de 768 a 1279 manda el chrome táctil
        —bottom bar + drawer— que consume la misma configuración de grupos.
      */}
      <nav className="fixed top-0 z-50 hidden h-14 w-full items-center justify-between gap-4 border-b border-white/[0.07] bg-[#0b0d13]/85 px-5 shadow-[0_8px_28px_rgba(0,0,0,0.32)] backdrop-blur-2xl xl:flex">
        <div className="flex min-w-0 items-center">
          <Link href={brandHref} className="shrink-0">
            <BrandLogo alt={t("brand")} priority sizes="72px" className="h-8 w-auto" />
          </Link>
          {lockedHref && lockedLabel ? (
            <div className="ml-4 flex items-center gap-1">
              <Link
                href={lockedHref}
                className="inline-flex items-center gap-1.5 rounded-md border border-pokeball-red/50 bg-pokeball-red/15 px-3 py-1 text-label-sm font-bold text-pokeball-red"
              >
                <span className="material-symbols-outlined text-[16px]!">
                  {lock?.kind === "gym" ? "military_tech" : "swords"}
                </span>
                {lockedLabel}
              </Link>
            </div>
          ) : (
            session?.user && <NavLinks groups={NAV_GROUPS} labels={navLabels} />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {user && energy !== null && energyMax !== null && (
            <ResourceBar
              energy={energy}
              energyMax={energyMax}
              energyUpdatedAt={user.energyUpdatedAt.toISOString()}
              coins={user.coins}
              gems={user.gems}
              labels={resourceLabels}
              variant="desktop"
            />
          )}

          <LocaleSwitcher currentLocale={locale} label={t("language")} />

          {session?.user && <HandbookTrigger />}

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
              profileLabel={t("profile")}
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
        energyUpdatedAt={user?.energyUpdatedAt.toISOString() ?? null}
        coins={user?.coins ?? null}
        gems={user?.gems ?? null}
        resourceLabels={resourceLabels}
        userName={session?.user ? (session.user.name ?? "?") : null}
        avatarId={user?.avatarId ?? null}
        logoutLabel={t("logout")}
        profileLabel={t("profile")}
        lockedHref={lockedHref}
        lockedLabel={lockedLabel}
        lockedIcon={lock?.kind === "gym" ? "military_tech" : "swords"}
        primary={primary}
        groups={session?.user ? NAV_GROUPS : []}
        navLabels={navLabels}
        moreLabel={t("menu")}
        closeLabel={t("close")}
        shortcutsLabel={t("shortcuts")}
        retapHint={t("retapHint")}
        seeAllNavLabel={t("seeAllNav")}
        emptyNavLabel={t("emptyNav")}
        swipeGroupsLabel={t("swipeGroups")}
        handbookLabel={tHandbook("open")}
        loginLabel={t("login")}
        registerLabel={t("register")}
        notifications={notifications}
      />

      {session?.user && <HandbookHost />}
    </>
  );
}
