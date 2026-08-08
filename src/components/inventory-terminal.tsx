"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { formatMoveName } from "@/lib/format-move-name";
import { formatMoveEffectText } from "@/lib/format-move-effect";
import { typeColor } from "@/lib/type-colors";
// Desde @/lib/rarity y NO desde @/lib/market-hub: ese importa prisma, y en un
// client component eso mete `pg` en el bundle del browser y rompe el build.
import { RARITY_STYLES, itemRarity } from "@/lib/rarity";
import {
  BACKPACK_CAPACITY,
  CATEGORY_ICON,
  INVENTORY_CATEGORIES,
  countsByCategory,
  filterEntries,
  totalUnits,
  type CategoryFilter,
  type EvolveTarget,
  type InventoryEntry,
  type TmLearner,
} from "@/lib/inventory";
import { useEvolutionStone as applyEvolutionStone } from "@/actions/use-evolution-stone";
import { EvolvePopup } from "@/components/evolve-popup";
import { showToast } from "@/lib/app-toast";
import { playUiSfx } from "@/lib/battle-sfx";
import { ItemEvolutionRecipes } from "@/components/item-evolution-recipes";

export type InventoryLabels = {
  categories: Record<string, string>;
  all: string;
  searchPlaceholder: string;
  noResults: string;
  itemsCount: string;
  unitsCount: string;
  capacity: string;
  selectHint: string;
  quantity: string;
  value: string;
  effect: string;
  rarity: Record<string, string>;
  teaches: string;
  moveType: string;
  moveCategory: string;
  power: string;
  noPower: string;
  accuracy: string;
  neverMiss: string;
  pp: string;
  categoriesMove: Record<"PHYSICAL" | "SPECIAL" | "STATUS", string>;
  compatible: string;
  noLevelRequired: string;
  alreadyKnows: string;
  cannotLearn: string;
  noCompatible: string;
  sell: string;
  teach: string;
  use: string;
  useOnTeam: string;
  evolvePickerTitle: string;
  evolvePickerHint: string;
  evolveReady: string;
  evolveNeedLevel: string;
  evolveIncompatible: string;
  evolveNoTarget: string;
  evolveUsing: string;
  evolveFailed: string;
  close: string;
  sourcesTitle: string;
  sourcesHint: string;
  /** Título del bloque “sirve para evolucionar…”. */
  evolvesTitle: string;
};

/**
 * Inventario como terminal de almacenamiento: la columna de categorías y el
 * panel de detalle quedan fijos y sólo cambia la grilla del medio, así que
 * navegar no vuelve a montar la pantalla entera.
 *
 * Es client component porque seleccionar un ítem tiene que ser instantáneo.
 * Con `?item=` en la URL cada click sería un round-trip al servidor y la
 * sensación de "panel contextual" se perdería.
 */
