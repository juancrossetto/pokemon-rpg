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
import { countPendingRewards } from "@/lib/events/state";
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
    coins: t("coins"),
    coinsBalance: t("coinsBalance"),
    coinsShop: t("shop"),
    coinsMarket: t("market"),
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
  const pendingRewards = session?.user ? await countPendingRewards(session.user.id) : 0;
  const lock = combatLock;
  const lockedHref =
    lock?.kind === "battle" ? "/battle" : lock?.kind === "gym" ? `/gyms/${lock.gymId}/run` : null;
  const lockedLabel = lock?.kind === "battle" ? t("inBattle") : lock?.kind === "gym" ? t("inGym") : null;

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
    // Un único cálculo de pendientes alimenta desktop, mobile y el dropdown:
    // el brief pedía centralizarlo para no tener badges duplicados que se
    // contradigan entre superficies.
    badges: { eventsPending: pendingRewards },
  };

  /**
   * Bottom bar de mobile: Inicio + tres grupos frecuentes + Menú. Cada grupo
   * apunta a su primer destino, que es el de entrada natural de la sección
   * (Aventura → Viaje, Combate → Batalla salvaje, Colección → Mi equipo).
   */
  const primary = session?.user
    ? [
        { href: "/", label: t("home"), icon: "home" },
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
      <nav className="fixed top-0 w-full z-50 hidden h-16 xl:flex justify-between items-center gap-4 px-6 bg-background/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
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
            session?.user && (
              <NavLinks groups={NAV_GROUPS} labels={navLabels} />
            )
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
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
        trainerLabel={t("trainer")}
        lockedHref={lockedHref}
        lockedLabel={lockedLabel}
        lockedIcon={lock?.kind === "gym" ? "military_tech" : "swords"}
        primary={primary}
        groups={session?.user ? NAV_GROUPS : []}
        navLabels={navLabels}
        moreLabel={t("menu")}
        closeLabel={t("close")}
        loginLabel={t("login")}
        registerLabel={t("register")}
        notifications={notifications}
      />
    </>
  );
}
