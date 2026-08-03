"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { buyItem } from "@/actions/buy-item";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { announceCoinDelta } from "@/lib/coin-fx";
import { showToast } from "@/lib/app-toast";
import {
  MAX_PURCHASE_QUANTITY,
  SHOP_CATEGORIES,
  SHOP_CATEGORY_META,
  type ShopCategory,
  type ShopProduct,
} from "@/lib/shop";

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
  coinsUnit: string;
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
  eyebrow,
  title,
  subtitle,
  hideHeader = false,
}: {
  products: ShopProduct[];
  labels: ShopLabels;
  locale: string;
  initialCoins: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Dentro del hub de Comercio el hero ya lo pinta la página. */
  hideHeader?: boolean;
}) {
  const [coins, setCoins] = useState(initialCoins);
  const [owned, setOwned] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p) => [p.id, p.owned])),
  );
  const [category, setCategory] = useState<ShopCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [target, setTarget] = useState<ShopProduct | null>(null);

  const showSearch = products.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      if (affordableOnly && coins < product.price) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        product.displayName.toLowerCase().includes(needle) ||
        (product.description?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [products, category, affordableOnly, coins, query]);

  // Agrupado solo cuando se ven todas: dentro de una categoría el encabezado
  // repetiría lo que ya dice el chip activo.
  const sections =
    category === "all"
      ? SHOP_CATEGORIES.map((id) => ({
          id,
          items: visible.filter((product) => product.category === id),
        })).filter((section) => section.items.length > 0)
      : [{ id: category, items: visible }];

  function onPurchased(product: ShopProduct, quantity: number, coinsLeft: number, after: number) {
    // El badge del header escucha este evento y anima el descuento al toque,
    // sin esperar a que revalide el layout.
    announceCoinDelta(coinsLeft - coins);
    setCoins(coinsLeft);
    setOwned((current) => ({ ...current, [product.id]: after }));
    // Toast visible: antes la confirmación era sólo sr-only y comprar
    // parecía no hacer nada.
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
              className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px]! text-on-surface-variant/65"
            >
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              className="h-11 w-full rounded-lg border border-white/12 bg-black/35 pl-9 pr-3 text-label-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/45 focus:border-pokeball-red/55 focus:ring-1 focus:ring-pokeball-red/30 sm:h-9"
            />
          </label>
          <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-white/12 bg-black/35 px-3 text-label-sm text-on-surface-variant sm:h-9">
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
              <h2 className="mb-2 flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                <span
                  aria-hidden
                  className={`material-symbols-outlined text-[16px]! ${SHOP_CATEGORY_META[section.id].accent}`}
                >
                  {SHOP_CATEGORY_META[section.id].icon}
                </span>
                {labels.categories[section.id]}
              </h2>
            )}
            {/*
              `auto-fill` en vez de un número fijo de columnas: la grilla se
              ajusta al ancho real y no deja cards gigantes en pantallas anchas.
            */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-2.5">
              {section.items.map((product) => (
                <ShopProductCard
                  key={product.id}
                  product={product}
                  owned={owned[product.id] ?? 0}
                  coins={coins}
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
          coins={coins}
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
      <h1 className="text-[clamp(1.5rem,6vw,2rem)] font-semibold leading-tight tracking-tight text-white">
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
    /*
      Riel deslizable alineado al contenido.

      Antes sangraba 16px a cada lado con `-mx-margin-mobile` para que el corte
      de los chips llegara al borde de la pantalla y se leyera como
      desplazable. Entre el bloque de saldo y el buscador —los dos alineados a
      la grilla— esa fila más ancha se leía como un error de maquetado, no como
      una pista de scroll. Alineado pesa más que la pista: los chips siguen
      desplazándose igual.
    */
    <nav className="no-scrollbar flex snap-x gap-2 overflow-x-auto md:flex-wrap">
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
            // `rounded-md` y no `rounded-full`: la píldora completa quedaba
            // demasiado redonda al lado de las cards y los campos, que usan
            // esquinas suaves pero rectas.
            className={`flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-md border px-3 text-label-sm transition ${
              isActive
                ? "border-pokeball-red/55 bg-pokeball-red/15 text-white"
                : "border-white/10 bg-white/[0.03] text-on-surface-variant active:bg-white/[0.07] md:hover:border-white/25"
            }`}
          >
            <span
              aria-hidden
              className={`material-symbols-outlined text-[17px]! ${isActive ? "text-pokeball-red" : chip.accent}`}
            >
              {chip.icon}
            </span>
            <span className="whitespace-nowrap">{chip.label}</span>
            <span className="font-mono text-[11px] text-on-surface-variant/70">{total}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── Card de producto ─────────────────────────────────────────────────── */

function ShopProductCard({
  product,
  owned,
  coins,
  labels,
  onBuy,
}: {
  product: ShopProduct;
  owned: number;
  coins: number;
  labels: ShopLabels;
  onBuy: () => void;
}) {
  const meta = SHOP_CATEGORY_META[product.category];
  const canAfford = coins >= product.price;
  const missing = product.price - coins;
  const soldOut = product.stock !== undefined && product.stock <= 0;
  const blocked = product.requirement;

  return (
    <article
      className={`shop-card flex min-w-0 flex-col gap-1.5 rounded-xl border bg-white/[0.03] p-2.5 sm:gap-2 sm:p-3 ${meta.ring}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <ShopProductImage name={product.name} pedestal={meta.pedestal} />
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-label-md font-semibold text-white"
            title={product.displayName}
          >
            {product.displayName}
          </h3>
          {/* Categoría y cantidad poseída comparten renglón: eran dos líneas
              apiladas y el badge con borde propio sumaba una tercera. La
              cantidad sigue pesando menos que el precio, pero se lee igual. */}
          <p className="flex flex-wrap items-center gap-x-1.5 text-[10px] uppercase tracking-wide">
            <span className={meta.accent}>{labels.categories[product.category]}</span>
            {owned > 0 && (
              <span className="font-mono normal-case tracking-normal text-on-surface-variant/70">
                · {fill(labels.owned, { count: owned })}
              </span>
            )}
          </p>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-on-surface-variant/80">
              {product.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/[0.07] pt-1.5 sm:pt-2">
        <p className="flex min-w-0 items-center gap-1 font-mono text-[15px] font-semibold text-tertiary">
          <span aria-hidden className="material-symbols-outlined text-[15px]!">
            paid
          </span>
          <span className="truncate">{product.price.toLocaleString()}</span>
          <span className="sr-only">{labels.coinsUnit}</span>
        </p>

        {blocked ? (
          <span className="flex h-9 shrink-0 items-center rounded-md border border-white/12 px-2.5 text-[10px] font-semibold uppercase text-on-surface-variant sm:h-10">
            {blocked.label}
          </span>
        ) : (
          <button
            type="button"
            onClick={onBuy}
            disabled={!canAfford || soldOut}
            // El deshabilitado dice el motivo, no solo se apaga: un botón gris
            // no distingue "no te alcanza" de "agotado".
            title={!canAfford ? fill(labels.missing, { amount: missing.toLocaleString() }) : undefined}
            className="h-9 shrink-0 rounded-md bg-pokeball-red px-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-pokeball-red/85 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-on-surface-variant sm:h-10"
          >
            {canAfford ? labels.buy : labels.insufficient}
          </button>
        )}
      </div>

      {!canAfford && !blocked && (
        <p className="text-[10px] text-error">
          {fill(labels.missing, { amount: missing.toLocaleString() })}
        </p>
      )}
    </article>
  );
}

/**
 * Marco del sprite: tamaño fijo (56px mobile / 64px desde `sm`) con pedestal
 * teñido por categoría. El pixel art nunca se estira para llenar la card, y
 * todos los productos reservan el mismo espacio aunque falte el sprite.
 */
function ShopProductImage({ name, pedestal }: { name: string; pedestal: string }) {
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
  coins,
  labels,
  locale,
  onClose,
  onPurchased,
}: {
  product: ShopProduct;
  owned: number;
  coins: number;
  labels: ShopLabels;
  locale: string;
  onClose: () => void;
  onPurchased: (
    product: ShopProduct,
    quantity: number,
    coinsLeft: number,
    ownedAfter: number,
  ) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Tope real: lo que el saldo aguanta, acotado por el máximo del servidor.
  const affordable = Math.max(1, Math.min(MAX_PURCHASE_QUANTITY, Math.floor(coins / product.price)));
  const total = product.price * quantity;
  const balanceAfter = coins - total;

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
    startTransition(async () => {
      const result = await buyItem(product.id, locale, quantity);
      if (result.ok) {
        onPurchased(product, result.quantity, result.coinsLeft, result.ownedAfter);
        onClose();
        return;
      }
      // El error se muestra dentro del panel: cerrarlo perdería la cantidad
      // que el jugador ya eligió.
      setError(
        result.error === "no_coins" && result.missing !== undefined
          ? fill(labels.missing, { amount: result.missing.toLocaleString() })
          : labels.errorGeneric,
      );
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
          <ShopProductImage
            name={product.name}
            pedestal={SHOP_CATEGORY_META[product.category].pedestal}
          />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-label-md font-semibold text-white">
              {fill(labels.buyTitle, { name: product.displayName })}
            </h2>
            {product.description && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-on-surface-variant">
                {product.description}
              </p>
            )}
            {owned > 0 && (
              <p className="mt-1 font-mono text-[10px] text-on-surface-variant">
                {fill(labels.owned, { count: owned })}
              </p>
            )}
          </div>
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
            className="h-11 flex-1 rounded-md bg-pokeball-red text-label-sm font-bold text-white transition hover:bg-pokeball-red/85 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-on-surface-variant"
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
