import Image from "next/image";
import { BrandLogo } from "@/components/brand-logo";
import { AppShellFallbackMeasure } from "@/components/app-shell-fallback-measure";

/** Tabs de la bottom bar (mismas assets que SiteHeader / MobileChrome). */
const FALLBACK_TABS = [
  {
    iconSrc: "/nav/home-icon.png?v=4",
    combat: false,
    labels: { es: "Inicio", en: "Home", pt: "Início" },
  },
  {
    iconSrc: "/nav/adventure-icon.png?v=4",
    combat: false,
    labels: { es: "Aventura", en: "Adventure", pt: "Aventura" },
  },
  {
    iconSrc: "/nav/battle-icon.png?v=4",
    combat: true,
    labels: { es: "Combate", en: "Battle", pt: "Combate" },
  },
  {
    iconSrc: "/nav/bag-icon.png?v=4",
    combat: false,
    labels: { es: "Mochila", en: "Bag", pt: "Mochila" },
  },
  {
    iconSrc: "/nav/menu-icon.png?v=4",
    combat: false,
    labels: { es: "Más", en: "More", pt: "Mais" },
  },
] as const;

/**
 * Chrome mínimo mientras `AppShell` suspende (p. ej. soft-nav de idioma).
 * Sin esto `Suspense fallback={null}` deja huecos negros donde iban el
 * header y la bottom nav, y parece que el loader los tapa.
 */
export function AppShellFallback({ locale = "es" }: { locale?: string }) {
  const lang = locale === "en" || locale === "pt" ? locale : "es";

  return (
    <>
      <nav
        className="fixed top-0 z-50 hidden h-14 w-full items-center border-b border-white/[0.07] bg-[#0b0d13]/95 px-5 xl:flex"
        aria-hidden
      >
        <BrandLogo alt="" sizes="64px" className="h-8 w-auto" />
      </nav>

      <header
        className="mobile-top-chrome fixed top-0 inset-x-0 z-50 flex min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] items-center border-b border-white/10 bg-background px-3 pt-[env(safe-area-inset-top,0px)] pb-2.5 xl:hidden"
        aria-hidden
      >
        <BrandLogo alt="" priority sizes="64px" className="h-7 w-auto" />
      </header>

      <nav className="mobile-bottom-nav xl:hidden" aria-hidden>
        <div className="mobile-bottom-nav__dock">
          {FALLBACK_TABS.map((tab) => (
            <span
              key={tab.iconSrc}
              className={`mobile-nav-tab mobile-nav-tab--no-motion pointer-events-none${
                tab.combat ? " mobile-nav-tab--combat" : ""
              }`}
            >
              {tab.combat ? (
                <span className="mobile-nav-fab">
                  <Image
                    src={tab.iconSrc}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    priority
                  />
                </span>
              ) : (
                <span className="mobile-nav-tab-icon">
                  <Image
                    src={tab.iconSrc}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    priority
                  />
                </span>
              )}
              <span className="mobile-nav-tab-text">{tab.labels[lang]}</span>
            </span>
          ))}
        </div>
      </nav>

      <AppShellFallbackMeasure />
    </>
  );
}
