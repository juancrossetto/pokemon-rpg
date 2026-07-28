import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  MARKET_CATEGORIES,
  MARKET_CATEGORY_META,
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
  // La página no se propaga a propósito: al cambiar de categoría el conjunto
  // de resultados es otro y la página 3 anterior podría no existir.
  return `/market?${params.toString()}`;
}

/**
 * Categorías del mercado en dos presentaciones que comparten datos y estado.
 *
 * Antes eran dos componentes distintos que renderizaban la misma lista de seis
 * categorías: `MarketHubSidebar` (columna) y `MarketQuickChips` (fila). En
 * desktop se veían duplicadas y en mobile las dos a la vez, una encima de otra.
 *
 * Además la sidebar era la causa del desborde horizontal de toda la pantalla:
 * como item de grid sin `min-width: 0`, aportaba el ancho completo de sus seis
 * entradas (707px) a la única columna implícita, y con eso se estiraban las
 * cards, el formulario de filtros y hasta el header fijo de mobile.
 */
export async function MarketCategoryRail({
  filters,
  variant,
}: {
  filters: BrowseFilters;
  /** `rail`: fila deslizable (mobile/tablet). `sidebar`: columna (lg+). */
  variant: "rail" | "sidebar";
}) {
  const t = await getTranslations("market");
  const isRail = variant === "rail";

  const items = MARKET_CATEGORIES.map((cat) => {
    const active = filters.cat === cat;
    const meta = MARKET_CATEGORY_META[cat];
    return (
      <Link
        key={cat}
        href={hrefForCat(cat, filters)}
        aria-current={active ? "page" : undefined}
        className={
          isRail
            ? // min-h-11 ≈ 44px: objetivo táctil mínimo. `rounded-md` como
              // en Tienda: la píldora (`rounded-full`) desentonaba en el hub.
              `flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-md border px-3 text-label-sm transition ${
                active
                  ? "border-pokeball-red/55 bg-pokeball-red/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-on-surface-variant active:bg-white/[0.07]"
              }`
            : `flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-label-sm transition ${
                active
                  ? "border-pokeball-red/55 bg-pokeball-red/15 text-white"
                  : "border-transparent text-on-surface-variant hover:border-white/10 hover:bg-white/[0.04] hover:text-on-surface"
              }`
        }
      >
        <span className="material-symbols-outlined text-[18px]!">{meta.icon}</span>
        <span className="whitespace-nowrap">{t(`hub.cat.${cat}`)}</span>
      </Link>
    );
  });

  if (isRail) {
    return (
      <nav aria-label={t("hub.categories")} className="lg:hidden">
        {/*
          Alineado al contenido (mismo criterio que Tienda): el sangrado con
          `-mx-margin-mobile` dejaba el primer chip pegado al borde y se leía
          como error de maquetado. El riel sigue desplazándose igual.
        */}
        <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto pb-0.5">
          {items}
        </div>
      </nav>
    );
  }

  return (
    <aside className="hidden min-w-0 lg:block">
      <nav
        aria-label={t("hub.categories")}
        className="sticky top-20 rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-md lg:p-4"
      >
        <p className="mb-3 px-1 text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant">
          {t("hub.categories")}
        </p>
        <div className="flex flex-col gap-1.5">{items}</div>
      </nav>
    </aside>
  );
}
