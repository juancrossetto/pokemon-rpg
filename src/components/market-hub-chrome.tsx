import { CdnImage as Image } from "@/components/cdn-image";
import { getTranslations } from "next-intl/server";
import { TradeHelp } from "@/components/trade-help";
import { MarketTutorial } from "@/components/journey-guidance";

/**
 * Encabezado del mercado.
 *
 * El banner del mart es compartido por todas las pestañas de `/market`.
 */
export async function MarketHubHero({
  listings,
}: {
  listings: number;
}) {
  const t = await getTranslations("market");
  const tShop = await getTranslations("shop");

  return (
    <header className="market-hub-hero relative mb-5 min-h-[7.25rem] overflow-hidden rounded-2xl border border-white/10 sm:mb-6 sm:min-h-[11rem] md:min-h-[13rem]">
      <div className="absolute inset-0">
        <Image
          src="/ui/banner-store.png"
          alt={tShop("bannerAlt")}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1280px"
          className="object-cover object-[center_38%] scale-[1.08] sm:scale-100"
        />
        {/* Mobile: overlay más liviano para que se aprecie el arte. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[#070a12]/72 via-[#070a12]/28 to-transparent sm:from-[#070a12]/92 sm:via-[#070a12]/55 sm:to-[#070a12]/25"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#070a12]/70 via-transparent to-black/10 sm:from-[#070a12]/80 sm:to-black/20"
        />
      </div>

      {/* Primera visita: la misma guía que abre la `i`, sola. Vive acá y no en
          la page para quedar junto al botón que la reabre. */}
      <MarketTutorial />

      <div className="absolute right-2 top-2 z-20 sm:right-4 sm:top-4">
        <TradeHelp />
      </div>

      <div className="relative z-10 flex flex-col justify-end gap-1 p-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:p-7">
        <div className="min-w-0 pr-9">
          <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-electric-yellow/90 sm:text-[11px] sm:tracking-[0.24em]">
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
          <h1 className="page-title text-[clamp(1.25rem,5.5vw,2.25rem)] text-white">
            {t("hub.title")}
          </h1>
          <p className="mt-1.5 hidden max-w-xl text-label-md leading-snug text-white/80 sm:block">
            {t("hub.subtitle")}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-3 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 backdrop-blur-sm sm:flex">
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
