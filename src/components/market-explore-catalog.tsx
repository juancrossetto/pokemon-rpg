"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { ItemType } from "@/generated/prisma/client";
import { buyListing, cancelListing } from "@/actions/market";
import { MarketSubmitButton } from "@/components/market-submit-button";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { CONFIRM_PRICE_THRESHOLD } from "@/lib/market-rules";
import { typeColor } from "@/lib/type-colors";
import { localizePokemonType } from "@/lib/pokemon-type-i18n";
import { resolveItemDisplayName } from "@/lib/shop";
import { RARITY_STYLES, type MarketRarity } from "@/lib/rarity";
import { lockBodyScroll } from "@/lib/scroll-lock";

const ITEM_PEDESTAL: Record<ItemType, string> = {
  POKEBALL: "rgba(56,189,248,0.10)",
  POTION: "rgba(52,211,153,0.10)",
  BERRY: "rgba(251,191,36,0.12)",
  EVOLUTION_STONE: "rgba(232,121,249,0.10)",
  MACHINE: "rgba(251,146,60,0.12)",
  HELD: "rgba(167,139,250,0.10)",
};

export type MarketExploreItemListing = {
  kind: "ITEM";
  id: string;
  price: number;
  quantity: number;
  seller: string;
  expiresClosing: boolean;
  expiresLabel: string | null;
  isOwn: boolean;
  canAfford: boolean;
  rarity: MarketRarity;
  item: {
    name: string;
    type: ItemType;
    effectText: string | null;
  };
};

export type MarketExplorePokemonListing = {
  kind: "POKEMON";
  id: string;
  price: number;
  seller: string;
  expiresClosing: boolean;
  expiresLabel: string | null;
  isOwn: boolean;
  canAfford: boolean;
  rarity: MarketRarity;
  displayName: string;
  hp: number;
  atk: number;
  training: number;
  invested: number;
  pokemon: {
    level: number;
    isShiny: boolean;
    unspentPoints: number;
    spriteUrl: string;
    types: string[];
    moves: string[];
  };
};

export type MarketExploreListing =
  | MarketExploreItemListing
  | MarketExplorePokemonListing;

/**
 * Catálogo Explorar estilo tienda GO: tiles con PNG grande, detalle al tocar.
 */
