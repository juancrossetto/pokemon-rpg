"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { EnergyMeter } from "@/components/energy-meter";
import { NotificationsBell } from "@/components/notifications-bell";
import { CoinsBadge } from "@/components/coins-badge";
import type { NotificationDTO } from "@/lib/notifications";

type NavLink = {
  href: string;
  label: string;
  icon: string;
};

export function MobileChrome({
  brand,
  brandHref = "/login",
  locale,
  languageLabel,
  energy,
  energyMax,
  energyLabel,
  energyFullLabel,
  energyUpdatedAt,
  coins,
  userName,
  avatarId,
  logoutLabel,
  trainerLabel,
  teamLabel,
  inventoryLabel,
  pcLabel,
  lockedHref,
  lockedLabel,
  lockedIcon,
  primary,
  moreLinks,
  moreLabel,
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
  energyLabel: string;
  energyFullLabel: string;
  energyUpdatedAt: string | null;
  coins: number | null;
  userName: string | null;
  avatarId?: string | null;
  logoutLabel: string;
  trainerLabel: string;
  teamLabel: string;
  inventoryLabel: string;
  pcLabel: string;
  lockedHref: string | null;
  lockedLabel: string | null;
  lockedIcon: "swords" | "military_tech";
  primary: NavLink[];
  moreLinks: NavLink[];
  moreLabel: string;
  loginLabel: string;
  registerLabel: string;
  notifications: { items: NotificationDTO[]; unreadCount: number } | null;
}) {
  const energyPct =
    energy !== null && energyMax !== null && energyMax > 0
      ? Math.max(0, Math.min(100, (energy / energyMax) * 100))
      : 0;
  const [moreOpen, setMoreOpen] = useState(false);
  const showMore = moreLinks.length > 0;
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
  const moreActive = moreLinks.some((l) => isActive(l.href));

  useEffect(() => {
    if (!moreOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  return (
    <>
      {/* Top bar mobile: brand + coins + language + account */}
      <header className="fixed top-0 inset-x-0 z-50 flex md:hidden items-center justify-between gap-2 px-3 h-12 bg-background/95 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <Link href={lockedHref ?? brandHref} className="shrink-0">
          <BrandLogo alt={brand} priority sizes="64px" className="h-7 w-auto" />
        </Link>

        <div className="flex min-w-0 items-center gap-1.5 shrink-0">
          {/* Energía y monedas comparten un solo bloque con divisor: antes eran
              dos chips con borde propio y, sumados al selector de idioma, el
              header llegaba a ~377px en pantallas de 375. Son datos del mismo
              tipo (recursos), así que agruparlos también baja el ruido. */}
          {(energy !== null || coins !== null) && (
            <div className="flex items-center divide-x divide-white/10 rounded-full border border-white/10 bg-white/[0.04]">
              {energy !== null && energyMax !== null && energyUpdatedAt && (
                <EnergyMeter
                  energy={energy}
                  energyMax={energyMax}
                  energyUpdatedAt={energyUpdatedAt}
                  pct={energyPct}
                  label={energyLabel}
                  fullLabel={energyFullLabel}
                />
              )}
              {coins !== null && <CoinsBadge coins={coins} size="sm" />}
            </div>
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
              teamLabel={teamLabel}
              inventoryLabel={inventoryLabel}
              pcLabel={pcLabel}
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
      <nav className="fixed bottom-0 inset-x-0 z-50 flex md:hidden items-stretch h-14 bg-background/98 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
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
              const active = isActive(item.href);
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
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-expanded={moreOpen}
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

      {/* More sheet */}
      {moreOpen && showMore && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-white/10 bg-background/98 backdrop-blur-xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <p className="mb-3 text-label-sm uppercase tracking-wider text-on-surface-variant">
              {moreLabel}
            </p>
            <div className="grid grid-cols-3 gap-2 pb-1">
              {moreLinks.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors ${
                      active
                        ? "border-pokeball-red/50 bg-pokeball-red/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-on-surface hover:border-pokeball-red/40 hover:bg-pokeball-red/5"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]! text-pokeball-red">
                      {item.icon}
                    </span>
                    <span className="text-[11px] text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* El idioma vive acá y no en el header: es una preferencia que se
                toca una vez, no un dato de consulta constante. Además la
                variante `inline` da 3 botones cómodos para el dedo en lugar de
                un dropdown de ~20px. */}
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
                {languageLabel}
              </p>
              <LocaleSwitcher currentLocale={locale} label={languageLabel} variant="inline" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
