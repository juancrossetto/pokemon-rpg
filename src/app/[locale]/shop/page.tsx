import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { ShopTerminal, type ShopLabels } from "@/components/shop-terminal";
import { TradeTabs } from "@/components/trade-tabs";
import { TradeHelp } from "@/components/trade-help";
import {
  SHOP_CATEGORIES,
  itemKey,
  resolveDescription,
  toProduct,
  type ShopProduct,
} from "@/lib/shop";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, tUx, session] = await Promise.all([
    getTranslations("shop"),
    getTranslations("ux"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  await redirectIfInBattle(userId, locale);

  // El inventario se pide una sola vez para todo el catálogo: una consulta por
  // card sería una por producto, y el catálogo va a crecer.
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
  // `t.has` evita el throw de next-intl cuando un ítem del seed todavía no
  // tiene traducción: en ese caso `resolveDescription` cae al texto de la base.
  const describe = {
    catchRate: (multiplier: string) => t("catchRate", { multiplier }),
    healAmount: (amount: number) => t("healAmount", { amount }),
    healFull: () => t("healFull"),
    byName: (name: string) => {
      const key = `effects.${itemKey(name)}`;
      return t.has(key) ? t(key) : null;
    },
  };

  const products: ShopProduct[] = items.map((item) =>
    toProduct(item, ownedByItem.get(item.id) ?? 0, resolveDescription(item, describe)),
  );

  const labels: ShopLabels = {
    categories: {
      POKEBALL: t("types.POKEBALL"),
      POTION: t("types.POTION"),
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
    <div className="flex-1 px-margin-mobile py-5 md:px-margin-desktop md:py-8">
      <div className="mx-auto max-w-6xl">
        <TradeTabs active="shop" />
        <TradeHelp />
        <p className="mb-4 text-label-md text-on-surface-variant">{tUx("role.shop")}</p>
        <ShopTerminal
          products={products}
          labels={labels}
          locale={locale}
          initialCoins={user.coins}
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
        />
      </div>
    </div>
  );
}