export function MarketExploreCatalog({
  locale,
  coins,
  listings,
}: {
  locale: string;
  coins: number;
  listings: MarketExploreListing[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = listings.find((l) => l.id === selectedId) ?? null;

  return (
    <>
      <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6 lg:grid-cols-5 xl:grid-cols-6">
        {listings.map((listing) => (
          <ExploreTile
            key={listing.id}
            listing={listing}
            onSelect={() => setSelectedId(listing.id)}
          />
        ))}
      </div>

      {selected ? (
        <ExploreDetailSheet
          locale={locale}
          coins={coins}
          listing={selected}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  );
}

function ExploreTile({
  listing,
  onSelect,
}: {
  listing: MarketExploreListing;
  onSelect: () => void;
}) {
  const t = useTranslations("market");
  const tShop = useTranslations("shop");
  const rarity = RARITY_STYLES[listing.rarity];

  const label =
    listing.kind === "ITEM"
      ? resolveItemDisplayName(listing.item.name, (key) => {
          const path = `names.${key}`;
          return tShop.has(path) ? tShop(path) : null;
        })
      : listing.displayName;

  const pedestal =
    listing.kind === "ITEM"
      ? ITEM_PEDESTAL[listing.item.type]
      : "rgba(167,139,250,0.10)";

  const imageSrc =
    listing.kind === "ITEM"
      ? itemDisplayUrl(listing.item.name)
      : listing.pokemon.spriteUrl;

  return (
    <article className="shop-tile flex min-w-0 flex-col items-center text-center">
      <button
        type="button"
        onClick={onSelect}
        className="group flex w-full flex-col items-center gap-1.5"
      >
        <div
          className="shop-sprite-frame shop-sprite-frame--tile relative"
          style={{
            background: `radial-gradient(circle at 50% 70%, ${pedestal} 0%, transparent 68%)`,
          }}
        >
          <Image
            src={imageSrc}
            alt=""
            width={96}
            height={96}
            sizes="(max-width: 640px) 72px, 96px"
            className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] transition duration-200 group-active:scale-[0.97] md:group-hover:scale-[1.04]"
            unoptimized
          />
          {listing.isOwn ? (
            <span className="absolute -right-1 -top-1 rounded border border-white/15 bg-black/70 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-on-surface-variant">
              {t("hub.yours")}
            </span>
          ) : null}
          {listing.kind === "POKEMON" && listing.pokemon.isShiny ? (
            <span className="absolute -left-0.5 -top-0.5 text-[12px] text-electric-yellow">
              ✦
            </span>
          ) : null}
        </div>

        <h3
          className="line-clamp-2 min-h-[2.5em] w-full px-0.5 text-[10px] font-semibold uppercase leading-tight tracking-[0.04em] text-white/88 sm:text-[11px]"
          title={label}
        >
          {label}
        </h3>

        {listing.kind === "ITEM" && listing.quantity > 1 ? (
          <p className="font-mono text-[9px] text-on-surface-variant/70">
            {t("quantity", { count: listing.quantity })}
          </p>
        ) : listing.kind === "POKEMON" ? (
          <p className="font-mono text-[9px] uppercase text-on-surface-variant/70">
            {t("level", { level: listing.pokemon.level })}
          </p>
        ) : (
          <span
            className={`text-[8px] font-bold uppercase tracking-wide ${rarity.text}`}
            aria-hidden
          >
            {"★".repeat(rarity.stars)}
          </span>
        )}

        <span
          className={`shop-price-pill ${listing.canAfford || listing.isOwn ? "" : "shop-price-pill--muted"}`}
        >
          <Image
            src="/items/hd/poke-coin.png"
            alt=""
            width={16}
            height={16}
            className="h-3.5 w-3.5 object-contain"
            unoptimized
          />
          <span className="font-mono tabular-nums">
            {listing.price.toLocaleString()}
          </span>
        </span>
      </button>
    </article>
  );
}

function ExploreDetailSheet({
  locale,
  coins,
  listing,
  onClose,
}: {
  locale: string;
  coins: number;
  listing: MarketExploreListing;
  onClose: () => void;
}) {
  const t = useTranslations("market");
  const tShop = useTranslations("shop");
  const tTypes = useTranslations("pokedex.pokemonTypes");
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const rarity = RARITY_STYLES[listing.rarity];

  const displayName =
    listing.kind === "ITEM"
      ? resolveItemDisplayName(listing.item.name, (key) => {
          const path = `names.${key}`;
          return tShop.has(path) ? tShop(path) : null;
        })
      : listing.displayName;

  const pedestal =
    listing.kind === "ITEM"
      ? ITEM_PEDESTAL[listing.item.type]
      : "rgba(167,139,250,0.12)";

  const imageSrc =
    listing.kind === "ITEM"
      ? itemDisplayUrl(listing.item.name)
      : listing.pokemon.spriteUrl;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const releaseScroll = lockBodyScroll();
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [onClose]);

  // Portal al body como la Tienda: el sheet queda encima del bottom nav (z-70),
  // no debajo. Sin portal el dock mobile tapa vendedor / vencimiento / CTA.
  const body = (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label={t("filters.close")}
        onClick={onClose}
        className="market-sheet-backdrop-in absolute inset-0 bg-black/65 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="market-sheet-in relative max-h-[min(92dvh,40rem)] w-full max-w-sm overflow-y-auto rounded-t-2xl border-t border-white/12 bg-[#0b0d13]/98 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:rounded-2xl sm:border sm:pb-4"
      >
        <div className="flex items-start gap-3">
          <div
            className="shop-sprite-frame shrink-0 rounded-lg border border-white/[0.07]"
            style={{ backgroundColor: pedestal }}
          >
            <Image
              src={imageSrc}
              alt=""
              width={64}
              height={64}
              sizes="64px"
              className="object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
              unoptimized
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <span
                className={`inline-flex items-center gap-0.5 rounded border bg-black/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${rarity.border} ${rarity.text}`}
              >
                <span aria-hidden>{"★".repeat(rarity.stars)}</span>
                {t(`hub.rarity.${listing.rarity}`)}
              </span>
              {listing.isOwn ? (
                <span className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                  {t("hub.yours")}
                </span>
              ) : null}
            </div>
            <h2 id={titleId} className="text-label-md font-semibold capitalize text-white">
              {displayName}
            </h2>
            {listing.kind === "ITEM" ? (
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-on-surface-variant">
                {t(`hub.itemType.${listing.item.type}`)}
                {listing.quantity > 1
                  ? ` · ${t("quantity", { count: listing.quantity })}`
                  : null}
              </p>
            ) : (
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <span className="font-mono text-[11px] uppercase text-on-surface-variant">
                  {t("level", { level: listing.pokemon.level })}
                </span>
                {listing.pokemon.isShiny ? (
                  <span className="text-[11px] font-bold text-electric-yellow">
                    ✦ {t("shiny")}
                  </span>
                ) : null}
                {listing.pokemon.types.map((type) => {
                  const color = typeColor(type);
                  return (
                    <span
                      key={type}
                      className="rounded px-1 py-px text-[9px] uppercase"
                      style={{ backgroundColor: `${color}26`, color }}
                    >
                      {localizePokemonType(tTypes, type)}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-white/5 hover:text-white"
            aria-label={t("filters.close")}
          >
            <span className="material-symbols-outlined text-[20px]!">close</span>
          </button>
        </div>

        {listing.kind === "ITEM" && listing.item.effectText ? (
          <p className="mt-3 text-[12px] leading-relaxed text-on-surface-variant">
            {listing.item.effectText}
          </p>
        ) : null}

        {listing.kind === "POKEMON" ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase text-on-surface-variant">
              <span>
                {t("stats.hp")} <span className="text-on-surface">{listing.hp}</span>
              </span>
              <span>
                {t("stats.atk")} <span className="text-on-surface">{listing.atk}</span>
              </span>
              <span>
                {t("hub.training")}{" "}
                <span className="text-tertiary">{listing.training}%</span>
              </span>
            </p>
            <p className="text-[11px] text-on-surface-variant">
              {t("investedPoints", { count: listing.invested })}
              {listing.pokemon.unspentPoints > 0
                ? ` · ${t("unspentPoints", { count: listing.pokemon.unspentPoints })}`
                : null}
            </p>
            {listing.pokemon.moves.length > 0 ? (
              <p className="text-[11px] capitalize text-on-surface-variant">
                <span className="font-mono uppercase tracking-wide">{t("moves")}: </span>
                {listing.pokemon.moves.join(" · ")}
              </p>
            ) : (
              <p className="text-[11px] text-error/80">{t("noMovesListed")}</p>
            )}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.08] pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="flex items-center gap-1.5 font-mono text-[22px] font-semibold leading-none text-electric-yellow">
              <Image
                src="/items/hd/poke-coin.png"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
                unoptimized
              />
              {listing.price.toLocaleString()}
            </p>
            {listing.kind === "ITEM" && listing.quantity > 1 ? (
              <span className="font-mono text-[11px] text-on-surface-variant">
                {t("unitPrice", {
                  price: Math.round(listing.price / Math.max(1, listing.quantity)),
                })}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-on-surface-variant">
            <span className="min-w-0 truncate" title={listing.seller}>
              <span className="material-symbols-outlined mr-0.5 align-[-3px] text-[13px]!">
                person
              </span>
              {listing.seller}
            </span>
            {listing.expiresLabel ? (
              <span
                className={`inline-flex shrink-0 items-center gap-0.5 ${
                  listing.expiresClosing ? "font-semibold text-error" : "opacity-80"
                }`}
              >
                <span className="material-symbols-outlined text-[13px]!">
                  {listing.expiresClosing ? "warning" : "schedule"}
                </span>
                {listing.expiresLabel}
              </span>
            ) : null}
          </div>

          {listing.isOwn ? (
            <form action={cancelListing.bind(null, locale)} className="w-full">
              <input type="hidden" name="listingId" value={listing.id} />
              <MarketSubmitButton
                label={t("cancel")}
                pendingLabel={t("cancelling")}
                className="h-11 w-full rounded-md border border-white/15 px-3 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant transition hover:border-white/30 hover:text-on-surface"
              />
            </form>
          ) : (
            <form action={buyListing.bind(null, locale)} className="w-full">
              <input type="hidden" name="listingId" value={listing.id} />
              <MarketSubmitButton
                label={
                  listing.canAfford
                    ? t("hub.buyNow")
                    : t("needFunds", { missing: Math.max(0, listing.price - coins) })
                }
                pendingLabel={t("buying")}
                disabled={!listing.canAfford}
                className="ui-btn-primary market-buy-btn h-11 w-full px-3 text-[11px] font-bold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-on-surface-variant disabled:opacity-100"
                confirmMessage={
                  listing.price >= CONFIRM_PRICE_THRESHOLD
                    ? t("confirmBuy", { name: displayName, price: listing.price })
                    : undefined
                }
              />
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
