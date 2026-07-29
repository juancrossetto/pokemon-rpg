"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { ResourceBar, type ResourceBarLabels } from "@/components/resource-bar";
import {
  groupMatches,
  itemMatches,
  MOBILE_BAR_GROUPS,
  visibleChildren,
} from "@/lib/navigation";
import type { NavGroup } from "@/lib/navigation";
import type { NavLabels } from "@/components/nav-links";
import type { NotificationDTO } from "@/lib/notifications";
import { consumeMobileNavDrawerOpen } from "@/lib/nav-drawer-persist";

type NavLink = {
  href: string;
  label: string;
  icon: string;
  /** Ícono custom (PNG/SVG) en lugar del Material Symbol — p. ej. tab Combate. */
  iconSrc?: string;
  /**
   * Grupo que representa este tab. Con esto el tab queda activo en cualquier
   * ruta de la sección y no solo en la de su `href`: estando en `/gyms` se
   * marca "Aventura" aunque el tab apunte a `/campaign`.
   */
  groupId?: string;
};

type IndicatorBox = { left: number; width: number; height: number; top: number } | null;

const BAR_GROUP_IDS = new Set<string>(MOBILE_BAR_GROUPS);

export function MobileChrome({
  brand,
  brandHref = "/login",
  locale,
  languageLabel,
  energy,
  energyMax,
  energyUpdatedAt,
  coins,
  gems,
  resourceLabels,
  userName,
  avatarId,
  logoutLabel,
  trainerLabel,
  profileLabel,
  lockedHref,
  lockedLabel,
  lockedIcon,
  primary,
  groups,
  navLabels,
  moreLabel,
  closeLabel,
  loginLabel,
  registerLabel,
  notifications,
}: {
  brand: string;
  brandHref?: string;
  locale: string;
  languageLabel: string;
  energy: number | null;
  energyMax: number | null;
  energyUpdatedAt: string | null;
  coins: number | null;
  gems: number | null;
  resourceLabels: ResourceBarLabels;
  userName: string | null;
  avatarId?: string | null;
  logoutLabel: string;
  trainerLabel: string;
  profileLabel: string;
  lockedHref: string | null;
  lockedLabel: string | null;
  lockedIcon: "swords" | "military_tech";
  primary: NavLink[];
  /** Misma configuración que consume el navbar desktop. */
  groups: NavGroup[];
  navLabels: NavLabels;
  moreLabel: string;
  closeLabel: string;
  loginLabel: string;
  registerLabel: string;
  notifications: { items: NotificationDTO[]; unreadCount: number } | null;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [indicator, setIndicator] = useState<IndicatorBox>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const bottomNavRef = useRef<HTMLElement>(null);
  const showMore = groups.length > 0;
  // `usePathname` de next-intl ya viene sin el prefijo de idioma, así que se
  // compara directo contra los href de los links.
  const pathname = usePathname();

  // Al cambiar de locale el layout se remonta y el drawer se cerraría; si el
  // switcher marcó persistencia, lo reabrimos antes del paint.
  useLayoutEffect(() => {
    if (consumeMobileNavDrawerOpen()) setMoreOpen(true);
  }, []);

  function isActive(href: string): boolean {
    const clean = href.split("?")[0];
    if (clean === "/") return pathname === "/";
    return pathname === clean || pathname.startsWith(`${clean}/`);
  }

  function isPrimaryActive(item: NavLink): boolean {
    if (item.groupId) {
      const group = groups.find((g) => g.id === item.groupId);
      return group ? groupMatches(pathname, group) : false;
    }
    return isActive(item.href);
  }

  const anyPrimaryActive = primary.some(isPrimaryActive);
  // "Más" solo si la ruta no cae en un tab de la barra (ranking, clanes…),
  // o si el drawer está abierto.
  const moreRouteActive = groups.some(
    (g) => !BAR_GROUP_IDS.has(g.id) && groupMatches(pathname, g),
  );
  const moreActive = moreOpen || (!anyPrimaryActive && moreRouteActive);

  /*
    Fondo rojo suave deslizante detrás del tab activo. Un único elemento
    medido sobre `[data-active]` para que el cambio de sección tenga el
    rebote elástico (no un fade por tab).
  */
  useEffect(() => {
    const root = bottomNavRef.current;
    if (!root) return;

    function measure() {
      const node = root?.querySelector<HTMLElement>("[data-active]");
      if (!node || !root) {
        setIndicator(null);
        return;
      }
      const rootBox = root.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const insetX = 6;
      const insetY = 4;
      setIndicator({
        left: box.left - rootBox.left + insetX,
        top: box.top - rootBox.top + insetY,
        width: Math.max(0, box.width - insetX * 2),
        height: Math.max(0, box.height - insetY * 2),
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [pathname, moreOpen, primary.length, showMore]);

  useEffect(() => {
    if (!moreOpen) return;
    const opener = moreButtonRef.current;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      // Trampa de foco: con el drawer abierto el tab no debe recorrer la
      // página de atrás, que está oculta tras el overlay.
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, [moreOpen]);

  return (
    <>
      {/* Top bar mobile: brand + resources + account — ~56–64px + safe-area */}
      <header className="fixed top-0 inset-x-0 z-50 flex xl:hidden items-center justify-between gap-2 px-3 min-h-14 bg-background/95 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <Link
          href={lockedHref ?? brandHref}
          className="flex h-11 w-11 shrink-0 items-center justify-center"
          aria-label={brand}
        >
          <BrandLogo alt={brand} priority sizes="64px" className="h-7 w-auto" />
        </Link>

        <div className="flex min-w-0 items-center gap-1 shrink-0">
          {energy !== null &&
            energyMax !== null &&
            energyUpdatedAt &&
            coins !== null &&
            gems !== null && (
              <ResourceBar
                energy={energy}
                energyMax={energyMax}
                energyUpdatedAt={energyUpdatedAt}
                coins={coins}
                gems={gems}
                labels={resourceLabels}
                variant="mobile"
              />
            )}
          {notifications && (
            <div className="flex h-11 w-11 items-center justify-center">
              <NotificationsBell
                initialItems={notifications.items}
                initialUnread={notifications.unreadCount}
              />
            </div>
          )}
          {userName ? (
            <div className="flex h-11 w-11 items-center justify-center">
              <UserMenu
                name={userName}
                avatarId={avatarId ?? null}
                logoutLabel={logoutLabel}
                trainerLabel={trainerLabel}
                profileLabel={profileLabel}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href="/login" className="text-[11px] text-on-surface-variant px-1.5 py-1">
                {loginLabel}
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-pokeball-red px-2 py-1 text-[11px] text-white"
              >
                {registerLabel}
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Bottom bar: 4–5 primary destinations + safe-area */}
      <nav
        ref={bottomNavRef}
        className={`fixed bottom-0 inset-x-0 z-50 flex xl:hidden items-stretch min-h-[3.75rem] overflow-visible border-t border-white/10 bg-background/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-opacity ${
          moreOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {lockedHref && lockedLabel ? (
          <Link
            href={lockedHref}
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-pokeball-red"
          >
            <span className="material-symbols-outlined text-[24px]!">{lockedIcon}</span>
            <span className="text-[11px] leading-none font-bold">{lockedLabel}</span>
          </Link>
        ) : (
          <>
            {indicator && (
              <span
                aria-hidden
                className="mobile-nav-active-bg pointer-events-none absolute rounded-lg"
                style={{
                  left: indicator.left,
                  top: indicator.top,
                  width: indicator.width,
                  height: indicator.height,
                }}
              />
            )}
            {primary.map((item) => {
              const group = item.groupId
                ? groups.find((g) => g.id === item.groupId)
                : undefined;
              const active = isPrimaryActive(item);
              const showActive = active && !moreOpen;
              // Pendientes del grupo: se ven sin abrir el drawer.
              const badge = group
                ? visibleChildren(group).reduce(
                    (sum, child) =>
                      sum + (child.badgeKey ? (navLabels.badges[child.badgeKey] ?? 0) : 0),
                    0,
                  )
                : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={showActive || undefined}
                  aria-current={showActive ? "page" : undefined}
                  aria-label={item.label}
                  className={`mobile-nav-tab relative z-10 flex min-h-14 flex-1 min-w-0 flex-col items-center justify-center gap-0.5 px-1 ${
                    showActive
                      ? "text-pokeball-red"
                      : "text-on-surface-variant hover:text-pokeball-red"
                  }`}
                >
                  {item.iconSrc ? (
                    <span
                      className={`mobile-nav-tab-icon relative z-10 flex h-9 w-9 shrink-0 items-center justify-center ${
                        showActive ? "scale-110" : "scale-100"
                      }`}
                    >
                      <Image
                        src={item.iconSrc}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className={`h-9 w-9 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] transition-[filter,transform] duration-[680ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          showActive ? "brightness-110" : "brightness-95"
                        }`}
                        aria-hidden
                        priority
                      />
                    </span>
                  ) : (
                    <span
                      className={`mobile-nav-tab-icon flex h-9 w-9 shrink-0 items-center justify-center ${
                        showActive ? "scale-110" : "scale-100"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[24px]!">
                        {item.icon}
                      </span>
                    </span>
                  )}
                  <span
                    className={`max-w-full truncate text-[10px] leading-none ${
                      showActive ? "mobile-nav-tab-label font-bold" : "font-medium opacity-80"
                    }`}
                  >
                    {item.label}
                  </span>
                  {badge > 0 && (
                    <span
                      aria-hidden
                      className="absolute right-[18%] top-1.5 h-2 w-2 rounded-full bg-tertiary ring-2 ring-background"
                    />
                  )}
                </Link>
              );
            })}
            {showMore && (
              <button
                ref={moreButtonRef}
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                aria-label={moreLabel}
                data-active={moreActive || undefined}
                className={`mobile-nav-tab relative z-10 flex min-h-14 flex-1 min-w-0 flex-col items-center justify-center gap-0.5 px-1 ${
                  moreActive
                    ? "text-pokeball-red"
                    : "text-on-surface-variant hover:text-pokeball-red"
                }`}
              >
                {moreOpen ? (
                  <span
                    className={`mobile-nav-tab-icon flex h-9 w-9 shrink-0 items-center justify-center ${
                      moreActive ? "scale-110" : "scale-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]!">close</span>
                  </span>
                ) : (
                  <span
                    className={`mobile-nav-tab-icon flex h-9 w-9 shrink-0 items-center justify-center ${
                      moreActive ? "scale-110" : "scale-100"
                    }`}
                  >
                    <Image
                      src="/nav/menu-icon.png"
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-9 w-9 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]"
                      aria-hidden
                    />
                  </span>
                )}
                <span
                  className={`max-w-full truncate text-[10px] leading-none ${
                    moreActive ? "mobile-nav-tab-label font-bold" : "font-medium opacity-80"
                  }`}
                >
                  {moreLabel}
                </span>
              </button>
            )}
          </>
        )}
      </nav>

      {/*
        Drawer de navegación completa. Antes era una grilla plana de 8 íconos
        sin agrupar; ahora repite los mismos grupos que el navbar desktop, con
        encabezado por sección, para que la jerarquía sea la misma en las dos
        superficies aunque el dibujo sea distinto.
      */}
      {moreOpen && showMore && (
        <div className="fixed inset-0 z-[60] xl:hidden" role="presentation">
          <button
            type="button"
            aria-label={closeLabel}
            className="market-sheet-backdrop-in absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={moreLabel}
            className="market-sheet-in absolute inset-x-0 bottom-0 flex h-[92dvh] flex-col overflow-hidden rounded-t-2xl border-t border-white/12 bg-background/98 shadow-2xl backdrop-blur-xl"
          >
            <div className="shrink-0 px-4 pb-2 pt-2.5">
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/20" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  {navLabels.text["navigation"] ?? moreLabel}
                </p>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label={closeLabel}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[20px]!">close</span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
              {groups.map((group) => {
                const items = visibleChildren(group);
                if (items.length === 0) return null;
                return (
                  <section key={group.id} className="mb-4 last:mb-3">
                    <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
                      {navLabels.text[group.labelKey] ?? group.id}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((item) => {
                        const active = itemMatches(pathname, item);
                        const label = navLabels.text[item.labelKey] ?? item.id;
                        const iconNode = item.iconSrc ? (
                          <Image
                            src={item.iconSrc}
                            alt=""
                            width={36}
                            height={36}
                            unoptimized
                            className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                            aria-hidden
                          />
                        ) : (
                          <span
                            className={`material-symbols-outlined text-[20px]! ${
                              active ? "text-pokeball-red" : "text-on-surface-variant"
                            }`}
                          >
                            {item.icon}
                          </span>
                        );
                        if (item.disabled) {
                          return (
                            <span
                              key={item.id}
                              aria-disabled
                              className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 opacity-45"
                            >
                              {iconNode}
                              <span className="min-w-0 flex-1 text-label-sm leading-tight">
                                {label}
                              </span>
                              {item.badgeKey && (navLabels.badges[item.badgeKey] ?? 0) > 0 && (
                                <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-bold text-surface">
                                  {navLabels.badges[item.badgeKey]}
                                </span>
                              )}
                            </span>
                          );
                        }
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 transition-colors ${
                              active
                                ? "border-pokeball-red/50 bg-pokeball-red/10 text-white"
                                : "border-white/10 bg-white/[0.03] text-on-surface active:bg-white/[0.07]"
                            }`}
                          >
                            {iconNode}
                            <span className="min-w-0 flex-1 text-label-sm leading-tight">
                              {label}
                            </span>
                            {item.badgeKey && (navLabels.badges[item.badgeKey] ?? 0) > 0 && (
                              <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-bold text-surface">
                                {navLabels.badges[item.badgeKey]}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Fijo abajo del sheet: si va dentro del scroll, en mobile se corta. */}
            <div className="shrink-0 border-t border-white/10 bg-background/98 px-4 pt-3 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
              <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
                {languageLabel}
              </p>
              <LocaleSwitcher
                currentLocale={locale}
                label={languageLabel}
                variant="inline"
                keepMobileDrawer
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
