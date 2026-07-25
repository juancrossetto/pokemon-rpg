import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { unclaimedPurchasesWhere } from "@/lib/market-delivery";

const TYPE_ORDER = ["POTION", "POKEBALL", "BERRY", "EVOLUTION_STONE"] as const;
type ItemType = (typeof TYPE_ORDER)[number];

const TYPE_ICON: Record<ItemType, string> = {
  POTION: "healing",
  POKEBALL: "catching_pokemon",
  BERRY: "nutrition",
  EVOLUTION_STONE: "diamond",
};

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, session] = await Promise.all([getTranslations("inventory"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  await redirectIfInBattle(session.user.id, locale);
  const userId = session.user.id;

  const [rows, pendingClaims] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { item: true },
      orderBy: [{ item: { type: "asc" } }, { item: { name: "asc" } }],
    }),
    prisma.marketListing.count({ where: unclaimedPurchasesWhere(userId) }),
  ]);

  const byType = new Map<ItemType, typeof rows>();
  for (const type of TYPE_ORDER) byType.set(type, []);
  for (const row of rows) {
    const list = byType.get(row.item.type as ItemType);
    if (list) list.push(row);
  }

  const totalUnits = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="flex-1 px-margin-mobile py-6 md:px-margin-desktop md:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-0.5 flex items-center gap-2 text-label-sm uppercase tracking-[0.2em] text-pokeball-red">
              <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
              {t("eyebrow")}
            </p>
            <h1 className="text-headline-lg tracking-tight text-white">{t("title")}</h1>
            <p className="mt-1 text-label-md text-on-surface-variant">
              {rows.length === 0
                ? t("subtitleEmpty")
                : t("subtitle", { kinds: rows.length, units: totalUnits })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/market?tab=bought"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/5 px-3 py-1.5 text-label-sm text-on-surface-variant transition hover:border-pokeball-red/40 hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              {t("marketBag")}
              {pendingClaims > 0 && (
                <span className="rounded bg-pokeball-red px-1.5 text-[10px] font-bold text-white">
                  {pendingClaims}
                </span>
              )}
            </Link>
            <Link
              href="/market?tab=sell"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/5 px-3 py-1.5 text-label-sm text-on-surface-variant transition hover:border-pokeball-red/40 hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">storefront</span>
              {t("sellLink")}
            </Link>
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/12 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant/50">
              inventory_2
            </span>
            <p className="text-label-md text-on-surface-variant">{t("empty")}</p>
            <p className="max-w-sm text-label-sm text-on-surface-variant/70">{t("emptyHint")}</p>
            <Link
              href="/market"
              className="mt-2 rounded-md bg-pokeball-red px-4 py-2 text-label-sm font-semibold text-white transition hover:bg-pokeball-red/85"
            >
              {t("goMarket")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {TYPE_ORDER.map((type) => {
              const list = byType.get(type) ?? [];
              if (list.length === 0) return null;
              return (
                <section key={type} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-pokeball-red">
                      <span className="material-symbols-outlined text-[18px]">{TYPE_ICON[type]}</span>
                    </span>
                    <div>
                      <h2 className="text-label-md uppercase tracking-wide text-on-surface">
                        {t(`types.${type}`)}
                      </h2>
                      <p className="text-[11px] text-on-surface-variant">
                        {t("sectionCount", { count: list.length })}
                      </p>
                    </div>
                  </div>

                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map(({ item, quantity }) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur-md"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04]">
                          <Image
                            src={itemSpriteUrl(item.name)}
                            alt={item.name}
                            width={36}
                            height={36}
                            className="h-9 w-9 object-contain [image-rendering:pixelated]"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-label-md font-medium text-white">{item.name}</p>
                          {item.effectText && (
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-on-surface-variant">
                              {item.effectText}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-md border border-electric-yellow/25 bg-electric-yellow/10 px-2 py-1 font-mono text-label-sm font-semibold text-electric-yellow">
                          ×{quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
