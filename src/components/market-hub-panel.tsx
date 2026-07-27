import { getTranslations } from "next-intl/server";
import type {
  MarketActivityRow,
  MarketHubStats,
  MarketTrendingRow,
} from "@/lib/market-hub";

export async function MarketStatsBar({ stats }: { stats: MarketHubStats }) {
  const t = await getTranslations("market");
  const cells = [
    { label: t("hub.statListings"), value: stats.listings.toLocaleString() },
    { label: t("hub.statTraders"), value: stats.traders.toLocaleString() },
    { label: t("hub.statSoldToday"), value: stats.soldToday.toLocaleString() },
    {
      label: t("hub.statAvgPrice"),
      value: stats.averagePrice > 0 ? stats.averagePrice.toLocaleString() : "—",
    },
  ];

  return (
    // 2×2 en mobile con celdas divididas por línea en vez de padding suelto:
    // antes cada celda respiraba tanto que la barra medía ~340px de alto.
    <div className="grid grid-cols-2 divide-x divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-black/35 backdrop-blur-md sm:grid-cols-4 sm:divide-y-0">
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0 px-3 py-2 sm:px-4 sm:py-3">
          <p className="truncate text-[9px] font-mono uppercase tracking-wider text-on-surface-variant/75 sm:text-[10px]">
            {cell.label}
          </p>
          <p className="mt-0.5 truncate font-mono text-[15px] leading-tight text-white sm:text-xl">
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Sección secundaria. En desktop es un panel siempre visible de la columna
 * lateral; en mobile se colapsa en un `<details>` (`collapsible`) para que
 * quede debajo de los resultados sin competir con los productos.
 */
function Section({
  title,
  collapsible,
  children,
}: {
  title: string;
  collapsible: boolean;
  children: React.ReactNode;
}) {
  const heading = (
    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant">
      {title}
    </span>
  );

  if (!collapsible) {
    return (
      <section className="rounded-xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
        <p className="mb-3">{heading}</p>
        {children}
      </section>
    );
  }

  return (
    <details className="group rounded-xl border border-white/10 bg-black/35 backdrop-blur-md">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        {heading}
        <span className="material-symbols-outlined text-[18px]! text-on-surface-variant transition-transform group-open:rotate-180">
          expand_more
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

export async function MarketHubPanel({
  trending,
  activity,
  collapsible = false,
}: {
  trending: MarketTrendingRow[];
  activity: MarketActivityRow[];
  collapsible?: boolean;
}) {
  const t = await getTranslations("market");

  return (
    <aside className="flex flex-col gap-3 lg:gap-4">
      <Section title={t("hub.trending")} collapsible={collapsible}>
        {trending.length === 0 ? (
          <p className="text-label-sm text-on-surface-variant/70">{t("hub.trendingEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {trending.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-2 rounded-md border border-white/6 bg-white/[0.03] px-2.5 py-2"
              >
                <span className="truncate text-label-sm capitalize text-on-surface">
                  {row.label}
                </span>
                <span
                  className={`shrink-0 text-label-sm font-mono ${
                    row.direction === "up"
                      ? "text-emerald-300"
                      : row.direction === "down"
                        ? "text-red-300"
                        : "text-on-surface-variant"
                  }`}
                >
                  {row.direction === "up" ? "↑" : row.direction === "down" ? "↓" : "–"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("hub.recent")} collapsible={collapsible}>
        {activity.length === 0 ? (
          <p className="text-label-sm text-on-surface-variant/70">{t("hub.recentEmpty")}</p>
        ) : (
          <ul className="space-y-2.5">
            {activity.map((row) => (
              <li key={row.id} className="text-label-sm text-on-surface-variant">
                <span className="text-on-surface">{row.actor}</span>{" "}
                {row.kind === "bought"
                  ? t("hub.activityBought", { item: row.label })
                  : row.kind === "listed"
                    ? t("hub.activityListed", { item: row.label })
                    : t("hub.activitySold", { item: row.label })}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </aside>
  );
}
