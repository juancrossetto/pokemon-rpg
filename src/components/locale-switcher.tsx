"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { FlagIcon } from "@/components/flag-icon";
import { LOCALE_FLAG } from "@/lib/countries";
import { markMobileNavDrawerOpen } from "@/lib/nav-drawer-persist";

const LOCALE_LABEL: Record<(typeof routing.locales)[number], string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};

const LOCALE_SHORT: Record<(typeof routing.locales)[number], string> = {
  es: "ES",
  en: "EN",
  pt: "PT",
};

export function LocaleSwitcher({
  currentLocale,
  label,
  variant = "dropdown",
  /** Si true, el drawer mobile se reabre tras el cambio de idioma. */
  keepMobileDrawer = false,
}: {
  currentLocale: string;
  label: string;
  /** `inline` = all locales as buttons (mobile sheets). `dropdown` = compact menu. */
  variant?: "dropdown" | "inline";
  keepMobileDrawer?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const active = (routing.locales.includes(currentLocale as "es" | "en" | "pt")
    ? currentLocale
    : routing.defaultLocale) as (typeof routing.locales)[number];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function switchLocale(locale: (typeof routing.locales)[number]) {
    if (locale === active || pending) return;
    if (keepMobileDrawer) markMobileNavDrawerOpen();
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  }

  if (variant === "inline") {
    return (
      <div
        role="listbox"
        aria-label={label}
        aria-busy={pending || undefined}
        className={`flex w-full gap-1 rounded-lg border border-white/10 bg-black/20 p-1 ${
          pending ? "pointer-events-none opacity-70" : ""
        }`}
      >
        {routing.locales.map((locale) => {
          const isActive = locale === active;
          return (
            <button
              key={locale}
              type="button"
              role="option"
              aria-selected={isActive}
              aria-label={LOCALE_LABEL[locale]}
              title={LOCALE_LABEL[locale]}
              disabled={pending}
              onClick={() => switchLocale(locale)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
                isActive
                  ? "bg-pokeball-red/20 text-on-surface ring-1 ring-pokeball-red/40"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              <FlagIcon
                code={LOCALE_FLAG[locale]}
                title={LOCALE_SHORT[locale]}
                className="h-3.5 w-auto rounded-[2px]"
              />
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {LOCALE_SHORT[locale]}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-on-surface-variant hover:text-on-surface hover:bg-white/10 transition-colors"
      >
        <FlagIcon
          code={LOCALE_FLAG[active]}
          title={LOCALE_SHORT[active]}
          className="h-3.5 w-auto rounded-[2px]"
        />
        {/* Entre 1024 y 1279 el navbar completo va justo de ancho: acá el
            selector queda en bandera sola, que ya identifica el idioma. El
            `aria-label` sigue diciendo cuál es para lectores de pantalla. */}
        <span className="hidden text-label-sm uppercase xl:inline">{LOCALE_SHORT[active]}</span>
        <span className="material-symbols-outlined hidden text-[14px]! opacity-70 xl:inline">
          expand_more
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1.5 min-w-40 rounded-lg border border-white/10 bg-background/98 backdrop-blur-xl shadow-2xl py-1 z-[70]"
        >
          {routing.locales.map((locale) => {
            const isActive = locale === active;
            return (
              <li key={locale} role="option" aria-selected={isActive}>
                <Link
                  href={pathname}
                  locale={locale}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-label-md transition-colors ${
                    isActive
                      ? "bg-white/10 text-on-surface"
                      : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                  }`}
                >
                  <FlagIcon
                    code={LOCALE_FLAG[locale]}
                    title={LOCALE_SHORT[locale]}
                    className="h-3.5 w-auto rounded-[2px]"
                  />
                  <span className="flex-1">{LOCALE_LABEL[locale]}</span>
                  <span className="text-label-sm uppercase opacity-60">{LOCALE_SHORT[locale]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
