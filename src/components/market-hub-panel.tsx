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
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-md sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/10 sm:p-0">
      {cells.map((cell) => (
        <div key={cell.label} className="px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/75">
            {cell.label}
          </p>
          <p className="mt-0.5 font-mono text-lg text-white sm:text-xl">{cell.value}</p>
        </div>
      ))}
    </div>
  );
}

export async function MarketHubPanel({
  trending,
  activity,
}: {
  trending: MarketTrendingRow[];
  activity: MarketActivityRow[];
}) {
  const t = await getTranslations("market");

  return (
    <aside className="flex flex-col gap-4">
      <section className="rounded-xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant">
          {t("hub.trending")}
        </p>
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
      </section>

      <section className="rounded-xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant">
          {t("hub.recent")}
        </p>
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
      </section>
    </aside>
  );
}
