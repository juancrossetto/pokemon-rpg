import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ShopTerminal, type ShopLabels } from "@/components/shop-terminal";
import {
  SHOP_CATEGORIES,
  itemKey,
  resolveDescription,
  resolveItemDisplayName,
  sortShopCatalog,
  toProduct,
  type ShopProduct,
} from "@/lib/shop";

/** Catálogo oficial embebido en el hub de Comercio (`/market?tab=shop`). */
export async function ShopTab({
  locale,
  userId,
}: {
  locale: string;
  userId: string;
}) {
  const t = await getTranslations("shop");

  const [items, user, inventory] = await Promise.all([
    prisma.item.findMany({
      where: { type: { in: [...SHOP_CATEGORIES] }, buyPrice: { gt: 0 } },
      orderBy: [{ type: "asc" }, { buyPrice: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        buyPrice: true,
        effectText: true,
        catchMultiplier: true,
        healAmount: true,
      },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true } }),
    prisma.inventoryItem.findMany({
      where: { userId },
      select: { itemId: true, quantity: true },
    }),
  ]);

  const ownedByItem = new Map(inventory.map((row) => [row.itemId, row.quantity]));
  const describe = {
    catchRate: (multiplier: string) => t("catchRate", { multiplier }),
    healAmount: (amount: number) => t("healAmount", { amount }),
    healFull: () => t("healFull"),
    byName: (name: string) => {
      const key = `effects.${itemKey(name)}`;
      return t.has(key) ? t(key) : null;
    },
  };

  const products: ShopProduct[] = sortShopCatalog(items).map((item) =>
    toProduct(
      item,
      ownedByItem.get(item.id) ?? 0,
      resolveDescription(item, describe),
      resolveItemDisplayName(item.name, (key) => {
        const path = `names.${key}`;
        return t.has(path) ? t(path) : null;
      }),
    ),
  );

  const labels: ShopLabels = {
    categories: {
      POKEBALL: t("types.POKEBALL"),
      POTION: t("types.POTION"),
      EVOLUTION_STONE: t("types.EVOLUTION_STONE"),
      HELD: t("types.HELD"),
    },
    all: t("all"),
    buy: t("buy"),
    buying: t("buying"),
    insufficient: t("insufficient"),
    owned: t("owned", { count: "{count}" }),
    search: t("search"),
    searchPlaceholder: t("searchPlaceholder"),
    affordableOnly: t("affordableOnly"),
    quantity: t("quantity"),
    unitPrice: t("unitPrice"),
    total: t("total"),
    balanceAfter: t("balanceAfter"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    close: t("close"),
    decrease: t("decrease"),
    increase: t("increase"),
    buyTitle: t("buyTitle", { name: "{name}" }),
    purchased: t("purchased", { count: "{count}", name: "{name}" }),
    missing: t("missing", { amount: "{amount}" }),
    empty: t("empty"),
    emptyAction: t("emptyAction"),
    noResults: t("noResults"),
    errorGeneric: t("errorGeneric"),
    coinsUnit: t("coinsUnit"),
  };

  return (
    <ShopTerminal
      products={products}
      labels={labels}
      locale={locale}
      initialCoins={user.coins}
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
      hideHeader
    />
  );
}
