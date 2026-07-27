"use client";

import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { ResourceBar, type ResourceBarLabels } from "@/components/resource-bar";
import { groupMatches, itemMatches, visibleChildren } from "@/lib/navigation";
import type { NavGroup } from "@/lib/navigation";
import type { NavLabels } from "@/components/nav-links";
import type { NotificationDTO } from "@/lib/notifications";

type NavLink = {
  href: string;
  label: string;
  icon: string;
  /**
   * Grupo que representa este tab. Con esto el tab queda activo en cualquier
   * ruta de la sección y no solo en la de su `href`: estando en `/gyms` se
   * marca "Aventura" aunque el tab apunte a `/campaign`.
   */
  groupId?: string;
};

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
  const drawerRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const showMore = groups.length > 0;
  // `usePathname` de next-intl ya viene sin el prefijo de idioma, así que se
  // compara directo contra los href de los links.
  const pathname = usePathname();

  function isActive(href: string): boolean {
    const clean = href.split("?")[0];
    if (clean === "/") return pathname === "/";
    return pathname === clean || pathname.startsWith(`${clean}/`);
  }

  // El botón "Más" también se marca cuando la pantalla actual vive dentro del
  // sheet (ranking, clanes, PC…), si no parecería que no estás en ningún lado.
  const moreActive = groups.some((g) => groupMatches(pathname, g));

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
      {/* Top bar mobile: brand + coins + language + account */}
      <header className="fixed top-0 inset-x-0 z-50 flex xl:hidden items-center justify-between gap-2 px-3 h-12 bg-background/95 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <Link href={lockedHref ?? brandHref} className="shrink-0">
          <BrandLogo alt={brand} priority sizes="64px" className="h-7 w-auto" />
        </Link>

        <div className="flex min-w-0 items-center gap-1.5 shrink-0">
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
            <NotificationsBell
              initialItems={notifications.items}
              initialUnread={notifications.unreadCount}
            />
          )}
          {userName ? (
            <UserMenu
              name={userName}
              avatarId={avatarId ?? null}
              logoutLabel={logoutLabel}
              trainerLabel={trainerLabel}
            />
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

      {/* Bottom bar: 4–5 primary destinations */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex xl:hidden items-stretch h-14 bg-background/98 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
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
            {primary.map((item) => {
              const group = item.groupId
                ? groups.find((g) => g.id === item.groupId)
                : undefined;
              const active = group ? groupMatches(pathname, group) : isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                    active ? "text-pokeball-red" : "text-on-surface-variant hover:text-pokeball-red"
                  }`}
                >
                  {/* Barra superior: marca la sección actual. Antes no había
                      ningún indicador y no se sabía en qué pantalla estabas. */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-pokeball-red shadow-[0_0_8px_rgba(238,21,21,0.7)]"
                    />
                  )}
                  <span
                    className={`material-symbols-outlined text-[22px]! transition-transform ${
                      active ? "scale-110" : ""
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={`text-[10px] leading-none truncate max-w-full ${
                      active ? "font-bold" : ""
                    }`}
                  >
                    {item.label}
                  </span>
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
                className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                  moreOpen ? "text-pokeball-red" : "text-on-surface-variant hover:text-pokeball-red"
                }`}
              >
                {moreActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-pokeball-red shadow-[0_0_8px_rgba(238,21,21,0.7)]"
                  />
                )}
                <span className="material-symbols-outlined text-[22px]!">
                  {moreOpen ? "close" : "menu"}
                </span>
                <span className="text-[10px] leading-none">{moreLabel}</span>
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
            className="market-sheet-in absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col rounded-t-2xl border-t border-white/12 bg-background/98 shadow-2xl backdrop-blur-xl"
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

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {groups.map((group) => {
                const items = visibleChildren(group);
                if (items.length === 0) return null;
                return (
                  <section key={group.id} className="mb-4 last:mb-2">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
                      <span className="material-symbols-outlined text-[14px]!">{group.icon}</span>
                      {navLabels.text[group.labelKey] ?? group.id}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((item) => {
                        const active = itemMatches(pathname, item);
                        const label = navLabels.text[item.labelKey] ?? item.id;
                        if (item.disabled) {
                          return (
                            <span
                              key={item.id}
                              aria-disabled
                              className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 opacity-45"
                            >
                              <span className="material-symbols-outlined text-[20px]!">
                                {item.icon}
                              </span>
                              {/* Dos líneas antes que recortar: "Batalla salvaje"
                                entraba como "Batalla salva…" en 390px. */}
                            <span className="min-w-0 text-label-sm leading-tight">{label}</span>
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
                            <span
                              className={`material-symbols-outlined text-[20px]! ${
                                active ? "text-pokeball-red" : "text-on-surface-variant"
                              }`}
                            >
                              {item.icon}
                            </span>
                            {/* Dos líneas antes que recortar: "Batalla salvaje"
                                entraba como "Batalla salva…" en 390px. */}
                            <span className="min-w-0 text-label-sm leading-tight">{label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {/* El idioma vive acá y no en el header: es una preferencia que se
                  toca una vez, no un dato de consulta constante. Además la
                  variante `inline` da 3 botones cómodos para el dedo en lugar de
                  un dropdown de ~20px. */}
              <div className="mt-1 border-t border-white/10 pt-3">
                <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
                  {languageLabel}
                </p>
                <LocaleSwitcher currentLocale={locale} label={languageLabel} variant="inline" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
