import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { expireDueListings } from "@/lib/market-expiry";
import { MarketSubmitButton } from "@/components/market-submit-button";
import { MarketSellControls } from "@/components/market-sell-controls";
import { MarketBrowseTab } from "@/components/market-browse-tab";
import { MarketHubHero } from "@/components/market-hub-chrome";
import {
  MARKET_CATEGORIES,
  fetchMarketHubStats,
  type MarketCategory,
} from "@/lib/market-hub";
import {
  MARKET_ERRORS,
  MARKET_NOTICES,
  pickCode,
} from "@/lib/feedback-codes";
import {
  COMMISSION_RATE,
  LISTING_FEE_RATE,
  LISTING_TTL_DAYS,
  proceedsFor,
} from "@/lib/market-rules";
import { cancelListing, claimPurchase, listItem, listPokemon } from "@/actions/market";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { spriteFor } from "@/lib/shiny";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { unclaimedPurchasesWhere } from "@/lib/market-delivery";
const TABS = ["browse", "sell", "mine", "bought"] as const;
type Tab = (typeof TABS)[number];

const SORTS = ["recent", "price_asc", "price_desc", "level_desc"] as const;
type Sort = (typeof SORTS)[number];

// Cuántas ventas cerradas se miran para calcular el precio de referencia.
const PRICE_HISTORY_SAMPLE = 200;

const GHOST_BUTTON_CLASS =
  "text-label-md px-4 py-1.5 rounded-md border border-white/10 text-on-surface-variant hover:text-pokeball-red hover:border-pokeball-red/40 transition-colors";

type BrowseFilters = {
  q: string;
  cat: MarketCategory;
  min: number | null;
  max: number | null;
  sort: Sort;
  page: number;
};

function resolveCategory(query: {
  cat?: string;
  kind?: string;
}): MarketCategory {
  const cat = pickCode(query.cat, MARKET_CATEGORIES);
  if (cat) return cat;
  if (query.kind === "pokemon") return "pokemon";
  return "all";
}

