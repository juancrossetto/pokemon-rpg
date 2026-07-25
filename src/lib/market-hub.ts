import type { ItemType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Categorías del Trading Hub alineadas al catálogo real. */
export const MARKET_CATEGORIES = [
  "all",
  "healing",
  "pokeballs",
  "berries",
  "evolution",
  "pokemon",
] as const;

export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

export const MARKET_CATEGORY_META: Record<
  MarketCategory,
  { icon: string; itemType?: ItemType; listingKind?: "POKEMON" | "ITEM" }
> = {
  all: { icon: "apps" },
  healing: { icon: "healing", itemType: "POTION", listingKind: "ITEM" },
  pokeballs: { icon: "sports_baseball", itemType: "POKEBALL", listingKind: "ITEM" },
  berries: { icon: "nutrition", itemType: "BERRY", listingKind: "ITEM" },
  evolution: { icon: "auto_awesome", itemType: "EVOLUTION_STONE", listingKind: "ITEM" },
  pokemon: { icon: "pets", listingKind: "POKEMON" },
};

/** Chips rápidos del hub (subconjunto). */
export const MARKET_QUICK_FILTERS = [
  "all",
  "healing",
  "pokeballs",
  "berries",
  "evolution",
  "pokemon",
] as const satisfies readonly MarketCategory[];

export type MarketRarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_STYLES: Record<
  MarketRarity,
  { border: string; text: string; glow: string; stars: number }
> = {
  common: {
    border: "border-white/20",
    text: "text-on-surface-variant",
    glow: "rgba(255,255,255,0.08)",
    stars: 1,
  },
  rare: {
    border: "border-sky-400/45",
    text: "text-sky-300",
    glow: "rgba(56,189,248,0.18)",
    stars: 2,
  },
  epic: {
    border: "border-violet-400/50",
    text: "text-violet-300",
    glow: "rgba(167,139,250,0.22)",
    stars: 3,
  },
  legendary: {
    border: "border-electric-yellow/55",
    text: "text-electric-yellow",
    glow: "rgba(242,192,0,0.28)",
    stars: 5,
  },
};

export function itemRarity(item: {
  name: string;
  type: ItemType;
  buyPrice: number;
}): MarketRarity {
  const name = item.name.toLowerCase();
  if (name.includes("master") || name.includes("full restore")) return "legendary";
  if (item.type === "EVOLUTION_STONE" || item.buyPrice >= 2000) return "epic";
  if (item.buyPrice >= 600) return "rare";
  return "common";
}

export function pokemonRarity(input: {
  isShiny: boolean;
  level: number;
  invested: number;
}): MarketRarity {
  if (input.isShiny) return "legendary";
  if (input.level >= 50 || input.invested >= 40) return "epic";
  if (input.level >= 25 || input.invested >= 15) return "rare";
  return "common";
}

/** % de entrenamiento aproximado (no hay IVs en el esquema). */
export function trainingPercent(invested: number, level: number): number {
  const expected = Math.max(1, (level - 1) * 2);
  return Math.min(100, Math.round((invested / expected) * 100));
}

export function categoryItemType(cat: MarketCategory): ItemType | null {
  return MARKET_CATEGORY_META[cat].itemType ?? null;
}

export async function resolveCategoryWhere(
  cat: MarketCategory,
): Promise<Prisma.MarketListingWhereInput | null> {
  const meta = MARKET_CATEGORY_META[cat];
  if (cat === "all") return null;
  if (meta.listingKind === "POKEMON") return { kind: "POKEMON" };
  if (meta.itemType) {
    const items = await prisma.item.findMany({
      where: { type: meta.itemType },
      select: { id: true },
    });
    return { kind: "ITEM", itemId: { in: items.map((i) => i.id) } };
  }
  return null;
}

export type MarketHubStats = {
  listings: number;
  traders: number;
  soldToday: number;
  averagePrice: number;
};

export type MarketTrendingRow = {
  key: string;
  label: string;
  kind: "ITEM" | "POKEMON";
  count: number;
  direction: "up" | "down" | "flat";
};

export type MarketActivityRow = {
  id: string;
  kind: "bought" | "sold" | "listed";
  actor: string;
  label: string;
  at: Date;
};

export async function fetchMarketHubStats(): Promise<MarketHubStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [listings, traderGroups, soldToday, avg] = await Promise.all([
    prisma.marketListing.count({ where: { status: "ACTIVE" } }),
    prisma.marketListing.groupBy({
      by: ["sellerId"],
      where: { status: "ACTIVE" },
    }),
    prisma.marketListing.count({
      where: { status: "SOLD", soldAt: { gte: startOfDay } },
    }),
    prisma.marketListing.aggregate({
      where: { status: "ACTIVE" },
      _avg: { price: true },
    }),
  ]);

  return {
    listings,
    traders: traderGroups.length,
    soldToday,
    averagePrice: Math.round(avg._avg.price ?? 0),
  };
}