export function InventoryTerminal({
  entries,
  labels,
  sellHref,
  teamHref,
}: {
  entries: InventoryEntry[];
  labels: InventoryLabels;
  sellHref: string;
  teamHref: string;
}) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.itemId ?? null);

  const counts = useMemo(() => countsByCategory(entries), [entries]);
  const units = useMemo(() => totalUnits(entries), [entries]);

  const visible = useMemo(
    () => filterEntries(entries, category, query),
    [entries, category, query],
  );

  const selected = useMemo(
    () => visible.find((e) => e.itemId === selectedId) ?? null,
    [visible, selectedId],
  );

  const capacityPct = Math.min(100, Math.round((units / BACKPACK_CAPACITY) * 100));

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera: stats + capacidad + búsqueda */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-end gap-5">
          <Stat value={entries.length} label={labels.itemsCount} />
          <Stat value={units} label={labels.unitsCount} />
          <div className="min-w-40 flex-1">
            <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
              {labels.capacity}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pokeball-red/70 to-pokeball-red transition-all duration-500"
                style={{ width: `${capacityPct}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-[11px] text-on-surface-variant">
              {units} / {BACKPACK_CAPACITY}
            </p>
          </div>
        </div>

        <div className="relative lg:w-64">
          <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px]! text-on-surface-variant">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-label-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/50 focus:border-pokeball-red/50"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Sidebar de categorías — en mobile es una fila de chips */}
        <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:w-44 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0">
          <CategoryButton
            active={category === "all"}
            icon="apps"
            label={labels.all}
            count={units}
            onClick={() => setCategory("all")}
          />
          {INVENTORY_CATEGORIES.map((c) => (
            <CategoryButton
              key={c}
              active={category === c}
              icon={CATEGORY_ICON[c]}
              label={labels.categories[c]}
              count={counts[c]}
              onClick={() => setCategory(c)}
            />
          ))}
        </nav>

        {/* Grilla */}
        <div className="min-w-0 flex-1">
          {visible.length === 0 ? (
            <div className="flex h-full min-h-52 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
              <span className="material-symbols-outlined text-[32px]! text-on-surface-variant/40">
                search_off
              </span>
              <p className="text-label-sm text-on-surface-variant">{labels.noResults}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
              {visible.map((entry) => (
                <ItemCard
                  key={entry.itemId}
                  entry={entry}
                  selected={entry.itemId === selectedId}
                  categoryLabel={labels.categories[entry.type]}
                  sourcesTitle={labels.sourcesTitle}
                  onSelect={() => setSelectedId(entry.itemId)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Panel contextual: fijo en desktop, hoja inferior en mobile */}
        <div className="lg:w-72 lg:shrink-0">
          {selected ? (
            <DetailPanel
              entry={selected}
              labels={labels}
              sellHref={sellHref}
              teamHref={teamHref}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="hidden h-full items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center lg:flex">
              <p className="text-label-sm text-on-surface-variant/70">{labels.selectHint}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-mono text-headline-md leading-none text-white">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
        {label}
      </p>
    </div>
  );
}

function CategoryButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition lg:w-full ${
        active
          ? "border-pokeball-red/45 bg-pokeball-red/10 text-white"
          : "border-white/8 bg-white/[0.02] text-on-surface-variant hover:border-white/20 hover:text-on-surface"
      }`}
    >
      {/* Ancho fijo + overflow-hidden: si una ligadura no resuelve, la fuente
          dibuja el nombre crudo y sin esto estira el botón y tapa la grilla. */}
      <span
        aria-hidden
        className={`material-symbols-outlined w-[18px] shrink-0 overflow-hidden text-[18px]! leading-none ${
          active ? "text-pokeball-red" : ""
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{label}</span>
      <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">{count}</span>
    </button>
  );
}

function ItemCard({
  entry,
  selected,
  categoryLabel,
  sourcesTitle,
  onSelect,
}: {
  entry: InventoryEntry;
  selected: boolean;
  categoryLabel: string;
  sourcesTitle: string;
  onSelect: () => void;
}) {
  const rarity = itemRarity(entry);
  const style = RARITY_STYLES[rarity];
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <li className={`relative ${infoOpen ? "z-30" : ""}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        // El borde de rareza es la piel base; el estado seleccionado lo pisa
        // con el rojo de marca para que se lea cuál está activo.
        className={`group flex w-full flex-col items-center gap-1 rounded-xl border bg-black/25 p-2 transition duration-200 hover:-translate-y-[3px] hover:border-pokeball-red/50 ${
          selected ? "border-pokeball-red/70 bg-pokeball-red/[0.07]" : style.border
        }`}
        style={{ boxShadow: selected ? `0 6px 18px ${style.glow}` : undefined }}
      >
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span
            className="absolute inset-2 rounded-full opacity-0 blur-lg transition-opacity duration-200 group-hover:opacity-100"
            style={{ background: style.glow }}
          />
          <Image
            src={itemDisplayUrl(entry.name)}
            alt=""
            width={44}
            height={44}
            unoptimized
            className="relative h-11 w-11 object-contain transition-transform duration-200 group-hover:scale-110"
          />
        </span>
        <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-white">
          {entry.displayName}
        </span>
        <span className="w-full truncate text-center text-[9px] uppercase tracking-wide text-on-surface-variant/70">
          {categoryLabel}
        </span>
        <span className="font-mono text-[11px] font-semibold text-on-surface-variant">
          ×{entry.quantity}
        </span>
      </button>

      {entry.sources.length > 0 ? (
        <SourceInfoButton
          sources={entry.sources}
          title={sourcesTitle}
          className="absolute right-1 top-1"
          open={infoOpen}
          onOpenChange={setInfoOpen}
        />
      ) : null}
    </li>
  );
}

