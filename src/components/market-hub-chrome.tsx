import Image from "next/image";
import { getTranslations } from "next-intl/server";

/**
 * Encabezado del mercado.
 *
 * Las categorías vivían acá en dos componentes que renderizaban la misma lista
 * (`MarketHubSidebar` y `MarketQuickChips`). Ahora son uno solo con dos
 * presentaciones en `market-category-rail.tsx`.
 */
export async function MarketHubHero({
  listings,
}: {
  listings: number;
}) {
  const t = await getTranslations("market");

  return (
    <header className="market-hub-hero relative mb-6 overflow-hidden rounded-2xl border border-white/10">
      <div className="absolute inset-0">
        <Image
          src="/campaign/maps/regions/kanto.webp"
          alt=""
          fill
          priority
          sizes="1200px"
          className="object-cover opacity-[0.18] blur-[1px]"
          style={{
            objectPosition: "42% 48%",
            transform: "scale(1.35)",
            transformOrigin: "42% 48%",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070a12] via-[#070a12]/92 to-[#070a12]/75" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(125,211,252,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/*
        En mobile el hero medía ~430px: se comía la primera pantalla entera y
        no se veía un solo producto sin scrollear. Ahora el padding y el título
        son fluidos, el "en vivo" es un badge en línea con la etiqueta de
        región, y el subtítulo se reserva para pantallas donde sobra lugar.
      */}
      <div className="relative z-10 flex flex-col gap-2 p-4 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:px-7 sm:py-7">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-secondary/85 sm:text-[11px] sm:tracking-[0.24em]">
              {t("hub.eyebrow")}
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 sm:hidden">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] text-emerald-200">
                {t("hub.listingsOnline", { count: listings.toLocaleString() })}
              </span>
            </span>
          </div>
          <h1 className="text-[clamp(1.5rem,6vw,2.25rem)] font-semibold leading-tight tracking-tight text-white">
            {t("hub.title")}
          </h1>
          <p className="mt-1 max-w-xl text-[12px] leading-snug text-on-surface-variant sm:mt-1.5 sm:text-label-md">
            {t("hub.subtitle")}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-3 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 sm:flex">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
              {t("hub.live")}
            </p>
            <p className="font-mono text-label-sm text-white">
              {t("hub.listingsOnline", { count: listings.toLocaleString() })}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