export async function fetchTrending(limit = 5): Promise<MarketTrendingRow[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await prisma.marketListing.findMany({
    where: {
      OR: [
        { status: "ACTIVE" },
        { status: "SOLD", soldAt: { gte: since } },
      ],
    },
    select: {
      kind: true,
      itemId: true,
      pokemon: { select: { species: { select: { name: true } } } },
      createdAt: true,
      soldAt: true,
    },
    take: 400,
    orderBy: { createdAt: "desc" },
  });

  const itemIds = [...new Set(recent.flatMap((r) => (r.itemId ? [r.itemId] : [])))];
  const items = itemIds.length
    ? await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } })
    : [];
  const itemName = new Map(items.map((i) => [i.id, i.name]));

  const counts = new Map<string, { label: string; kind: "ITEM" | "POKEMON"; count: number; recent: number }>();
  const weekMid = Date.now() - 3.5 * 24 * 60 * 60 * 1000;

  for (const row of recent) {
    const label =
      row.kind === "POKEMON"
        ? (row.pokemon?.species.name ?? "Pokémon")
        : (row.itemId ? itemName.get(row.itemId) : null) ?? "Item";
    const key = `${row.kind}:${label.toLowerCase()}`;
    const entry = counts.get(key) ?? { label, kind: row.kind, count: 0, recent: 0 };
    entry.count += 1;
    const stamp = (row.soldAt ?? row.createdAt).getTime();
    if (stamp >= weekMid) entry.recent += 1;
    counts.set(key, entry);
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((row) => {
      const older = row.count - row.recent;
      const direction =
        row.recent > older + 1 ? "up" : row.recent + 1 < older ? "down" : "flat";
      return {
        key: `${row.kind}:${row.label}`,
        label: row.label,
        kind: row.kind,
        count: row.count,
        direction,
      };
    });
}

export async function fetchRecentActivity(limit = 8): Promise<MarketActivityRow[]> {
  const [sold, listed] = await Promise.all([
    prisma.marketListing.findMany({
      where: { status: "SOLD", buyerId: { not: null } },
      include: {
        buyer: { select: { username: true } },
        seller: { select: { username: true } },
        pokemon: { select: { nickname: true, species: { select: { name: true } } } },
      },
      orderBy: { soldAt: "desc" },
      take: limit,
    }),
    prisma.marketListing.findMany({
      where: { status: "ACTIVE" },
      include: {
        seller: { select: { username: true } },
        pokemon: { select: { nickname: true, species: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const itemIds = [
    ...new Set(
      [...sold, ...listed].flatMap((l) => (l.itemId ? [l.itemId] : [])),
    ),
  ];
  const items = itemIds.length
    ? await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } })
    : [];
  const itemName = new Map(items.map((i) => [i.id, i.name]));

  function labelOf(row: (typeof sold)[number] | (typeof listed)[number]): string {
    if (row.kind === "POKEMON" && row.pokemon) {
      return row.pokemon.nickname ?? row.pokemon.species.name;
    }
    return (row.itemId && itemName.get(row.itemId)) || "—";
  }

  const rows: MarketActivityRow[] = [
    ...sold.map((row) => ({
      id: `bought-${row.id}`,
      kind: "bought" as const,
      actor: row.buyer?.username ?? "?",
      label: labelOf(row),
      at: row.soldAt ?? row.createdAt,
    })),
    ...listed.map((row) => ({
      id: `listed-${row.id}`,
      kind: "listed" as const,
      actor: row.seller.username,
      label: labelOf(row),
      at: row.createdAt,
    })),
  ];

  return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
