"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { routing } from "@/i18n/routing";
import { markMobileNavDrawerOpen } from "@/lib/nav-drawer-persist";
import { APP_TIME_ZONE } from "@/lib/app-time-zone";
import {
  hideLocaleSwitchOverlay,
  showLocaleSwitchOverlay,
} from "@/lib/locale-switch-overlay";

type AppLocale = (typeof routing.locales)[number];

const MESSAGE_LOADERS: Record<AppLocale, () => Promise<AbstractIntlMessages>> = {
  es: () =>
    import("../../messages/es.json").then(
      (m) => m.default as unknown as AbstractIntlMessages,
    ),
  en: () =>
    import("../../messages/en.json").then(
      (m) => m.default as unknown as AbstractIntlMessages,
    ),
  pt: () =>
    import("../../messages/pt.json").then(
      (m) => m.default as unknown as AbstractIntlMessages,
    ),
};

type SwitchLocaleOptions = {
  /** Mantener el drawer mobile abierto tras el soft-nav. */
  keepMobileDrawer?: boolean;
};

type LocaleSwitchApi = {
  locale: string;
  pending: boolean;
  switchLocale: (locale: AppLocale, options?: SwitchLocaleOptions) => void;
};

type OptimisticLocale = {
  locale: AppLocale;
  messages: AbstractIntlMessages;
};

const LocaleSwitchContext = createContext<LocaleSwitchApi | null>(null);

export function useLocaleSwitch(): LocaleSwitchApi {
  const ctx = useContext(LocaleSwitchContext);
  if (!ctx) {
    throw new Error("useLocaleSwitch must be used within I18nClientProvider");
  }
  return ctx;
}

/** Pathname sin prefijo de locale (`/en/pvp` → `/pvp`). */
function pathWithoutLocale(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  if ((routing.locales as readonly string[]).includes(parts[0])) {
    const rest = parts.slice(1).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

/**
 * Provider de i18n en cliente: al cambiar idioma primero aplica messages en
 * memoria (UI al toque) y después hace soft-nav. No usa hooks de
 * `@/i18n/navigation` acá: esos requieren el propio provider.
 *
 * El overlay Pokéball vive en `document.body` (no en React) porque el soft-nav
 * remonta el layout y se llevaría cualquier spinner del árbol.
 */
export function I18nClientProvider({
  locale: serverLocale,
  messages: serverMessages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  const [optimistic, setOptimistic] = useState<OptimisticLocale | null>(null);
  const [seenServerLocale, setSeenServerLocale] = useState(serverLocale);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Ajuste durante render (patrón React): cuando el soft-nav llega, soltar override.
  if (serverLocale !== seenServerLocale) {
    setSeenServerLocale(serverLocale);
    setOptimistic(null);
    setLoading(false);
  }

  const locale = optimistic?.locale ?? serverLocale;
  const messages = optimistic?.messages ?? serverMessages;
  const pending =
    loading || (optimistic !== null && optimistic.locale !== serverLocale);

  useLayoutEffect(() => {
    if (!pending) hideLocaleSwitchOverlay();
  }, [pending]);

  const switchLocale = useCallback(
    (next: AppLocale, options?: SwitchLocaleOptions) => {
      if (next === locale || pending) return;
      if (options?.keepMobileDrawer) markMobileNavDrawerOpen();

      showLocaleSwitchOverlay();
      setLoading(true);
      void (async () => {
        try {
          const nextMessages = await MESSAGE_LOADERS[next]();
          setOptimistic({ locale: next, messages: nextMessages });
          setLoading(false);
          if (typeof document !== "undefined") {
            document.documentElement.lang = next;
          }
          const bare = pathWithoutLocale(pathname);
          const href = `/${next}${bare === "/" ? "" : bare}`;
          router.replace(href, { scroll: false });
        } catch {
          setOptimistic(null);
          setLoading(false);
          hideLocaleSwitchOverlay();
        }
      })();
    },
    [locale, pending, pathname, router],
  );

  const api: LocaleSwitchApi = { locale, pending, switchLocale };

  return (
    <LocaleSwitchContext.Provider value={api}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone={APP_TIME_ZONE}>
        {children}
      </NextIntlClientProvider>
    </LocaleSwitchContext.Provider>
  );
}