/**
 * `i` chico que no compite con seleccionar la card: sólo abre al tocarlo.
 * Cierra con Escape, click afuera o segundo toque.
 */
function SourceInfoButton({
  sources,
  title,
  className = "",
  open,
  onOpenChange,
}: {
  sources: string[];
  title: string;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      onOpenChange(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className={`z-10 ${className}`}>
      <button
        type="button"
        aria-label={title}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
        className="flex h-5 w-5 items-center justify-center rounded-full text-white/30 transition hover:bg-white/10 hover:text-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
      >
        <span className="material-symbols-outlined text-[13px]! leading-none">info</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className="absolute right-0 top-6 z-20 w-44 rounded-lg border border-white/12 bg-[#0d1018]/97 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.55)] backdrop-blur-md"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/80">
            {title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {sources.map((source) => (
              <li
                key={source}
                className="text-[11px] leading-snug text-white/80"
              >
                {source}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DetailPanel({
  entry,
  labels,
  sellHref,
  teamHref,
  onClose,
}: {
  entry: InventoryEntry;
  labels: InventoryLabels;
  sellHref: string;
  teamHref: string;
  onClose: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const tLevelUp = useTranslations("levelUp");
  const rarity = itemRarity(entry);
  const style = RARITY_STYLES[rarity];
  const isRareCandy = entry.name === "Rare Candy";
  const canUseEvolve = entry.evolveTargets.length > 0;
  const hasEvolveReady = entry.evolveTargets.some((t) => t.canEvolve);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reveal, setReveal] = useState<{
    fromName: string;
    fromSpriteUrl: string;
    toName: string;
    toSpriteUrl: string;
  } | null>(null);
  // Primer destino útil del CTA: compatible y que todavía no lo sepa.
  const firstTeachable =
    entry.learners.find((l) => l.canLearn && !l.alreadyKnown) ?? null;
  const moveLabel = entry.moveName ? formatMoveName(entry.moveName, locale) : null;
  const effectText =
    formatMoveEffectText(entry.effectText, {
      locale,
      moveName: entry.moveName,
    }) ??
    (entry.effectText && entry.moveName && moveLabel
      ? entry.effectText.replace(new RegExp(entry.moveName, "gi"), moveLabel)
      : entry.effectText);

  function onPickEvolve(target: EvolveTarget) {
    if (!target.canEvolve || target.toSpeciesId == null || pending) return;
    startTransition(async () => {
      playUiSfx("evolve");
      const result = await applyEvolutionStone(
        target.instanceId,
        entry.name,
        locale,
        target.toSpeciesId!,
      );
      if (!result.ok) {
        showToast(labels.evolveFailed, "error");
        return;
      }
      setPickerOpen(false);
      setReveal({
        fromName: result.fromName,
        fromSpriteUrl: result.fromSpriteUrl,
        toName: result.toName,
        toSpriteUrl: result.toSpriteUrl,
      });
    });
  }

  return (
    <aside
      className={`flex flex-col gap-3 rounded-xl border bg-black/40 p-4 backdrop-blur-md ${style.border}`}
    >
      {reveal && (
        <EvolvePopup
          fromName={reveal.fromName}
          fromSpriteUrl={reveal.fromSpriteUrl}
          toName={reveal.toName}
          toSpriteUrl={reveal.toSpriteUrl}
          labels={{
            evolving: tLevelUp("evolvingCry", { name: reveal.fromName }),
            into: tLevelUp("evolvedInto", { name: reveal.toName }),
            continue: tLevelUp("dismiss"),
          }}
          onContinue={() => {
            setReveal(null);
            router.refresh();
          }}
        />
      )}

      {pickerOpen && (
        <EvolvePickerModal
          entry={entry}
          labels={labels}
          pending={pending}
          onClose={() => {
            if (!pending) setPickerOpen(false);
          }}
          onPick={onPickEvolve}
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[10px] uppercase tracking-[0.18em] ${style.text}`}>
            {labels.rarity[rarity]}
          </p>
          <h2 className="truncate text-[17px] font-bold leading-tight text-white">
            {entry.displayName}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="shrink-0 rounded-md p-1 text-on-surface-variant transition hover:text-white lg:hidden"
        >
          <span className="material-symbols-outlined text-[18px]!">close</span>
        </button>
      </div>

      <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
        <span
          className="absolute inset-3 rounded-full opacity-70 blur-xl"
          style={{ background: style.glow }}
        />
        <Image
          src={itemDisplayUrl(entry.name)}
          alt={entry.displayName}
          width={80}
          height={80}
          unoptimized
          className="relative h-20 w-20 object-contain"
        />
      </div>

      <dl className="flex flex-col gap-2">
        <Row label={labels.quantity} value={`×${entry.quantity}`} />
        <Row label={labels.value} value={`${entry.buyPrice}`} mono />
        {moveLabel && <Row label={labels.teaches} value={moveLabel} />}
        {entry.moveType && (
          <Row
            label={labels.moveType}
            value={
              <span
                className="rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ color: typeColor(entry.moveType) }}
              >
                {entry.moveType}
              </span>
            }
          />
        )}
        {entry.moveCategory && (
          <Row
            label={labels.moveCategory}
            value={labels.categoriesMove[entry.moveCategory]}
          />
        )}
        {entry.type === "MACHINE" && (
          <Row
            label={labels.power}
            value={entry.movePower != null ? String(entry.movePower) : labels.noPower}
            mono
          />
        )}
        {entry.type === "MACHINE" && (
          <Row
            label={labels.accuracy}
            value={
              entry.moveAccuracy != null ? `${entry.moveAccuracy}%` : labels.neverMiss
            }
            mono
          />
        )}
        {entry.movePp != null && (
          <Row label={labels.pp} value={String(entry.movePp)} mono />
        )}
      </dl>

      {effectText && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            {labels.effect}
          </p>
          <p className="text-[12px] leading-snug text-on-surface-variant">{effectText}</p>
        </div>
      )}

      <ItemEvolutionRecipes itemName={entry.name} title={labels.evolvesTitle} />

      {entry.sources.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            {labels.sourcesTitle}
          </p>
          <ul className="flex flex-col gap-0.5">
            {entry.sources.map((source) => (
              <li
                key={source}
                className="flex items-start gap-1.5 text-[12px] leading-snug text-on-surface-variant"
              >
                <span className="mt-0.5 material-symbols-outlined text-[12px]! text-white/30">
                  place
                </span>
                <span>{source}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] leading-snug text-on-surface-variant/55">
            {labels.sourcesHint}
          </p>
        </div>
      ) : null}

      {/*
        Una MT sin esta lista sólo decía qué movimiento enseña, no si servía para
        algo: había que ir a /team y abrir los seis Pokémon uno por uno para
        descubrir a quién se la podías dar. Cada compatible es además el atajo
        directo a enseñársela, así que la decisión y la acción pasan a estar en
        el mismo lugar.
      */}
      {entry.type === "MACHINE" && entry.learners.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            {labels.compatible}
          </p>
          <ul className="flex flex-col gap-1">
            {entry.learners.map((learner) => (
              <LearnerRow
                key={learner.instanceId}
                learner={learner}
                labels={labels}
                href={`${teamHref}?teach=${encodeURIComponent(entry.itemId)}&member=${encodeURIComponent(learner.instanceId)}`}
              />
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] leading-snug text-on-surface-variant/60">
            {entry.learners.some((l) => l.canLearn)
              ? labels.noLevelRequired
              : labels.noCompatible}
          </p>
        </div>
      )}

      <div className="mt-1 flex flex-col gap-1.5 border-t border-white/10 pt-3">
        {canUseEvolve &&
          (hasEvolveReady ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="ui-btn-primary flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-label-sm"
            >
              <span className="material-symbols-outlined text-[16px]!">auto_fix_high</span>
              {labels.use}
            </button>
          ) : (
            <span
              aria-disabled
              title={labels.evolveNoTarget}
              className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/8 px-3 py-2 text-label-sm text-on-surface-variant/40"
            >
              <span className="material-symbols-outlined text-[16px]!">auto_fix_high</span>
              {labels.use}
            </span>
          ))}
        <a
          href={sellHref}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-label-sm ${
            canUseEvolve
              ? "border border-white/12 text-on-surface-variant transition hover:border-pokeball-red/40 hover:text-on-surface"
              : "ui-btn-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]!">sell</span>
          {labels.sell}
        </a>
        {/*
          Antes apuntaba a `/team` pelado: el botón cumplía con navegar y ahí
          moría, sin decirle a la pantalla de destino qué MT traía el jugador.
          Ahora viaja el ítem y, si hay alguno compatible, también a quién
          enseñársela — /team abre ese Pokémon con la MT ya desplegada. Se
          deshabilita cuando no hay nadie compatible en vez de llevar a una
          pantalla donde no se puede hacer nada.
        */}
        {entry.type === "MACHINE" &&
          (firstTeachable ? (
            <a
              href={`${teamHref}?teach=${encodeURIComponent(entry.itemId)}&member=${encodeURIComponent(firstTeachable.instanceId)}`}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-label-sm text-on-surface-variant transition hover:border-pokeball-red/40 hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]!">school</span>
              {labels.teach}
            </a>
          ) : (
            <span
              aria-disabled
              title={labels.noCompatible}
              className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/8 px-3 py-2 text-label-sm text-on-surface-variant/40"
            >
              <span className="material-symbols-outlined text-[16px]!">school</span>
              {labels.teach}
            </span>
          ))}
        {isRareCandy && (
          <a
            href={teamHref}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-label-sm text-on-surface-variant transition hover:border-pokeball-red/40 hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]!">nutrition</span>
            {labels.useOnTeam}
          </a>
        )}
      </div>
    </aside>
  );
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : `{${key}}`,
  );
}

function EvolvePickerModal({
  entry,
  labels,
  pending,
  onClose,
  onPick,
}: {
  entry: InventoryEntry;
  labels: InventoryLabels;
  pending: boolean;
  onClose: () => void;
  onPick: (target: EvolveTarget) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current
      ?.querySelector<HTMLButtonElement>("button:not([disabled])")
      ?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, pending]);

  if (!mounted) return null;

  const title = fill(labels.evolvePickerTitle, { name: entry.displayName });

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-3 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(85vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#12141c] shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
          <Image
            src={itemDisplayUrl(entry.name)}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[15px] font-bold leading-snug text-white"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-on-surface-variant">
              {labels.evolvePickerHint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={labels.close}
            className="shrink-0 rounded-md p-1 text-on-surface-variant transition hover:text-white disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]!">close</span>
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {entry.evolveTargets.map((target) => (
            <EvolveTargetRow
              key={target.instanceId}
              target={target}
              labels={labels}
              pending={pending}
              onPick={onPick}
            />
          ))}
        </ul>

        {pending ? (
          <p className="border-t border-white/10 px-4 py-2.5 text-center text-[12px] text-on-surface-variant">
            {labels.evolveUsing}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function EvolveTargetRow({
  target,
  labels,
  pending,
  onPick,
}: {
  target: EvolveTarget;
  labels: InventoryLabels;
  pending: boolean;
  onPick: (target: EvolveTarget) => void;
}) {
  const state = !target.speciesMatches
    ? labels.evolveIncompatible
    : target.levelsShort > 0
      ? fill(labels.evolveNeedLevel, {
          level: target.level + target.levelsShort,
        })
      : labels.evolveReady;

  const body = (
    <>
      <Image
        src={target.spriteUrl}
        alt=""
        width={40}
        height={40}
        unoptimized
        className={`h-10 w-10 shrink-0 object-contain [image-rendering:pixelated] ${
          target.canEvolve ? "" : "opacity-40 grayscale"
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate capitalize text-on-surface">
          {target.name}
        </span>
        <span className="block text-[10px] text-on-surface-variant/70">
          Nv. {target.level}
          {target.canEvolve && target.toName ? ` → ${target.toName}` : ""}
        </span>
      </span>
      {target.canEvolve ? (
        <span className="material-symbols-outlined shrink-0 text-[18px]! text-tertiary">
          auto_fix_high
        </span>
      ) : (
        <span className="max-w-[7.5rem] shrink-0 text-right text-[10px] leading-tight text-on-surface-variant/50">
          {state}
        </span>
      )}
    </>
  );

  const base =
    "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-[13px] transition";

  return (
    <li className="py-0.5">
      {target.canEvolve ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => onPick(target)}
          className={`${base} border-tertiary/30 bg-tertiary/[0.08] text-on-surface hover:border-tertiary/55 hover:bg-tertiary/15 disabled:cursor-wait disabled:opacity-60`}
        >
          {body}
        </button>
      ) : (
        <div
          className={`${base} cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-on-surface-variant/70`}
        >
          {body}
        </div>
      )}
    </li>
  );
}

/**
 * Un Pokémon del equipo frente a esta MT. Tres estados excluyentes: puede
 * aprenderla (es un link accionable), ya la sabe, o la especie no es compatible.
 * Los dos últimos se muestran apagados en vez de esconderse: saber que Machop
 * NO puede aprender Rayo es tan útil como saber que Pikachu sí, y esconderlo
 * deja al jugador preguntándose si falta alguien.
 */
function LearnerRow({
  learner,
  labels,
  href,
}: {
  learner: TmLearner;
  labels: InventoryLabels;
  href: string;
}) {
  const actionable = learner.canLearn && !learner.alreadyKnown;
  const state = !learner.canLearn
    ? labels.cannotLearn
    : learner.alreadyKnown
      ? labels.alreadyKnows
      : null;

  const body = (
    <>
      <Image
        src={learner.spriteUrl}
        alt=""
        width={28}
        height={28}
        unoptimized
        className={`h-7 w-7 shrink-0 object-contain [image-rendering:pixelated] ${
          learner.canLearn ? "" : "opacity-40 grayscale"
        }`}
      />
      <span className="min-w-0 flex-1 truncate capitalize">{learner.name}</span>
      {state ? (
        <span className="shrink-0 text-[10px] text-on-surface-variant/50">{state}</span>
      ) : (
        <span className="material-symbols-outlined shrink-0 text-[16px]! text-tertiary">
          arrow_forward
        </span>
      )}
    </>
  );

  const base =
    "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[12px] transition";

  return (
    <li>
      {actionable ? (
        <a
          href={href}
          className={`${base} border-tertiary/25 bg-tertiary/[0.06] text-on-surface hover:border-tertiary/50 hover:bg-tertiary/10`}
        >
          {body}
        </a>
      ) : (
        <div className={`${base} border-white/[0.06] bg-white/[0.02] text-on-surface-variant/70`}>
          {body}
        </div>
      )}
    </li>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1.5">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{label}</dt>
      <dd className={`text-right text-[13px] text-white ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
