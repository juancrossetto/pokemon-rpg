"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { buyItem } from "@/actions/buy-item";
import { buyItemWithGems } from "@/actions/buy-item-gems";
import { buyEnergyPack } from "@/actions/buy-energy-pack";
import { itemDisplayUrl, itemHdIconUrl } from "@/lib/item-sprites";
import { announceCoinDelta } from "@/lib/coin-fx";
import {
  announceGemDelta,
  flushPendingEnergyDelta,
  seedPendingEnergyDelta,
} from "@/lib/resource-fx";
import { playLootCollectFx } from "@/lib/loot-fly-fx";
import { showToast } from "@/lib/app-toast";
import {
  MAX_PURCHASE_QUANTITY,
  SHOP_CATEGORIES,
  SHOP_CATEGORY_META,
  type ShopCategory,
  type ShopProduct,
} from "@/lib/shop";
import { isEnergyPackProductId } from "@/lib/shop-energy-pack";
import { ItemEvolutionRecipes } from "@/components/item-evolution-recipes";

export interface ShopLabels {
  categories: Record<ShopCategory, string>;
  all: string;
  buy: string;
  buying: string;
  insufficient: string;
  /** Con `{count}` sin interpolar. */
  owned: string;
  search: string;
  searchPlaceholder: string;
  affordableOnly: string;
  quantity: string;
  unitPrice: string;
  total: string;
  balanceAfter: string;
  confirm: string;
  cancel: string;
  close: string;
  decrease: string;
  increase: string;
  /** Con `{name}`. */
  buyTitle: string;
  /** Con `{count}` y `{name}`. */
  purchased: string;
  /** Con `{amount}`. */
  missing: string;
  empty: string;
  emptyAction: string;
  noResults: string;
  errorGeneric: string;
  /** Energía ya al máximo: no se puede comprar el pack. */
  energyFull: string;
  coinsUnit: string;
  gemsUnit: string;
  insufficientGems: string;
  /** Con `{amount}`. */
  missingGems: string;
  /** Título del bloque from → ítem → to. */
  evolvesTitle: string;
}

/** A partir de acá el catálogo justifica un buscador. */
const SEARCH_THRESHOLD = 12;

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );

