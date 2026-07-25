import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { ShopTerminal, type ShopEntry, type ShopLabels } from "@/components/shop-terminal";

const SHOP_TYPES = ["POTION", "POKEBALL", "HELD"] as const;

export default async function ShopPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, session] = await Promise.all([getTranslations("shop"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  await redirectIfInBattle(userId, locale);

  const [items, user] = await Promise.all([
    prisma.item.findMany({
      where: { type: { in: [...SHOP_TYPES] }, buyPrice: { gt: 0 } },
      orderBy: [{ type: "asc" }, { buyPrice: "asc" }],
    }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true } }),
  ]);

  const entries: ShopEntry[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type as ShopEntry["type"],
    buyPrice: item.buyPrice,
    effectText: item.effectText,
  }));

  const labels: ShopLabels = {
    types: {
      POTION: t("types.POTION"),
      POKEBALL: t("types.POKEBALL"),
      HELD: t("types.HELD"),
    },
    buy: t("buy"),
    buying: t("buying"),
    noCoins: t("noCoins"),
    coinsLabel: t("coinsLabel"),
  };

  return (
    <div className="flex-1 px-margin-mobile py-6 md:px-margin-desktop md:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-0.5 flex items-center gap-2 text-label-sm uppercase tracking-[0.2em] text-pokeball-red">
              <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
              {t("eyebrow")}
            </p>
            <h1 className="text-headline-lg tracking-tight text-white">{t("title")}</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2">
            <span className="material-symbols-outlined text-[16px]! text-tertiary">paid</span>
            <span className="font-mono text-label-md font-semibold text-white">{user.coins}</span>
          </div>
        </header>

        <ShopTerminal entries={entries} labels={labels} locale={locale} initialCoins={user.coins} />
      </div>
    </div>
  );
}