/** Conserva los filtros de Explorar al cambiar de pestaña. */
function marketTabHref(tab: Tab, filters: BrowseFilters): string {
  const params = new URLSearchParams({ tab });
  if (filters.q) params.set("q", filters.q);
  if (filters.cat !== "all") params.set("cat", filters.cat);
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
    cat?: string;
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

  const [user, unseenCount, pendingClaims, hubStats] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true } }),
    prisma.marketListing.count({
      where: { sellerId: userId, status: { in: ["SOLD", "EXPIRED"] }, sellerSeenAt: null },
    }),
    prisma.marketListing.count({ where: unclaimedPurchasesWhere(userId) }),
    fetchMarketHubStats(),
  ]);

  const cat = resolveCategory(query);
  const filters: BrowseFilters = {
    q: (query.q ?? "").trim().slice(0, 50),
    cat,
    min: parsePositiveInt(query.min),
    max: parsePositiveInt(query.max),
    sort: (() => {
      const sort = pickCode(query.sort, SORTS) ?? "recent";
      return cat !== "all" && cat !== "pokemon" && sort === "level_desc" ? "recent" : sort;
    })(),
    page: Math.max(1, parsePositiveInt(query.page) ?? 1),
  };

  return (
    <div className="flex-1 px-margin-mobile py-6 md:px-margin-desktop md:py-8">
      <div className="mx-auto max-w-7xl">
        <MarketHubHero listings={hubStats.listings} />

        {notice && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-tertiary/40 bg-tertiary/10 px-4 py-2 text-label-md text-tertiary">
            <span>{t(`notices.${notice}`)}</span>
            {notice === "bought_pokemon" || notice === "bought" ? (
              <Link
                href="/market?tab=bought"
                className="underline underline-offset-2 transition-colors hover:text-white"
              >
                {t("goToBag")}
              </Link>
            ) : notice === "claimed" ? (
              <Link
                href="/pc"
                className="underline underline-offset-2 transition-colors hover:text-white"
              >
                {t("goToPc")}
              </Link>
            ) : null}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-error/40 bg-error-container/30 px-4 py-2 text-label-md text-error">
            {t(`errors.${error}`)}
          </div>
        )}

        <nav className="mb-5 flex overflow-x-auto border-b border-white/10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tabId) => (
            <Link
              key={tabId}
              href={marketTabHref(tabId, filters)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-label-md transition-colors ${
                tab === tabId
                  ? "border-pokeball-red text-pokeball-red"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="sm:hidden">{t(`tabsShort.${tabId}`)}</span>
              <span className="hidden sm:inline">{t(`tabs.${tabId}`)}</span>
              {tabId === "mine" && unseenCount > 0 && (
                <span
                  title={t("unseenTitle", { count: unseenCount })}
                  className="flex h-4.5 min-w-4.5 items-center justify-center rounded-md bg-electric-yellow px-1 text-[10px] font-bold text-surface"
                >
                  {unseenCount}
                </span>
              )}
              {tabId === "bought" && pendingClaims > 0 && (
                <span
                  title={t("pendingClaimsTitle", { count: pendingClaims })}
                  className="flex h-4.5 min-w-4.5 items-center justify-center rounded-md bg-pokeball-red px-1 text-[10px] font-bold text-white"
                >
                  {pendingClaims}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {tab === "browse" && (
          <MarketBrowseTab
            locale={locale}
            userId={userId}
            coins={user.coins}
            filters={filters}
            hubStats={hubStats}
          />
        )}
        {tab === "sell" && <SellTab locale={locale} userId={userId} />}
        {tab === "mine" && <MineTab locale={locale} userId={userId} />}
        {tab === "bought" && <BoughtTab locale={locale} userId={userId} />}
      </div>
    </div>
  );
}

function parsePositiveInt(raw: string | undefined): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

type Expiry = { kind: "soon" } | { kind: "hours"; value: number } | { kind: "days"; value: number };

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

// ---------- Vender: publicar Pokémon propios u objetos del inventario ----------

async function SellTab({ locale, userId }: { locale: string; userId: string }) {
  const t = await getTranslations("market");
  const [pokemon, inventory] = await Promise.all([
    prisma.pokemonInstance.findMany({
      where: {
        ownerId: userId,
        listings: {
          none: {
            OR: [
              { status: "ACTIVE" },
              { status: "SOLD", buyerId: userId, buyerClaimedAt: null },
            ],
          },
        },
      },
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
                        src={spriteFor(instance.species.spriteUrl, instance.isShiny)}
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

// ---------- Mochila: compras pendientes de retirar + historial ----------

async function BoughtTab({ locale, userId }: { locale: string; userId: string }) {
  const t = await getTranslations("market");
  const listings = await prisma.marketListing.findMany({
    where: { buyerId: userId, status: "SOLD" },
    include: {
      pokemon: { include: { species: true } },
      seller: { select: { username: true } },
    },
    orderBy: { soldAt: "desc" },
    take: 40,
  });

  const itemIds = listings.flatMap((l) => (l.itemId ? [l.itemId] : []));
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const itemById = new Map(items.map((i) => [i.id, i]));

  const pending = listings.filter((l) => l.buyerClaimedAt === null);
  const history = listings.filter((l) => l.buyerClaimedAt !== null);

  if (listings.length === 0) {
    return <EmptyState icon="shopping_bag" label={t("emptyBought")} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-label-md uppercase tracking-wide text-on-surface-variant">
            {t("bagPendingTitle")}
          </h2>
          <p className="mt-1 text-label-sm text-on-surface-variant/80">{t("bagPendingHint")}</p>
        </div>
        {pending.length === 0 ? (
          <EmptyState icon="inventory_2" label={t("bagPendingEmpty")} />
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((listing) => {
              const item = listing.itemId ? itemById.get(listing.itemId) : null;
              const name =
                listing.kind === "POKEMON" && listing.pokemon
                  ? (listing.pokemon.nickname ?? listing.pokemon.species.name)
                  : (item?.name ?? "—");
              const destination =
                listing.kind === "POKEMON" ? t("bagReceiveToPc") : t("bagReceiveToInventory");

              return (
                <div
                  key={listing.id}
                  className="flex flex-col gap-3 rounded-xl border border-pokeball-red/35 bg-glass-surface p-3 backdrop-blur-xl sm:flex-row sm:items-center"
                >
                  <ListingAvatar listing={listing} item={item ?? null} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-label-md capitalize text-on-surface">
                      {name}
                      {listing.kind === "ITEM" && listing.quantity ? ` ×${listing.quantity}` : ""}
                    </span>
                    <span className="text-label-sm text-on-surface-variant">
                      {t("boughtFrom", { name: listing.seller.username })} · {destination}
                    </span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-label-md text-electric-yellow">
                    <span className="material-symbols-outlined text-[14px]">paid</span>
                    {listing.price}
                  </span>
                  <form action={claimPurchase.bind(null, locale)}>
                    <input type="hidden" name="listingId" value={listing.id} />
                    <MarketSubmitButton
                      label={t("bagReceive")}
                      pendingLabel={t("bagReceiving")}
                      className="rounded-md bg-pokeball-red px-4 py-1.5 text-label-md font-semibold text-white transition hover:bg-pokeball-red/85"
                    />
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-label-md uppercase tracking-wide text-on-surface-variant">
            {t("bagHistoryTitle")}
          </h2>
          <div className="flex flex-col gap-2">
            {history.map((listing) => {
              const item = listing.itemId ? itemById.get(listing.itemId) : null;
              const name =
                listing.kind === "POKEMON" && listing.pokemon
                  ? (listing.pokemon.nickname ?? listing.pokemon.species.name)
                  : (item?.name ?? "—");

              return (
                <div
                  key={listing.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-glass-surface p-3 backdrop-blur-xl"
                >
                  <ListingAvatar listing={listing} item={item ?? null} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-label-md capitalize text-on-surface">
                      {name}
                      {listing.kind === "ITEM" && listing.quantity ? ` ×${listing.quantity}` : ""}
                    </span>
                    <span className="text-label-sm text-on-surface-variant">
                      {t("boughtFrom", { name: listing.seller.username })} · {t("bagReceived")}
                    </span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-label-md text-electric-yellow">
                    <span className="material-symbols-outlined text-[14px]">paid</span>
                    {listing.price}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ListingAvatar({
  listing,
  item,
}: {
  listing: {
    kind: string;
    pokemon: {
      isShiny: boolean;
      species: { name: string; spriteUrl: string };
    } | null;
  };
  item: { name: string } | null;
}) {
  return (
    <div className="w-10 h-10 rounded-full bg-surface-container-high border border-surface-variant flex items-center justify-center overflow-hidden shrink-0 p-1.5">
      {listing.kind === "POKEMON" && listing.pokemon ? (
        <Image
          src={spriteFor(listing.pokemon.species.spriteUrl, listing.pokemon.isShiny)}
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
