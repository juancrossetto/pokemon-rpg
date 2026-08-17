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
import {
  findNavItem,
  MOBILE_BAR_SLOTS,
  NAV_GROUPS,
  visibleChildren,
} from "@/lib/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { listNotifications } from "@/lib/notifications";
import type { CombatLock } from "@/lib/battle-lock";
import { getActiveTowerRun } from "@/lib/battle-lock";
import { HandbookHost } from "@/components/handbook/handbook-modal";
import { HandbookTrigger } from "@/components/handbook/handbook-trigger";
import { FriendsRailToggle } from "@/components/friends/friends-rail-toggle";
import { CombatLockChip, type CombatLockKind } from "@/components/combat-lock-chip";

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
    energyFullToast: t("energyFullToast"),
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
  const activeTowerRun = session?.user?.id
    ? await getActiveTowerRun(session.user.id, { includeParked: true })
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
  const lockedHint = lockedHref ? t("lockedNavHint") : null;
  const lockedReturn = lockedHref ? t("lockedNavReturn") : null;
  const lockedKind: CombatLockKind | null =
    lock?.kind === "battle" || lock?.kind === "gym" || lock?.kind === "tower"
      ? lock.kind
      : null;
  const lockedIconSrc =
    lock?.kind === "gym"
      ? "/nav/gym-icon.png?v=4"
      : lock?.kind === "tower"
        ? "/nav/tower-icon.png?v=4"
        : lock?.kind === "battle"
          ? "/nav/battle-icon.png?v=4"
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
   * Bottom bar de mobile: Inicio + Aventura + Combate + Bag + Menú.
   * Bag es atajo directo a /inventory (sin mini-sheet de Colección).
   */
  type MobilePrimaryLink = {
    href: string;
    label: string;
    icon: string;
    iconSrc?: string;
    groupId?: string;
    lootTarget?: "inventory";
  };
  const primary: MobilePrimaryLink[] = [];
  if (session?.user) {
    primary.push({
      href: "/",
      label: t("home"),
      icon: "home",
      iconSrc: "/nav/home-icon.png?v=4",
    });
    for (const slot of MOBILE_BAR_SLOTS) {
      if (slot.kind === "item") {
        const item = findNavItem(slot.id);
        if (!item) continue;
        primary.push({
          href: "/inventory",
          label: t("bag"),
          icon: item.icon,
          iconSrc: item.iconSrc ?? "/nav/bag-icon.png?v=4",
          lootTarget: "inventory",
        });
        continue;
      }
      const group = NAV_GROUPS.find((g) => g.id === slot.id);
      const first = group ? visibleChildren(group)[0] : undefined;
      if (!group || !first) continue;
      primary.push({
        href: first.href,
        label: t(group.labelKey),
        icon: group.icon,
        groupId: group.id,
        ...(group.id === "combat"
          ? { iconSrc: "/nav/battle-icon.png?v=4" }
          : group.id === "adventure"
            ? { iconSrc: "/nav/adventure-icon.png?v=4" }
            : {}),
      });
    }
  }

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
          {lockedHref && lockedLabel && lockedKind && lockedReturn ? (
            <CombatLockChip
              href={lockedHref}
              label={lockedLabel}
              hint={lockedHint}
              returnLabel={lockedReturn}
              iconSrc={lockedIconSrc}
              kind={lockedKind}
            />
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

          {session?.user && <FriendsRailToggle />}

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
                className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition hover:border-white/45 hover:bg-white/6"
              >
                {t("login")}
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-lg border border-pokeball-red bg-pokeball-red px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_10px_color-mix(in_srgb,var(--color-pokeball-red)_28%,transparent)] transition hover:brightness-110"
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
        lockedHint={lockedHint}
        lockedReturn={lockedReturn}
        lockedIconSrc={lockedIconSrc}
        lockedKind={lockedKind}
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
        adventureTowerActive={Boolean(activeTowerRun) || lock?.kind === "tower"}
      />

      {session?.user && <HandbookHost />}
    </>
  );
}
