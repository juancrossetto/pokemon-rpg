import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { typeColor } from "@/lib/type-colors";
import { calculateMaxHp, calculateStat } from "@/lib/stats";
import { expireDueListings } from "@/lib/market-expiry";
import { MarketSubmitButton } from "@/components/market-submit-button";
import { MarketSellControls } from "@/components/market-sell-controls";
import { MarketFilterForm } from "@/components/market-filter-form";
import {
  MARKET_ERRORS,
  MARKET_NOTICES,
  pickCode,
} from "@/lib/feedback-codes";
import {
  COMMISSION_RATE,
  CONFIRM_PRICE_THRESHOLD,
  LISTING_FEE_RATE,
  LISTING_TTL_DAYS,
  MAX_PRICE,
  MIN_PRICE,
  proceedsFor,
} from "@/lib/market-rules";
import { buyListing, cancelListing, listItem, listPokemon } from "@/actions/market";
import type { Prisma } from "@/generated/prisma/client";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { redirectIfInBattle } from "@/lib/battle-lock";

const TABS = ["browse", "sell", "mine", "bought"] as const;
type Tab = (typeof TABS)[number];

const KINDS = ["all", "pokemon", "item"] as const;
type KindFilter = (typeof KINDS)[number];

const SORTS = ["recent", "price_asc", "price_desc", "level_desc"] as const;
type Sort = (typeof SORTS)[number];

const ORDER_BY: Record<Sort, Prisma.MarketListingOrderByWithRelationInput> = {
  recent: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  level_desc: { pokemon: { level: "desc" } },
};

const PAGE_SIZE = 12;
// Cuántas ventas cerradas se miran para calcular el precio de referencia.
const PRICE_HISTORY_SAMPLE = 200;

const PRIMARY_BUTTON_CLASS =
  "text-label-md px-4 py-1.5 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors";
const GHOST_BUTTON_CLASS =
  "text-label-md px-4 py-1.5 rounded-lg border border-white/10 text-on-surface-variant hover:text-pokeball-red hover:border-pokeball-red/40 transition-colors";

type BrowseFilters = {
  q: string;
  kind: KindFilter;
  min: number | null;
  max: number | null;
  sort: Sort;
  page: number;
};

