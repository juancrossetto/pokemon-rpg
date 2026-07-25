import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { MarketFilterForm } from "@/components/market-filter-form";
import {
  MarketHubSidebar,
  MarketQuickChips,
} from "@/components/market-hub-chrome";
import { MarketHubPanel, MarketStatsBar } from "@/components/market-hub-panel";
import { MarketItemCard, MarketPokemonCard } from "@/components/market-listing-cards";
import {
  fetchMarketHubStats,
  fetchRecentActivity,
  fetchTrending,
  resolveCategoryWhere,
  type MarketCategory,
} from "@/lib/market-hub";
import { MAX_PRICE, MIN_PRICE } from "@/lib/market-rules";
import type { Prisma } from "@/generated/prisma/client";

const SORTS = ["recent", "price_asc", "price_desc", "level_desc"] as const;
type Sort = (typeof SORTS)[number];

const ORDER_BY: Record<Sort, Prisma.MarketListingOrderByWithRelationInput> = {
  recent: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  level_desc: { pokemon: { level: "desc" } },
};

const PAGE_SIZE = 12;

export type MarketBrowseFilters = {
  q: string;
  cat: MarketCategory;
  min: number | null;
  max: number | null;
  sort: Sort;
  page: number;
};

function browseHref(filters: MarketBrowseFilters, page: number): string {
  const params = new URLSearchParams({ tab: "browse" });
  if (filters.q) params.set("q", filters.q);
  if (filters.cat !== "all") params.set("cat", filters.cat);
  if (filters.min !== null) params.set("min", String(filters.min));
  if (filters.max !== null) params.set("max", String(filters.max));
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  return `/market?${params.toString()}`;
}

function EmptyState({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-16 text-on-surface-variant">
      <span className="material-symbols-outlined text-[36px]! opacity-50">{icon}</span>
      <p className="text-label-md">{label}</p>
    </div>
  );
}

export async function MarketBrowseTab({
  locale,
  userId,
  coins,
  filters,
  hubStats,
}: {
  locale: string;
  userId: string;
  coins: number;
  filters: MarketBrowseFilters;
  hubStats: Awaited<ReturnType<typeof fetchMarketHubStats>>;
}) {
  const t = await getTranslations("market");

  const where: Prisma.MarketListingWhereInput = { status: "ACTIVE" };
  const categoryWhere = await resolveCategoryWhere(filters.cat);
  if (categoryWhere) Object.assign(where, categoryWhere);

  if (filters.min !== null || filters.max !== null) {
    where.price = {
      ...(filters.min !== null ? { gte: filters.min } : {}),
      ...(filters.max !== null ? { lte: filters.max } : {}),
    };
  }
  if (filters.q) {
    const matchingItems = await prisma.item.findMany({
      where: { name: { contains: filters.q, mode: "insensitive" } },
      select: { id: true },
    });
    where.OR = [
      {
        pokemon: {
          is: {
            OR: [
              { nickname: { contains: filters.q, mode: "insensitive" } },
              { species: { is: { name: { contains: filters.q, mode: "insensitive" } } } },
            ],
          },
        },
      },
      { itemId: { in: matchingItems.map((i) => i.id) } },
    ];
  }

  const [total, listings, trending, activity] = await Promise.all([
    prisma.marketListing.count({ where }),
    prisma.marketListing.findMany({
      where,
      include: {
        seller: { select: { username: true } },
        pokemon: {
          include: {
            species: true,
            moves: { include: { move: true }, orderBy: { slot: "asc" } },
          },
        },
      },
      orderBy: ORDER_BY[filters.sort],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    fetchTrending(5),
    fetchRecentActivity(8),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const itemIds = listings.flatMap((l) => (l.itemId ? [l.itemId] : []));
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const itemById = new Map(items.map((i) => [i.id, i]));

  const hasFilters =
    filters.q !== "" ||
    filters.cat !== "all" ||
    filters.min !== null ||
    filters.max !== null ||
    filters.sort !== "recent";

  return (
    <div className="flex flex-col gap-5">
      <MarketStatsBar stats={hubStats} />

      <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)_240px] xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <MarketHubSidebar filters={filters} />

        <div className="flex min-w-0 flex-col gap-4">
          <MarketQuickChips filters={filters} />

          <MarketFilterForm
            q={filters.q}
            cat={filters.cat}
            sort={filters.sort}
            min={filters.min}
            max={filters.max}
            minPrice={MIN_PRICE}
            maxPrice={MAX_PRICE}
            hasFilters={hasFilters}
            sorts={SORTS}
            labels={{
              searchPlaceholder: t("filters.searchPlaceholder"),
              searchLabel: t("hub.search"),
              apply: t("filters.apply"),
              clear: t("filters.clear"),
              sortLabel: t("filters.sortLabel"),
              minPrice: t("filters.minPrice"),
              maxPrice: t("filters.maxPrice"),
              price: t("hub.price"),
              reset: t("hub.reset"),
              sort: {
                recent: t("filters.sort.recent"),
                price_asc: t("filters.sort.price_asc"),
                price_desc: t("filters.sort.price_desc"),
                level_desc: t("filters.sort.level_desc"),
              },
            }}
          />

          {listings.length === 0 ? (
            <EmptyState
              icon="storefront"
              label={hasFilters ? t("filters.noResults") : t("emptyBrowse")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => {
                const isOwn = listing.sellerId === userId;
                const canAfford = coins >= listing.price;
                if (listing.kind === "POKEMON" && listing.pokemon) {
                  return (
                    <MarketPokemonCard
                      key={listing.id}
                      locale={locale}
                      listingId={listing.id}
                      price={listing.price}
                      seller={listing.seller.username}
                      expiresAt={listing.expiresAt}
                      isOwn={isOwn}
                      canAfford={canAfford}
                      coins={coins}
                      pokemon={listing.pokemon}
                    />
                  );
                }
                const item = listing.itemId ? itemById.get(listing.itemId) : null;
                if (!item) return null;
                return (
                  <MarketItemCard
                    key={listing.id}
                    locale={locale}
                    listingId={listing.id}
                    price={listing.price}
                    quantity={listing.quantity ?? 1}
                    seller={listing.seller.username}
                    expiresAt={listing.expiresAt}
                    isOwn={isOwn}
                    canAfford={canAfford}
                    coins={coins}
                    item={item}
                  />
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-2 flex items-center justify-center gap-3">
              {filters.page > 1 ? (
                <Link
                  href={browseHref(filters, filters.page - 1)}
                  className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-label-md text-on-surface transition-colors hover:border-pokeball-red/40"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  {t("pagination.prev")}
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md border border-white/5 px-3 py-1.5 text-label-md text-on-surface-variant/40">
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  {t("pagination.prev")}
                </span>
              )}
              <span className="text-label-md text-on-surface-variant">
                {t("pagination.pageOf", { page: filters.page, total: totalPages })}
              </span>
              {filters.page < totalPages ? (
                <Link
                  href={browseHref(filters, filters.page + 1)}
                  className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-label-md text-on-surface transition-colors hover:border-pokeball-red/40"
                >
                  {t("pagination.next")}
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md border border-white/5 px-3 py-1.5 text-label-md text-on-surface-variant/40">
                  {t("pagination.next")}
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </span>
              )}
            </nav>
          )}
        </div>

        <div className="hidden lg:block">
          <MarketHubPanel trending={trending} activity={activity} />
        </div>
      </div>

      <div className="lg:hidden">
        <MarketHubPanel trending={trending} activity={activity} />
      </div>
    </div>
  );
}
