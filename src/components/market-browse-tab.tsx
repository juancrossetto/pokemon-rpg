import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { MarketFilterForm } from "@/components/market-filter-form";
import { MarketCategoryRail } from "@/components/market-category-rail";
import { MarketHubPanel, MarketStatsBar } from "@/components/market-hub-panel";
import {
  MarketExploreCatalog,
  type MarketExploreListing,
} from "@/components/market-explore-catalog";
import {
  fetchMarketHubStats,
  fetchRecentActivity,
  fetchTrending,
  itemRarity,
  pokemonRarity,
  resolveCategoryWhere,
  trainingPercent,
  type MarketCategory,
} from "@/lib/market-hub";
import { MAX_PRICE, MIN_PRICE } from "@/lib/market-rules";
import { calculateMaxHp, calculateStat } from "@/lib/stats";
import { spriteFor } from "@/lib/shiny";
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

function resolveExpiry(
  date: Date | null,
  t: Awaited<ReturnType<typeof getTranslations<"market">>>,
): { expiresClosing: boolean; expiresLabel: string | null } {
  if (!date) return { expiresClosing: false, expiresLabel: null };
  const remainingMs = date.getTime() - Date.now();
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
  if (remainingMs <= 0 || hours <= 1) {
    return { expiresClosing: true, expiresLabel: t("expiresSoon") };
  }
  if (hours < 24) {
    return {
      expiresClosing: false,
      expiresLabel: t("expiresInHours", { hours }),
    };
  }
  return {
    expiresClosing: false,
    expiresLabel: t("expiresIn", { days: Math.ceil(hours / 24) }),
  };
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
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <MarketStatsBar stats={hubStats} />

      {/*
        `minmax(0,1fr)` en la columna central y `min-w-0` en cada nivel: sin eso
        una card ancha (nombre largo, precio grande) estira la columna. La
        sidebar se declara `hidden lg:block` dentro del propio componente, así
        que en mobile la grilla es de una sola columna real.
      */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <MarketCategoryRail filters={filters} variant="sidebar" />

        <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
          <MarketCategoryRail filters={filters} variant="rail" />

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
              openFilters: t("filters.open"),
              filtersTitle: t("filters.title"),
              close: t("filters.close"),
              sort: {
                recent: t("filters.sort.recent"),
                price_asc: t("filters.sort.price_asc"),
                price_desc: t("filters.sort.price_desc"),
                level_desc: t("filters.sort.level_desc"),
              },
            }}
          />

          {/* Cantidad de resultados y página: en mobile es lo único que dice
              cuántos productos hay, porque la paginación queda al final. */}
          {listings.length > 0 && (
            <p className="flex items-baseline justify-between gap-2 text-[11px] text-on-surface-variant">
              <span>{t("resultsCount", { count: total })}</span>
              {totalPages > 1 && (
                <span className="font-mono">
                  {t("pagination.pageOf", { page: filters.page, total: totalPages })}
                </span>
              )}
            </p>
          )}

          {listings.length === 0 ? (
            <EmptyState
              icon="storefront"
              label={hasFilters ? t("filters.noResults") : t("emptyBrowse")}
            />
          ) : (
            /*
              Misma grilla GO que la Tienda oficial: PNG grande, sin cards;
              el detalle (efecto, stats, comprar) vive en el sheet al tocar.
            */
            <MarketExploreCatalog
              locale={locale}
              coins={coins}
              listings={listings.flatMap((listing): MarketExploreListing[] => {
                const isOwn = listing.sellerId === userId;
                const canAfford = coins >= listing.price;
                const { expiresClosing, expiresLabel } = resolveExpiry(
                  listing.expiresAt,
                  t,
                );

                if (listing.kind === "POKEMON" && listing.pokemon) {
                  const { pokemon } = listing;
                  const { species } = pokemon;
                  const invested =
                    pokemon.ptStrength +
                    pokemon.ptDexterity +
                    pokemon.ptIntelligence +
                    pokemon.ptSpeed +
                    pokemon.ptConstitution;
                  return [
                    {
                      kind: "POKEMON",
                      id: listing.id,
                      price: listing.price,
                      seller: listing.seller.username,
                      expiresClosing,
                      expiresLabel,
                      isOwn,
                      canAfford,
                      rarity: pokemonRarity({
                        isShiny: pokemon.isShiny,
                        level: pokemon.level,
                        invested,
                      }),
                      displayName: pokemon.nickname ?? species.name,
                      hp: calculateMaxHp(
                        species.baseHp,
                        pokemon.level,
                        pokemon.ptConstitution,
                      ),
                      atk: calculateStat(
                        species.baseAttack,
                        pokemon.ptStrength,
                        pokemon.level,
                      ),
                      training: trainingPercent(invested, pokemon.level),
                      invested,
                      pokemon: {
                        level: pokemon.level,
                        isShiny: pokemon.isShiny,
                        unspentPoints: pokemon.unspentPoints,
                        spriteUrl: spriteFor(species.spriteUrl, pokemon.isShiny),
                        types: species.types,
                        moves: pokemon.moves.map((m) =>
                          m.move.name.replace(/-/g, " "),
                        ),
                      },
                    },
                  ];
                }

                const item = listing.itemId ? itemById.get(listing.itemId) : null;
                if (!item) return [];
                return [
                  {
                    kind: "ITEM",
                    id: listing.id,
                    price: listing.price,
                    quantity: listing.quantity ?? 1,
                    seller: listing.seller.username,
                    expiresClosing,
                    expiresLabel,
                    isOwn,
                    canAfford,
                    rarity: itemRarity(item),
                    item: {
                      name: item.name,
                      type: item.type,
                      effectText: item.effectText,
                    },
                  },
                ];
              })}
            />
          )}

          {totalPages > 1 && (
            <nav className="mt-1 flex items-center justify-center gap-2 sm:gap-3">
              {filters.page > 1 ? (
                <Link
                  href={browseHref(filters, filters.page - 1)}
                  className="flex h-11 items-center gap-1 rounded-md border border-white/10 px-3 text-label-md text-on-surface transition-colors hover:border-pokeball-red/40 sm:h-9"
                >
                  <span className="material-symbols-outlined text-[16px]!">chevron_left</span>
                  {t("pagination.prev")}
                </Link>
              ) : (
                <span className="flex h-11 items-center gap-1 rounded-md border border-white/5 px-3 text-label-md text-on-surface-variant/40 sm:h-9">
                  <span className="material-symbols-outlined text-[16px]!">chevron_left</span>
                  {t("pagination.prev")}
                </span>
              )}
              <span className="text-label-md text-on-surface-variant">
                {t("pagination.pageOf", { page: filters.page, total: totalPages })}
              </span>
              {filters.page < totalPages ? (
                <Link
                  href={browseHref(filters, filters.page + 1)}
                  className="flex h-11 items-center gap-1 rounded-md border border-white/10 px-3 text-label-md text-on-surface transition-colors hover:border-pokeball-red/40 sm:h-9"
                >
                  {t("pagination.next")}
                  <span className="material-symbols-outlined text-[16px]!">chevron_right</span>
                </Link>
              ) : (
                <span className="flex h-11 items-center gap-1 rounded-md border border-white/5 px-3 text-label-md text-on-surface-variant/40 sm:h-9">
                  {t("pagination.next")}
                  <span className="material-symbols-outlined text-[16px]!">chevron_right</span>
                </span>
              )}
            </nav>
          )}
        </div>

        {/* La columna lateral derecha entra recién en `xl`: a 1024 el ancho que
            quedaba para la grilla daba solo 2 columnas de cards angostas. */}
        <div className="hidden xl:block">
          <div className="sticky top-20">
            <MarketHubPanel trending={trending} activity={activity} />
          </div>
        </div>
      </div>

      {/* Hasta `xl`: debajo de los resultados y plegados, para que no compitan
          con los productos ni le quiten ancho a la grilla. */}
      <div className="xl:hidden">
        <MarketHubPanel trending={trending} activity={activity} collapsible />
      </div>
    </div>
  );
}
