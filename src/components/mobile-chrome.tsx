"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationsBell } from "@/components/notifications-bell";
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

        <div className="flex items-center gap-2 shrink-0">
          {energy !== null && energyMax !== null && (
            <span
              className="flex flex-col gap-0.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-sky-300"
              title={energyLabel}
              aria-label={`${energyLabel}: ${energy}/${energyMax}`}
            >
              <span className="flex items-center gap-0.5 text-[11px] font-mono leading-none">
                <span className="material-symbols-outlined text-[14px]!">bolt</span>
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
          {coins !== null && (
            <span className="flex items-center gap-1 rounded-full border border-electric-yellow/30 bg-electric-yellow/10 px-2 py-0.5 text-[11px] font-mono text-electric-yellow">
              <span className="material-symbols-outlined text-[14px]!">paid</span>
              {coins}
            </span>
          )}
          <LocaleSwitcher currentLocale={locale} label={languageLabel} />
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
            {primary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 text-on-surface-variant hover:text-pokeball-red transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]!">{item.icon}</span>
                <span className="text-[10px] leading-none truncate max-w-full">{item.label}</span>
              </Link>
            ))}
            {showMore && (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 text-on-surface-variant hover:text-pokeball-red transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]!">menu</span>
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
              {moreLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-on-surface hover:border-pokeball-red/40 hover:bg-pokeball-red/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[24px]! text-pokeball-red">
                    {item.icon}
                  </span>
                  <span className="text-[11px] text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
