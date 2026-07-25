import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  MARKET_CATEGORIES,
  MARKET_CATEGORY_META,
  MARKET_QUICK_FILTERS,
  type MarketCategory,
} from "@/lib/market-hub";

type BrowseFilters = {
  q: string;
  cat: MarketCategory;
  min: number | null;
  max: number | null;
  sort: string;
  page: number;
};

function hrefForCat(cat: MarketCategory, filters: BrowseFilters): string {
  const params = new URLSearchParams({ tab: "browse" });
  if (cat !== "all") params.set("cat", cat);
  if (filters.q) params.set("q", filters.q);
  if (filters.min !== null) params.set("min", String(filters.min));
  if (filters.max !== null) params.set("max", String(filters.max));
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  return `/market?${params.toString()}`;
}

export async function MarketHubSidebar({
  filters,
}: {
  filters: BrowseFilters;
}) {
  const t = await getTranslations("market");

  return (
    <aside className="rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-md lg:p-4">
      <p className="mb-3 px-1 text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant">
        {t("hub.categories")}
      </p>
      <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {MARKET_CATEGORIES.map((cat) => {
          const active = filters.cat === cat;
          const meta = MARKET_CATEGORY_META[cat];
          return (
            <Link
              key={cat}
              href={hrefForCat(cat, filters)}
              className={`flex shrink-0 items-center gap-2.5 rounded-md border px-2.5 py-2 text-label-sm transition lg:w-full ${
                active
                  ? "border-pokeball-red/55 bg-pokeball-red/15 text-white"
                  : "border-transparent text-on-surface-variant hover:border-white/10 hover:bg-white/[0.04] hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]!">{meta.icon}</span>
              <span className="whitespace-nowrap">{t(`hub.cat.${cat}`)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export async function MarketQuickChips({
  filters,
}: {
  filters: BrowseFilters;
}) {
  const t = await getTranslations("market");

  return (
    <div className="flex flex-wrap gap-1.5">
      {MARKET_QUICK_FILTERS.map((cat) => {
        const active = filters.cat === cat;
        return (
          <Link
            key={cat}
            href={hrefForCat(cat, filters)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
              active
                ? "border-pokeball-red/50 bg-pokeball-red/15 text-pokeball-red"
                : "border-white/10 text-on-surface-variant hover:border-white/25 hover:text-on-surface"
            }`}
          >
            {t(`hub.cat.${cat}`)}
          </Link>
        );
      })}
    </div>
  );
}

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

      <div className="relative z-10 flex flex-col gap-3 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:py-7">
        <div>
          <p className="mb-1 text-[11px] font-mono uppercase tracking-[0.24em] text-secondary/85">
            {t("hub.eyebrow")}
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight text-white sm:text-[36px]">
            {t("hub.title")}
          </h1>
          <p className="mt-1.5 max-w-xl text-label-sm text-on-surface-variant sm:text-label-md">
            {t("hub.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-2">
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