/** Conserva los filtros de Explorar al cambiar de pestaña. */
function marketTabHref(tab: Tab, filters: BrowseFilters): string {
  const params = new URLSearchParams({ tab });
  if (filters.q) params.set("q", filters.q);
  if (filters.kind !== "all") params.set("kind", filters.kind);
  if (filters.min !== null) params.set("min", String(filters.min));
  if (filters.max !== null) params.set("max", String(filters.max));
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (tab === "browse" && filters.page > 1) params.set("page", String(filters.page));
  return `/market?${params.toString()}`;
}

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    error?: string;
    notice?: string;
    q?: string;
    kind?: string;
    min?: string;
    max?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, session] = await Promise.all([getTranslations("market"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;
  await redirectIfInBattle(userId, locale);
  const tab: Tab = pickCode(query.tab, TABS) ?? "browse";
  // Los códigos vienen del querystring: sin lista blanca, ?error=loquesea
  // termina en t(`errors.loquesea`) y se le muestra la clave cruda al jugador.
  const error = pickCode(query.error, MARKET_ERRORS);
  const notice = pickCode(query.notice, MARKET_NOTICES);

  // Barrido lazy de publicaciones vencidas — reemplaza al cron. Throttleado
  // internamente para no correr en cada carga de cada jugador.
  await expireDueListings();

  const [user, unseenCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true } }),
    prisma.marketListing.count({
      where: { sellerId: userId, status: { in: ["SOLD", "EXPIRED"] }, sellerSeenAt: null },
    }),
  ]);

  const filters: BrowseFilters = {
    q: (query.q ?? "").trim().slice(0, 50),
    kind: pickCode(query.kind, KINDS) ?? "all",
    min: parsePositiveInt(query.min),
    max: parsePositiveInt(query.max),
    // Ordenar por nivel no tiene sentido en objetos solos.
    sort: (() => {
      const kind = pickCode(query.kind, KINDS) ?? "all";
      const sort = pickCode(query.sort, SORTS) ?? "recent";
      return kind === "item" && sort === "level_desc" ? "recent" : sort;
    })(),
    page: Math.max(1, parsePositiveInt(query.page) ?? 1),
  };

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-6xl">
        {/* Las monedas ya están en el header global — no las repetimos acá. */}
        <header className="mb-5">
          <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
          <p className="text-label-md text-on-surface-variant mt-1 max-w-2xl">{t("subtitle")}</p>
        </header>

        {notice && (
          <div className="mb-4 rounded-lg border border-tertiary/40 bg-tertiary/10 px-4 py-2 text-label-md text-tertiary flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t(`notices.${notice}`)}</span>
            {notice === "bought_pokemon" && (
              <Link
                href="/pc"
                className="underline underline-offset-2 hover:text-white transition-colors"
              >
                {t("goToPc")}
              </Link>
            )}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-error/40 bg-error-container/30 px-4 py-2 text-label-md text-error">
            {t(`errors.${error}`)}
          </div>
        )}

        <nav className="flex mb-5 border-b border-white/10 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tabId) => (
            <Link
              key={tabId}
              href={marketTabHref(tabId, filters)}
              className={`px-3 py-2 text-label-md transition-colors whitespace-nowrap flex items-center gap-1.5 border-b-2 -mb-px shrink-0 ${
                tab === tabId
                  ? "text-pokeball-red border-pokeball-red"
                  : "text-on-surface-variant border-transparent hover:text-on-surface"
              }`}
            >
              <span className="sm:hidden">{t(`tabsShort.${tabId}`)}</span>
              <span className="hidden sm:inline">{t(`tabs.${tabId}`)}</span>
              {tabId === "mine" && unseenCount > 0 && (
                <span
                  title={t("unseenTitle", { count: unseenCount })}
                  className="min-w-4.5 h-4.5 px-1 rounded-full bg-electric-yellow text-surface text-[10px] font-bold flex items-center justify-center"
                >
                  {unseenCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {tab === "browse" && (
          <BrowseTab locale={locale} userId={userId} coins={user.coins} filters={filters} />
        )}
        {tab === "sell" && <SellTab locale={locale} userId={userId} />}
        {tab === "mine" && <MineTab locale={locale} userId={userId} />}
        {tab === "bought" && <BoughtTab userId={userId} />}
      </div>
    </div>
  );
}

function parsePositiveInt(raw: string | undefined): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

type Expiry = { kind: "soon" } | { kind: "hours"; value: number } | { kind: "days"; value: number };

// Redondear siempre a días mostraba "expira en 0 días" durante las últimas
// horas de vida de una publicación.
function expiryIn(date: Date): Expiry {
  const remainingMs = date.getTime() - Date.now();
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
  if (remainingMs <= 0 || hours <= 1) return { kind: "soon" };
  if (hours < 24) return { kind: "hours", value: hours };
  return { kind: "days", value: Math.ceil(hours / 24) };
}

async function ExpiryNote({ date, className }: { date: Date; className?: string }) {
  const t = await getTranslations("market");
  const expiry = expiryIn(date);
  const text =
    expiry.kind === "soon"
      ? t("expiresSoon")
      : expiry.kind === "hours"
        ? t("expiresInHours", { hours: expiry.value })
        : t("expiresIn", { days: expiry.value });

  return <span className={className}>{text}</span>;
}

// ---------- Explorar: publicaciones activas de todos los jugadores ----------

function browseHref(filters: BrowseFilters, page: number): string {
  const params = new URLSearchParams({ tab: "browse" });
  if (filters.q) params.set("q", filters.q);
  if (filters.kind !== "all") params.set("kind", filters.kind);
  if (filters.min !== null) params.set("min", String(filters.min));
  if (filters.max !== null) params.set("max", String(filters.max));
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  return `/market?${params.toString()}`;
}

async function BrowseTab({
  locale,
  userId,
  coins,
  filters,
}: {
  locale: string;
  userId: string;
  coins: number;
  filters: BrowseFilters;
}) {
  const t = await getTranslations("market");

  const where: Prisma.MarketListingWhereInput = { status: "ACTIVE" };
  if (filters.kind === "pokemon") where.kind = "POKEMON";
  if (filters.kind === "item") where.kind = "ITEM";
  if (filters.min !== null || filters.max !== null) {
    where.price = {
      ...(filters.min !== null ? { gte: filters.min } : {}),
      ...(filters.max !== null ? { lte: filters.max } : {}),
    };
  }
  if (filters.q) {
    // MarketListing.itemId no es una relación, así que la búsqueda por nombre
    // de objeto se resuelve primero contra Item y después por id.
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

  const [total, listings] = await Promise.all([
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
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const itemIds = listings.flatMap((l) => (l.itemId ? [l.itemId] : []));
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const itemById = new Map(items.map((i) => [i.id, i]));

  const hasFilters =
    filters.q !== "" ||
    filters.kind !== "all" ||
    filters.min !== null ||
    filters.max !== null ||
    filters.sort !== "recent";

  return (
    <div className="flex flex-col gap-4">
      <MarketFilterForm
        q={filters.q}
        kind={filters.kind}
        sort={filters.sort}
        min={filters.min}
        max={filters.max}
        minPrice={MIN_PRICE}
        maxPrice={MAX_PRICE}
        hasFilters={hasFilters}
        kinds={KINDS}
        sorts={SORTS}
        labels={{
          searchPlaceholder: t("filters.searchPlaceholder"),
          apply: t("filters.apply"),
          clear: t("filters.clear"),
          sortLabel: t("filters.sortLabel"),
          minPrice: t("filters.minPrice"),
          maxPrice: t("filters.maxPrice"),
          kind: {
            all: t("filters.kind.all"),
            pokemon: t("filters.kind.pokemon"),
            item: t("filters.kind.item"),
          },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => {
            const isOwn = listing.sellerId === userId;
            const canAfford = coins >= listing.price;
            const item = listing.itemId ? itemById.get(listing.itemId) : null;
            const quantity = listing.quantity ?? 1;
            const displayName =
              listing.kind === "POKEMON" && listing.pokemon
                ? (listing.pokemon.nickname ?? listing.pokemon.species.name)
                : (item?.name ?? "—");

            return (
              <article
                key={listing.id}
                className="bg-glass-surface backdrop-blur-xl border border-white/10 rounded-xl p-4 flex flex-col gap-3"
              >
                {listing.kind === "POKEMON" && listing.pokemon ? (
                  <PokemonListingDetail
                    pokemon={listing.pokemon}
                    labels={{
                      level: t("level", { level: listing.pokemon.level }),
                      shiny: t("shiny"),
                      moves: t("moves"),
                      hp: t("stats.hp"),
                      atk: t("stats.atk"),
                      def: t("stats.def"),
                      spAtk: t("stats.spAtk"),
                      spDef: t("stats.spDef"),
                      speed: t("stats.speed"),
                      invested: (n: number) => t("investedPoints", { count: n }),
                      unspent: (n: number) => t("unspentPoints", { count: n }),
                    }}
                  />
                ) : item ? (
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-surface-container-high border-2 border-surface-variant flex items-center justify-center overflow-hidden shrink-0 p-2">
                      <Image
                        src={itemSpriteUrl(item.name)}
                        alt={item.name}
                        width={40}
                        height={40}
                        className="w-full h-full object-contain [image-rendering:pixelated]"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-headline-md text-on-surface leading-tight truncate">
                        {item.name}
                      </h2>
                      <span className="text-label-sm text-on-surface-variant">
                        {t("quantity", { count: quantity })}
                      </span>
                      {item.effectText && (
                        <p className="text-label-sm text-on-surface-variant/70 mt-0.5 line-clamp-2">
                          {item.effectText}
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-white/5">
                  <div className="flex flex-col min-w-0">
                    <span className="flex items-center gap-1 text-headline-md text-electric-yellow font-mono">
                      <span className="material-symbols-outlined text-[16px]">paid</span>
                      {listing.price}
                    </span>
                    {listing.kind === "ITEM" && quantity > 1 && (
                      <span className="text-label-sm text-on-surface-variant">
                        {t("unitPrice", { price: Math.round(listing.price / quantity) })}
                      </span>
                    )}
                    <span className="text-label-sm text-on-surface-variant truncate">
                      {t("seller", { name: listing.seller.username })}
                    </span>
                    {listing.expiresAt && (
                      <ExpiryNote
                        date={listing.expiresAt}
                        className="text-label-sm text-on-surface-variant/70"
                      />
                    )}
                  </div>
                  {isOwn ? (
                    <form action={cancelListing.bind(null, locale)}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <MarketSubmitButton
                        label={t("cancel")}
                        pendingLabel={t("cancelling")}
                        className={GHOST_BUTTON_CLASS}
                      />
                    </form>
                  ) : (
                    <form action={buyListing.bind(null, locale)}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <MarketSubmitButton
                        label={
                          canAfford
                            ? t("buy")
                            : t("needFunds", { missing: listing.price - coins })
                        }
                        pendingLabel={t("buying")}
                        disabled={!canAfford}
                        className={PRIMARY_BUTTON_CLASS}
                        confirmMessage={
                          listing.price >= CONFIRM_PRICE_THRESHOLD
                            ? t("confirmBuy", { name: displayName, price: listing.price })
                            : undefined
                        }
                      />
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 mt-2">
          {filters.page > 1 ? (
            <Link
              href={browseHref(filters, filters.page - 1)}
              className="text-label-md px-3 py-1.5 rounded-lg border border-white/10 text-on-surface hover:border-pokeball-red/40 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              {t("pagination.prev")}
            </Link>
          ) : (
            <span className="text-label-md px-3 py-1.5 rounded-lg border border-white/5 text-on-surface-variant/40 flex items-center gap-1">
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
              className="text-label-md px-3 py-1.5 rounded-lg border border-white/10 text-on-surface hover:border-pokeball-red/40 transition-colors flex items-center gap-1"
            >
              {t("pagination.next")}
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          ) : (
            <span className="text-label-md px-3 py-1.5 rounded-lg border border-white/5 text-on-surface-variant/40 flex items-center gap-1">
              {t("pagination.next")}
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </span>
          )}
        </nav>
      )}
    </div>
  );
}

// Ficha completa del Pokémon publicado: el comprador ve stats reales
// (calculados con los puntos invertidos) y los movimientos que sabe — que son
// parte del valor real de la criatura — antes de decidir.
function PokemonListingDetail({
  pokemon,
  labels,
}: {
  pokemon: {
    nickname: string | null;
    level: number;
    isShiny: boolean;
    ptStrength: number;
    ptDexterity: number;
    ptIntelligence: number;
    ptSpeed: number;
    unspentPoints: number;
    moves: { move: { name: string; type: string } }[];
    species: {
      name: string;
      spriteUrl: string;
      types: string[];
      baseHp: number;
      baseAttack: number;
      baseDefense: number;
      baseSpAtk: number;
      baseSpDef: number;
      baseSpeed: number;
    };
  };
  labels: {
    level: string;
    shiny: string;
    moves: string;
    hp: string;
    atk: string;
    def: string;
    spAtk: string;
    spDef: string;
    speed: string;
    invested: (n: number) => string;
    unspent: (n: number) => string;
  };
}) {
  const { species } = pokemon;
  const stats = [
    { label: labels.hp, value: calculateMaxHp(species.baseHp, pokemon.level) },
    { label: labels.atk, value: calculateStat(species.baseAttack, pokemon.ptStrength, pokemon.level) },
    { label: labels.def, value: calculateStat(species.baseDefense, pokemon.ptDexterity, pokemon.level) },
    { label: labels.spAtk, value: calculateStat(species.baseSpAtk, pokemon.ptIntelligence, pokemon.level) },
    { label: labels.spDef, value: calculateStat(species.baseSpDef, pokemon.ptIntelligence, pokemon.level) },
    { label: labels.speed, value: calculateStat(species.baseSpeed, pokemon.ptSpeed, pokemon.level) },
  ];
  const invested =
    pokemon.ptStrength + pokemon.ptDexterity + pokemon.ptIntelligence + pokemon.ptSpeed;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-surface-container-high border-2 border-surface-variant flex items-center justify-center overflow-hidden shrink-0">
          <Image
            src={species.spriteUrl}
            alt={species.name}
            width={56}
            height={56}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <h2 className="text-headline-md text-on-surface capitalize leading-tight truncate">
            {pokemon.nickname ?? species.name}
            {pokemon.isShiny && (
              <span className="ml-1.5 text-label-sm text-electric-yellow align-middle">
                ✦ {labels.shiny}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-label-sm text-on-surface-variant">{labels.level}</span>
            {species.types.map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="px-1.5 py-0.5 rounded text-[10px] uppercase border"
                  style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
                >
                  {type}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-label-sm bg-surface-container/50 p-2 rounded border border-white/5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex justify-between">
            <span className="text-on-surface-variant">{stat.label}</span>
            <span className="text-on-surface font-mono">{stat.value}</span>
          </div>
        ))}
      </div>

      {pokemon.moves.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-label-sm text-on-surface-variant">{labels.moves}</span>
          <div className="flex flex-wrap gap-1">
            {pokemon.moves.map(({ move }) => {
              const color = typeColor(move.type);
              return (
                <span
                  key={move.name}
                  className="px-1.5 py-0.5 rounded text-[10px] capitalize border"
                  style={{ backgroundColor: `${color}22`, color, borderColor: `${color}44` }}
                >
                  {move.name.replace(/-/g, " ")}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {(invested > 0 || pokemon.unspentPoints > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          {invested > 0 && (
            <span className="text-label-sm px-2 py-0.5 rounded bg-tertiary/10 border border-tertiary/30 text-tertiary">
              {labels.invested(invested)}
            </span>
          )}
          {pokemon.unspentPoints > 0 && (
            <span className="text-label-sm px-2 py-0.5 rounded bg-electric-yellow/10 border border-electric-yellow/30 text-electric-yellow">
              {labels.unspent(pokemon.unspentPoints)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Vender: publicar Pokémon propios u objetos del inventario ----------

async function SellTab({ locale, userId }: { locale: string; userId: string }) {
  const t = await getTranslations("market");
  const [pokemon, inventory] = await Promise.all([
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId, listings: { none: { status: "ACTIVE" } } },
      include: {
        species: true,
        battleSessions: { where: { status: "ACTIVE" }, select: { id: true } },
      },
      orderBy: [{ teamSlot: { sort: "asc", nulls: "last" } }, { caughtAt: "asc" }],
    }),
    prisma.inventoryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { item: true },
      orderBy: { item: { name: "asc" } },
    }),
  ]);

  const teamCount = pokemon.filter((p) => p.teamSlot !== null).length;
  const [speciesPrices, itemPrices] = await Promise.all([
    lastSpeciesSalePrices(pokemon.map((p) => p.speciesId)),
    lastItemUnitPrices(inventory.map((i) => i.itemId)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-label-sm text-on-surface-variant">
        {t("sellRules", {
          commission: COMMISSION_RATE * 100,
          fee: LISTING_FEE_RATE * 100,
          days: LISTING_TTL_DAYS,
        })}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <section className="flex flex-col gap-3">
          <h2 className="text-label-md uppercase tracking-wide text-on-surface-variant">
            {t("sellPokemon")}
          </h2>
          <div className="flex flex-col gap-2">
            {pokemon.length === 0 && <EmptyState icon="pets" label={t("emptyPokemon")} />}
            {pokemon.map((instance) => {
              const isLastTeamMember = instance.teamSlot !== null && teamCount <= 1;
              const isInBattle = instance.battleSessions.length > 0;
              // El motivo se muestra acá en vez de dejar que el submit falle con
              // un error genérico después de haber cargado el precio.
              const blockedReason = isInBattle
                ? t("inBattle")
                : isLastTeamMember
                  ? t("lastTeamMember")
                  : null;
              const reference = speciesPrices.get(instance.speciesId);

              return (
                <form
                  key={instance.id}
                  action={listPokemon.bind(null, locale)}
                  className="bg-glass-surface border border-white/10 rounded-xl p-3 flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="pokemonId" value={instance.id} />
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-surface-container-high border border-surface-variant flex items-center justify-center overflow-hidden shrink-0">
                      <Image
                        src={instance.species.spriteUrl}
                        alt={instance.species.name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-label-md text-on-surface capitalize block truncate">
                        {instance.nickname ?? instance.species.name}
                      </span>
                      <span className="text-label-sm text-on-surface-variant">
                        {t("level", { level: instance.level })}
                        {instance.teamSlot !== null && ` · ${t("inTeam")}`}
                        {` · ${
                          reference !== undefined
                            ? t("lastSale", { price: reference })
                            : t("noSalesYet")
                        }`}
                      </span>
                      {blockedReason && (
                        <span className="mt-1 inline-block text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-on-surface-variant">
                          {blockedReason}
                        </span>
                      )}
                    </div>
                  </div>
                  {!blockedReason && <MarketSellControls mode="pokemon" />}
                </form>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-label-md uppercase tracking-wide text-on-surface-variant">
            {t("sellItems")}
          </h2>
          <div className="flex flex-col gap-2">
            {inventory.length === 0 && <EmptyState icon="inventory_2" label={t("emptyItems")} />}
            {inventory.map(({ item, quantity }) => {
              const reference = itemPrices.get(item.id);
              return (
                <form
                  key={item.id}
                  action={listItem.bind(null, locale)}
                  className="bg-glass-surface border border-white/10 rounded-xl p-3 flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="itemId" value={item.id} />
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-surface-container-high border border-surface-variant flex items-center justify-center overflow-hidden shrink-0 p-1.5">
                      <Image
                        src={itemSpriteUrl(item.name)}
                        alt={item.name}
                        width={28}
                        height={28}
                        className="w-full h-full object-contain [image-rendering:pixelated]"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-label-md text-on-surface block truncate">{item.name}</span>
                      <span className="text-label-sm text-on-surface-variant">
                        {t("owned", { count: quantity })}
                        {` · ${
                          reference !== undefined
                            ? t("lastSaleUnit", { price: reference })
                            : t("noSalesYet")
                        }`}
                      </span>
                    </div>
                  </div>
                  <MarketSellControls mode="item" maxQuantity={quantity} />
                </form>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// Precio de referencia: la última venta cerrada de cada especie / objeto. Sin
// esto, publicar es adivinar — y los precios inventados desestabilizan la
// economía tanto como la inflación.
async function lastSpeciesSalePrices(speciesIds: number[]): Promise<Map<number, number>> {
  if (speciesIds.length === 0) return new Map();
  const sales = await prisma.marketListing.findMany({
    where: {
      status: "SOLD",
      kind: "POKEMON",
      pokemon: { is: { speciesId: { in: [...new Set(speciesIds)] } } },
    },
    select: { price: true, pokemon: { select: { speciesId: true } } },
    orderBy: { soldAt: "desc" },
    take: PRICE_HISTORY_SAMPLE,
  });

  const prices = new Map<number, number>();
  for (const sale of sales) {
    const speciesId = sale.pokemon?.speciesId;
    if (speciesId !== undefined && !prices.has(speciesId)) prices.set(speciesId, sale.price);
  }
  return prices;
}

async function lastItemUnitPrices(itemIds: string[]): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const sales = await prisma.marketListing.findMany({
    where: { status: "SOLD", kind: "ITEM", itemId: { in: [...new Set(itemIds)] } },
    select: { price: true, quantity: true, itemId: true },
    orderBy: { soldAt: "desc" },
    take: PRICE_HISTORY_SAMPLE,
  });

  const prices = new Map<string, number>();
  for (const sale of sales) {
    if (!sale.itemId || prices.has(sale.itemId)) continue;
    prices.set(sale.itemId, Math.round(sale.price / Math.max(1, sale.quantity ?? 1)));
  }
  return prices;
}

// ---------- Mis publicaciones: activas e historial reciente ----------

async function MineTab({ locale, userId }: { locale: string; userId: string }) {
  const t = await getTranslations("market");
  const listings = await prisma.marketListing.findMany({
    where: { sellerId: userId },
    include: {
      pokemon: { include: { species: true } },
      buyer: { select: { username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // Abrir la pestaña cuenta como "ya me enteré": apaga el contador de
  // novedades de las ventas concretadas y las publicaciones que vencieron.
  await prisma.marketListing.updateMany({
    where: { sellerId: userId, status: { in: ["SOLD", "EXPIRED"] }, sellerSeenAt: null },
    data: { sellerSeenAt: new Date() },
  });

  const itemIds = listings.flatMap((l) => (l.itemId ? [l.itemId] : []));
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const itemById = new Map(items.map((i) => [i.id, i]));

  if (listings.length === 0) {
    return <EmptyState icon="receipt_long" label={t("emptyMine")} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {listings.map((listing) => {
        const item = listing.itemId ? itemById.get(listing.itemId) : null;
        const name =
          listing.kind === "POKEMON" && listing.pokemon
            ? (listing.pokemon.nickname ?? listing.pokemon.species.name)
            : (item?.name ?? "—");
        const isNews = listing.sellerSeenAt === null && listing.status !== "ACTIVE";

        return (
          <div
            key={listing.id}
            className={`bg-glass-surface backdrop-blur-xl border rounded-xl p-3 flex items-center gap-3 ${
              isNews ? "border-electric-yellow/40" : "border-white/10"
            }`}
          >
            <ListingAvatar listing={listing} item={item ?? null} />
            <div className="min-w-0 flex-1">
              <span className="text-label-md text-on-surface capitalize block truncate">
                {name}
                {listing.kind === "ITEM" && listing.quantity ? ` ×${listing.quantity}` : ""}
              </span>
              <span className="text-label-sm text-on-surface-variant">
                {listing.status === "SOLD" && listing.buyer
                  ? t("soldTo", {
                      name: listing.buyer.username,
                      coins: proceedsFor(listing.price),
                    })
                  : t(`status.${listing.status}`)}
                {listing.status === "EXPIRED" && ` · ${t("returnedToPc")}`}
                {listing.status === "ACTIVE" && listing.expiresAt && (
                  <>
                    {" · "}
                    <ExpiryNote date={listing.expiresAt} />
                  </>
                )}
              </span>
            </div>
            <span className="flex items-center gap-1 text-label-md text-electric-yellow font-mono shrink-0">
              <span className="material-symbols-outlined text-[14px]">paid</span>
              {listing.price}
            </span>
            {listing.status === "ACTIVE" && (
              <form action={cancelListing.bind(null, locale)}>
                <input type="hidden" name="listingId" value={listing.id} />
                <MarketSubmitButton
                  label={t("cancel")}
                  pendingLabel={t("cancelling")}
                  className={GHOST_BUTTON_CLASS}
                />
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Compradas: el otro lado del historial ----------

async function BoughtTab({ userId }: { userId: string }) {
  const t = await getTranslations("market");
  const listings = await prisma.marketListing.findMany({
    where: { buyerId: userId, status: "SOLD" },
    include: {
      pokemon: { include: { species: true } },
      seller: { select: { username: true } },
    },
    orderBy: { soldAt: "desc" },
    take: 30,
  });

  const itemIds = listings.flatMap((l) => (l.itemId ? [l.itemId] : []));
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const itemById = new Map(items.map((i) => [i.id, i]));

  if (listings.length === 0) {
    return <EmptyState icon="shopping_bag" label={t("emptyBought")} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {listings.map((listing) => {
        const item = listing.itemId ? itemById.get(listing.itemId) : null;
        const name =
          listing.kind === "POKEMON" && listing.pokemon
            ? (listing.pokemon.nickname ?? listing.pokemon.species.name)
            : (item?.name ?? "—");

        return (
          <div
            key={listing.id}
            className="bg-glass-surface backdrop-blur-xl border border-white/10 rounded-xl p-3 flex items-center gap-3"
          >
            <ListingAvatar listing={listing} item={item ?? null} />
            <div className="min-w-0 flex-1">
              <span className="text-label-md text-on-surface capitalize block truncate">
                {name}
                {listing.kind === "ITEM" && listing.quantity ? ` ×${listing.quantity}` : ""}
              </span>
              <span className="text-label-sm text-on-surface-variant">
                {t("boughtFrom", { name: listing.seller.username })}
              </span>
            </div>
            <span className="flex items-center gap-1 text-label-md text-electric-yellow font-mono shrink-0">
              <span className="material-symbols-outlined text-[14px]">paid</span>
              {listing.price}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ListingAvatar({
  listing,
  item,
}: {
  listing: { kind: string; pokemon: { species: { name: string; spriteUrl: string } } | null };
  item: { name: string } | null;
}) {
  return (
    <div className="w-10 h-10 rounded-full bg-surface-container-high border border-surface-variant flex items-center justify-center overflow-hidden shrink-0 p-1.5">
      {listing.kind === "POKEMON" && listing.pokemon ? (
        <Image
          src={listing.pokemon.species.spriteUrl}
          alt={listing.pokemon.species.name}
          width={40}
          height={40}
          className="w-full h-full object-cover"
        />
      ) : item ? (
        <Image
          src={itemSpriteUrl(item.name)}
          alt={item.name}
          width={28}
          height={28}
          className="w-full h-full object-contain [image-rendering:pixelated]"
          unoptimized
        />
      ) : (
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">help</span>
      )}
    </div>
  );
}

function EmptyState({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="bg-glass-surface border border-white/5 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-on-surface-variant">
      <span className="material-symbols-outlined text-[40px] mb-2 opacity-50">{icon}</span>
      <span className="text-label-md">{label}</span>
    </div>
  );
}