export function ShopTerminal({
  products,
  labels,
  locale,
  initialCoins,
  initialGems = 0,
  eyebrow,
  title,
  subtitle,
  hideHeader = false,
}: {
  products: ShopProduct[];
  labels: ShopLabels;
  locale: string;
  initialCoins: number;
  initialGems?: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Dentro del hub de Comercio el hero ya lo pinta la página. */
  hideHeader?: boolean;
}) {
  const [coins, setCoins] = useState(initialCoins);
  const [gems, setGems] = useState(initialGems);
  const [owned, setOwned] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p) => [p.id, p.owned])),
  );
  const [category, setCategory] = useState<ShopCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [target, setTarget] = useState<ShopProduct | null>(null);

  const showSearch = products.length > SEARCH_THRESHOLD;

  const walletOf = (product: ShopProduct) =>
    product.currency === "gems" ? gems : coins;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      if (affordableOnly && walletOf(product) < product.price) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        product.displayName.toLowerCase().includes(needle) ||
        (product.description?.toLowerCase().includes(needle) ?? false)
      );
    });
    // walletOf lee coins/gems; ambos en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [products, category, affordableOnly, coins, gems, query]);

  // Agrupado solo cuando se ven todas: dentro de una categoría el encabezado
  // repetiría lo que ya dice el chip activo.
  const sections =
    category === "all"
      ? SHOP_CATEGORIES.map((id) => ({
          id,
          items: visible.filter((product) => product.category === id),
        })).filter((section) => section.items.length > 0)
      : [{ id: category, items: visible }];

  function onPurchased(
    product: ShopProduct,
    quantity: number,
    balanceLeft: number,
    after: number,
    origin?: { x: number; y: number },
    energyDelta?: number,
    energyAfter?: number,
  ) {
    if (product.currency === "gems") {
      const spend = -(product.price * quantity);
      const delta = balanceLeft - gems;
      // Si el RSC ya sincronizó `gems` vía revalidate, `delta` puede ser 0:
      // usamos el precio cobrado para no saltar el anuncio.
      const effective = delta !== 0 ? delta : spend;
      try {
        sessionStorage.setItem(
          "pokerpg:gems-last-shown",
          String(Math.max(0, balanceLeft - effective)),
        );
      } catch {
        /* private mode */
      }
      announceGemDelta(effective, balanceLeft);
      setGems(balanceLeft);
    } else {
      announceCoinDelta(balanceLeft - coins);
      setCoins(balanceLeft);
    }
    if (!product.hideOwned) {
      setOwned((current) => ({ ...current, [product.id]: after }));
    }
    const hd = itemHdIconUrl(product.name);
    if (product.grantEnergy && energyDelta && energyDelta > 0) {
      // Misma pipeline que el oro al ganar: seed → hold en el header → flush
      // dispara el conteo de a 1 (sobrevive el remount del layout).
      if (typeof energyAfter === "number") {
        try {
          sessionStorage.setItem(
            "pokerpg:energy-last-shown",
            String(Math.max(0, energyAfter - energyDelta)),
          );
        } catch {
          /* private mode */
        }
      }
      seedPendingEnergyDelta(energyDelta);
      playLootCollectFx({
        pieces: [
          {
            src: hd ?? itemDisplayUrl(product.name),
            target: "energy",
            pixelated: !hd,
            // Una unidad por punto de energía comprado: se arrastran de a una.
            count: energyDelta,
          },
        ],
        origin,
        // El contador sube cuando la primera unidad toca la pastilla, no al
        // click: si no, el número ya estaba en el total antes de que llegara.
        onFirstLanding: () => flushPendingEnergyDelta(),
      });
    } else {
      // Mismo vuelo que recompensas: ítem → avatar + chime.
      const pieceCount = Math.min(Math.max(1, quantity), 5);
      playLootCollectFx({
        pieces: Array.from({ length: pieceCount }, () => ({
          src: hd ?? itemDisplayUrl(product.name),
          target: "avatar" as const,
          pixelated: !hd,
        })),
        origin,
      });
    }
    showToast(
      fill(labels.purchased, { count: quantity, name: product.displayName }),
      "success",
    );
  }

  const hasFilters = query.trim() !== "" || affordableOnly;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {!hideHeader && <ShopHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />}

      <ShopCategoryNav
        categories={SHOP_CATEGORIES}
        active={category}
        labels={labels}
        counts={products}
        onPick={setCategory}
      />

      {showSearch && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{labels.search}</span>
            <span
              aria-hidden
              className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[18px]! text-on-surface-variant/65"
            >
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              className="h-10 w-full border-0 border-b border-white/15 bg-transparent pl-8 pr-2 text-label-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/45 focus:border-pokeball-red/55"
            />
          </label>
          <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 px-1 text-label-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={affordableOnly}
              onChange={(event) => setAffordableOnly(event.target.checked)}
              className="h-4 w-4 accent-pokeball-red"
            />
            {labels.affordableOnly}
          </label>
        </div>
      )}

      {visible.length === 0 ? (
        <ShopEmptyState
          label={hasFilters || category !== "all" ? labels.noResults : labels.empty}
          actionLabel={category === "all" && !hasFilters ? null : labels.emptyAction}
          onAction={() => {
            setCategory("all");
            setQuery("");
            setAffordableOnly(false);
          }}
        />
      ) : (
        sections.map((section) => (
          <section key={section.id}>
            {category === "all" && (
              <h2 className="mb-3 mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/80">
                {labels.categories[section.id]}
              </h2>
            )}
            {/*
              Grilla fija estilo GO: 3 columnas en mobile, más aire en desktop.
              Sin cards — el tile flota sobre el fondo.
            */}
            <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6 lg:grid-cols-5 xl:grid-cols-6">
              {section.items.map((product) => (
                <ShopProductTile
                  key={product.id}
                  product={product}
                  owned={owned[product.id] ?? 0}
                  wallet={walletOf(product)}
                  labels={labels}
                  onBuy={() => setTarget(product)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {target && (
        <PurchaseDialog
          product={target}
          owned={owned[target.id] ?? 0}
          wallet={walletOf(target)}
          labels={labels}
          locale={locale}
          onClose={() => setTarget(null)}
          onPurchased={onPurchased}
        />
      )}
    </div>
  );
}

/* ── Encabezado + saldo ───────────────────────────────────────────────── */

function ShopHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  /*
    Sin bloque de saldo.

    La barra de recursos del header ya muestra las monedas —y ahora también las
    gemas, con acceso directo a recargar—, así que repetir el número acá no
    agregaba nada: ocupaba una fila entera arriba del catálogo para decir lo
    mismo que está a 40px de distancia.

    El saldo sigue estando donde se necesita para decidir: en cada card ("te
    faltan N monedas") y en el diálogo de compra ("saldo después"). Ahí el
    número es contexto de una decisión, no un adorno.
  */
  return (
    <header className="min-w-0">
      <p className="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-pokeball-red sm:text-label-sm">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
        {eyebrow}
      </p>
      <h1 className="page-title text-[clamp(1.5rem,6vw,2rem)] text-white">
        {title}
      </h1>
      <p className="mt-0.5 text-[12px] leading-snug text-on-surface-variant sm:text-label-md">
        {subtitle}
      </p>
    </header>
  );
}

/* ── Navegación por categorías ────────────────────────────────────────── */

function ShopCategoryNav({
  categories,
  active,
  labels,
  counts,
  onPick,
}: {
  categories: ShopCategory[];
  active: ShopCategory | "all";
  labels: ShopLabels;
  counts: ShopProduct[];
  onPick: (value: ShopCategory | "all") => void;
}) {
  const chips: { id: ShopCategory | "all"; label: string; icon: string; accent: string }[] = [
    { id: "all", label: labels.all, icon: "apps", accent: "text-on-surface-variant" },
    ...categories.map((id) => ({
      id,
      label: labels.categories[id],
      icon: SHOP_CATEGORY_META[id].icon,
      accent: SHOP_CATEGORY_META[id].accent,
    })),
  ];

  return (
    <nav className="no-scrollbar -mx-1 flex snap-x gap-1 overflow-x-auto px-1 md:flex-wrap md:gap-1.5">
      {chips.map((chip) => {
        const isActive = active === chip.id;
        const total =
          chip.id === "all"
            ? counts.length
            : counts.filter((product) => product.category === chip.id).length;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onPick(chip.id)}
            aria-pressed={isActive}
            className={`flex min-h-9 shrink-0 snap-start items-center gap-1 rounded-full px-2.5 text-[12px] transition sm:min-h-8 sm:text-label-sm ${
              isActive
                ? "bg-white/[0.12] text-white"
                : "text-on-surface-variant active:bg-white/[0.06] md:hover:text-on-surface"
            }`}
          >
            <span
              aria-hidden
              className={`material-symbols-outlined text-[16px]! ${isActive ? "text-pokeball-red" : chip.accent}`}
            >
              {chip.icon}
            </span>
            <span className="whitespace-nowrap">{chip.label}</span>
            <span className="font-mono text-[10px] text-on-surface-variant/60">{total}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── Tile de producto (estilo GO: sin card) ────────────────────────────── */

function ShopProductTile({
  product,
  owned,
  wallet,
  labels,
  onBuy,
}: {
  product: ShopProduct;
  owned: number;
  wallet: number;
  labels: ShopLabels;
  onBuy: () => void;
}) {
  const meta = SHOP_CATEGORY_META[product.category];
  const canAfford = wallet >= product.price;
  const missing = product.price - wallet;
  const soldOut = product.stock !== undefined && product.stock <= 0;
  const blocked = product.requirement;
  const disabled = Boolean(blocked) || soldOut;
  const premium = product.currency === "gems";
  const missingTemplate = premium ? labels.missingGems : labels.missing;
  const unitLabel = premium ? labels.gemsUnit : labels.coinsUnit;
  const priceIcon = premium ? "/items/hd/gem.png" : "/items/hd/poke-coin.png";

  return (
    <article className="shop-tile flex min-w-0 flex-col items-center text-center">
      <button
        type="button"
        onClick={onBuy}
        disabled={disabled}
        title={
          blocked
            ? blocked.label
            : !canAfford
              ? fill(missingTemplate, { amount: missing.toLocaleString() })
              : product.description ?? undefined
        }
        className="group flex w-full flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ShopProductImage name={product.name} pedestal={meta.pedestal} size="tile" />

        <h3
          className="line-clamp-2 min-h-[2.5em] w-full px-0.5 text-[10px] font-semibold uppercase leading-tight tracking-[0.04em] text-white/88 sm:text-[11px]"
          title={product.displayName}
        >
          {product.displayName}
        </h3>

        {blocked ? (
          <span className="shop-price-pill shop-price-pill--muted max-w-full truncate text-[9px] uppercase">
            {blocked.label}
          </span>
        ) : (
          <span
            className={`shop-price-pill ${canAfford ? "" : "shop-price-pill--muted"}`}
          >
            <Image
              src={priceIcon}
              alt=""
              width={16}
              height={16}
              className="h-3.5 w-3.5 object-contain"
              unoptimized
            />
            <span className="font-mono tabular-nums">
              {product.price.toLocaleString()}
            </span>
            <span className="sr-only">{unitLabel}</span>
          </span>
        )}
      </button>

      {owned > 0 && !product.hideOwned && (
        <p className="mt-1 font-mono text-[9px] text-on-surface-variant/55">
          {fill(labels.owned, { count: owned })}
        </p>
      )}
    </article>
  );
}

/**
 * Sprite del producto.
 * - `tile`: icono grande centrado, sin marco (catálogo GO).
 * - `dialog`: marco compacto para el sheet de compra.
 */
function ShopProductImage({
  name,
  pedestal,
  size = "dialog",
}: {
  name: string;
  pedestal: string;
  size?: "tile" | "dialog";
}) {
  if (size === "tile") {
    return (
      <div
        className="shop-sprite-frame shop-sprite-frame--tile"
        style={{
          background: `radial-gradient(circle at 50% 70%, ${pedestal} 0%, transparent 68%)`,
        }}
      >
        <Image
          src={itemDisplayUrl(name)}
          alt=""
          width={96}
          height={96}
          sizes="(max-width: 640px) 72px, 96px"
          className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] transition duration-200 group-active:scale-[0.97] md:group-hover:scale-[1.04]"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className="shop-sprite-frame shrink-0 rounded-lg border border-white/[0.07]"
      style={{ backgroundColor: pedestal }}
    >
      <Image
        src={itemDisplayUrl(name)}
        alt=""
        width={64}
        height={64}
        sizes="64px"
        className="object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
        unoptimized
      />
    </div>
  );
}

/* ── Diálogo de compra ────────────────────────────────────────────────── */

function PurchaseDialog({
  product,
  owned,
  wallet,
  labels,
  locale,
  onClose,
  onPurchased,
}: {
  product: ShopProduct;
  owned: number;
  wallet: number;
  labels: ShopLabels;
  locale: string;
  onClose: () => void;
  onPurchased: (
    product: ShopProduct,
    quantity: number,
    balanceLeft: number,
    ownedAfter: number,
    origin?: { x: number; y: number },
    energyDelta?: number,
    energyAfter?: number,
  ) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const premium = product.currency === "gems";
  const missingTemplate = premium ? labels.missingGems : labels.missing;

  // Tope real: lo que el saldo aguanta, acotado por el máximo del servidor.
  const affordable = Math.max(1, Math.min(MAX_PURCHASE_QUANTITY, Math.floor(wallet / product.price)));
  const total = product.price * quantity;
  const balanceAfter = wallet - total;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!pending) onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([type="hidden"]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, pending]);

  function confirm() {
    if (pending) return;
    setError(null);
    const spriteBox = spriteRef.current?.getBoundingClientRect();
    const origin = spriteBox
      ? {
          x: spriteBox.left + spriteBox.width / 2,
          y: spriteBox.top + spriteBox.height / 2,
        }
      : undefined;
    startTransition(async () => {
      const result = isEnergyPackProductId(product.id)
        ? await buyEnergyPack(locale, quantity)
        : premium
          ? await buyItemWithGems(product.id, locale, quantity)
          : await buyItem(product.id, locale, quantity);
      if (result.ok) {
        const balanceLeft =
          "gemsLeft" in result
            ? result.gemsLeft
            : "coinsLeft" in result
              ? result.coinsLeft
              : wallet;
        onPurchased(
          product,
          result.quantity,
          balanceLeft,
          "ownedAfter" in result ? result.ownedAfter : 0,
          origin,
          "energyDelta" in result ? result.energyDelta : undefined,
          "energyAfter" in result ? result.energyAfter : undefined,
        );
        onClose();
        return;
      }
      // El error se muestra dentro del panel: cerrarlo perdería la cantidad
      // que el jugador ya eligió.
      const message =
        (result.error === "no_coins" || result.error === "no_gems") &&
        result.missing !== undefined
          ? fill(missingTemplate, { amount: result.missing.toLocaleString() })
          : result.error === "energy_full"
            ? labels.energyFull
            : labels.errorGeneric;
      setError(message);
      if (result.error === "energy_full") {
        showToast(labels.energyFull, "error");
      }
    });
  }

  const body = (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label={labels.close}
        onClick={() => !pending && onClose()}
        className="market-sheet-backdrop-in absolute inset-0 bg-black/65 backdrop-blur-sm"
      />
      {/* Bottom sheet en mobile, modal centrado desde `sm`. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="market-sheet-in relative w-full max-w-sm rounded-t-2xl border-t border-white/12 bg-[#0b0d13]/98 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:rounded-2xl sm:border sm:pb-4"
      >
        <div className="flex items-start gap-3">
          <div ref={spriteRef}>
            <ShopProductImage
              name={product.name}
              pedestal={SHOP_CATEGORY_META[product.category].pedestal}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-label-md font-semibold text-white">
              {fill(labels.buyTitle, { name: product.displayName })}
            </h2>
            {product.description && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-on-surface-variant">
                {product.description}
              </p>
            )}
            {owned > 0 && !product.hideOwned && (
              <p className="mt-1 font-mono text-[10px] text-on-surface-variant">
                {fill(labels.owned, { count: owned })}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 max-h-40 overflow-y-auto overscroll-contain">
          <ItemEvolutionRecipes
            itemName={product.name}
            title={labels.evolvesTitle}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <span className="text-label-sm text-on-surface-variant">{labels.quantity}</span>
          <div className="flex items-center gap-1">
            <StepperButton
              label={labels.decrease}
              icon="remove"
              disabled={pending || quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={affordable}
              value={quantity}
              aria-label={labels.quantity}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                setQuantity(Math.min(affordable, Math.max(1, Math.floor(next))));
              }}
              className="h-9 w-14 rounded-md border border-white/12 bg-black/40 text-center font-mono text-label-md text-white outline-none focus:border-pokeball-red/55"
            />
            <StepperButton
              label={labels.increase}
              icon="add"
              disabled={pending || quantity >= affordable}
              onClick={() => setQuantity((value) => Math.min(affordable, value + 1))}
            />
          </div>
        </div>

        <dl className="mt-3 flex flex-col gap-1 text-label-sm">
          <Row label={labels.unitPrice} value={product.price.toLocaleString()} />
          <Row label={labels.total} value={total.toLocaleString()} strong />
          <Row label={labels.balanceAfter} value={balanceAfter.toLocaleString()} />
        </dl>

        {error && (
          <p
            role="alert"
            className="mt-2 rounded-md border border-error/30 bg-error/10 px-2.5 py-1.5 text-[11px] text-error"
          >
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-11 flex-1 rounded-md border border-white/12 text-label-sm text-on-surface-variant transition hover:border-white/25 disabled:opacity-50"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            data-autofocus
            onClick={confirm}
            disabled={pending || balanceAfter < 0}
            className="ui-btn-primary h-11 flex-1 text-label-sm font-bold disabled:bg-white/[0.06] disabled:text-on-surface-variant"
          >
            {pending ? (
              <span className="inline-flex items-center justify-center gap-1.5">
                <span aria-hidden className="shop-spinner" />
                {labels.buying}
              </span>
            ) : (
              labels.confirm
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

function StepperButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-white/12 text-on-surface transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-35"
    >
      <span aria-hidden className="material-symbols-outlined text-[18px]!">
        {icon}
      </span>
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd
        className={`font-mono ${strong ? "text-[15px] font-semibold text-tertiary" : "text-on-surface"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ShopEmptyState({
  label,
  actionLabel,
  onAction,
}: {
  label: string;
  actionLabel: string | null;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-12 text-on-surface-variant">
      <span aria-hidden className="material-symbols-outlined text-[36px]! opacity-50">
        storefront
      </span>
      <p className="text-label-md">{label}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 h-10 rounded-md border border-white/12 px-3 text-label-sm text-on-surface transition hover:border-white/25"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
