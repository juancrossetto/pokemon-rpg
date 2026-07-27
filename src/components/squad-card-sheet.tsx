"use client";

import { useState, type ReactNode } from "react";
import { typeColor } from "@/lib/type-colors";
import { SegmentedStatBar, hpBarVariant } from "@/components/segmented-stat-bar";
import { EvolutionChainList } from "@/components/evolution-chain-list";
import type { EvolutionStage } from "@/lib/evolution-readiness";

export type SquadCardTab = "about" | "stats" | "evolutions";

export type SquadCardMoveSlot = {
  slot: number;
  name: string;
  type: string;
  currentPp: number;
  maxPp: number;
} | null;

export type SquadCardSheetLabels = {
  showDetails: string;
  hideDetails: string;
  tabAbout: string;
  tabStats: string;
  tabEvolutions: string;
  hp: string;
  exp: string;
  atk: string;
  def: string;
  spAtk: string;
  spDef: string;
  speed: string;
  emptyMove: string;
  unknownSpecies: string;
  evolveAtLevel: string;
  evolveByTrade: string;
  evolveStones: Record<string, string>;
  evolveReadyShort?: string;
  evolveNeedItem?: string;
  evolveNeedLevel?: string;
  evolveNow?: string;
  evolveUseStone?: string;
  evolving?: string;
};

/** Solapas About / Stats / Evolutions para cards de equipo. */
export function SquadCardSheet({
  labels,
  moves,
  currentHp,
  maxHp,
  xpPct,
  atk,
  def,
  spAtk,
  spDef,
  speed,
  evolutionChain,
  compact = false,
  collapsibleOnMobile = false,
  footer,
  instanceId,
  currentLevel,
  ownedEvolutionItems = [],
}: {
  labels: SquadCardSheetLabels;
  moves: SquadCardMoveSlot[];
  currentHp: number;
  maxHp: number;
  xpPct: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  evolutionChain: EvolutionStage[];
  compact?: boolean;
  /** En mobile oculta pestañas/stats/movimientos tras "Ver detalles". */
  collapsibleOnMobile?: boolean;
  footer?: ReactNode;
  instanceId?: string;
  currentLevel?: number;
  ownedEvolutionItems?: string[];
}) {
  const [tab, setTab] = useState<SquadCardTab>("about");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hpPct = Math.max(0, Math.min(100, maxHp > 0 ? (currentHp / maxHp) * 100 : 0));
  const hpPctLabel = `${Math.round(hpPct)}%`;
  const xpPctLabel = `${Math.round(xpPct)}%`;
  const hpExact = `${currentHp}/${maxHp}`;
  const statMax = Math.max(atk, def, spAtk, spDef, speed, 180);
  const slots = Array.from({ length: 4 }, (_, i) => moves[i] ?? null);

  const tabs: { id: SquadCardTab; label: string }[] = [
    { id: "about", label: labels.tabAbout },
    { id: "stats", label: labels.tabStats },
    { id: "evolutions", label: labels.tabEvolutions },
  ];

  return (
    <div
      className="relative z-[1]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* HP / EXP: mismo formato % para alinear barras; hover de HP muestra exacto */}
      <div className={compact ? "mb-2 space-y-1.5" : "mb-2.5 space-y-2"}>
        <MiniStatRow
          label={labels.hp}
          value={hpPctLabel}
          detail={hpExact}
          pct={hpPct}
          variant={hpBarVariant(hpPct)}
          compact={compact}
          segments={compact ? 10 : 14}
        />
        <MiniStatRow
          label={labels.exp}
          value={xpPctLabel}
          pct={xpPct}
          variant="xp"
          compact={compact}
          segments={compact ? 10 : 14}
        />
      </div>

      {/* En mobile sólo quedan visibles sprite/nombre/HP/EXP; pestañas, stats
          y movimientos entran acá detrás de "Ver detalles". Cada card pasaba de
          ~300px a poco más de la mitad. Desde sm se muestra todo como antes. */}
      {collapsibleOnMobile && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDetailsOpen((v) => !v);
          }}
          aria-expanded={detailsOpen}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.04] py-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant transition active:scale-[0.98] sm:hidden"
        >
          {detailsOpen ? labels.hideDetails : labels.showDetails}
          <span
            className={`material-symbols-outlined text-[14px]! transition-transform ${detailsOpen ? "rotate-180" : ""}`}
          >
            expand_more
          </span>
        </button>
      )}

      <div className={collapsibleOnMobile && !detailsOpen ? "hidden sm:block" : ""}>
      <div
        className={`flex border-b border-white/10 ${compact ? "gap-0" : "gap-0.5"}`}
        role="tablist"
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTab(t.id);
              }}
              className={[
                "relative min-w-0 flex-1 truncate px-0.5 pb-1.5 pt-0.5 font-semibold uppercase tracking-wide transition",
                compact ? "text-[8px]" : "text-[9px]",
                active ? "text-white" : "text-white/40 hover:text-white/70",
              ].join(" ")}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-white" />
              )}
            </button>
          );
        })}
      </div>

      <div
        className={
          compact
            ? "h-[118px] overflow-hidden pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "min-h-[120px] pt-2.5"
        }
        role="tabpanel"
      >
        {tab === "about" && (
          <ul className={compact ? "flex flex-col gap-1" : "flex flex-col gap-1.5"}>
            {slots.map((move, i) => {
              if (!move) {
                return (
                  <li
                    key={`empty-${i}`}
                    className={[
                      "flex items-center rounded-md border border-dashed border-white/10 text-white/35",
                      compact ? "min-h-6 px-1.5 text-[9px]" : "min-h-7 px-2 text-[11px]",
                    ].join(" ")}
                  >
                    {labels.emptyMove}
                  </li>
                );
              }
              const color = typeColor(move.type);
              const depleted = move.currentPp <= 0;
              return (
                <li
                  key={move.slot}
                  title={`${move.name} · ${move.currentPp}/${move.maxPp}`}
                  className={[
                    "flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-black/35",
                    compact ? "min-h-6 px-1.5 py-0.5" : "min-h-7 px-2 py-1",
                  ].join(" ")}
                >
                  <span
                    className={`shrink-0 rounded-[2px] ${compact ? "h-2 w-2" : "h-2.5 w-2.5"}`}
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span
                    className={[
                      "min-w-0 flex-1 truncate capitalize leading-tight text-white",
                      compact ? "text-[10px] font-medium" : "text-[12px] font-medium",
                    ].join(" ")}
                  >
                    {move.name.replace(/-/g, " ")}
                  </span>
                  <span
                    className={[
                      "shrink-0 font-mono tabular-nums tracking-tight",
                      compact ? "text-[9px]" : "text-[10px]",
                      depleted ? "text-error" : "text-white/50",
                    ].join(" ")}
                  >
                    {move.currentPp}/{move.maxPp}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "stats" && (
          <div className={compact ? "space-y-1.5" : "space-y-2"}>
            <MiniStatRow label={labels.atk} value={atk} pct={(atk / statMax) * 100} variant="stat" compact={compact} />
            <MiniStatRow label={labels.def} value={def} pct={(def / statMax) * 100} variant="stat" compact={compact} />
            <MiniStatRow label={labels.spAtk} value={spAtk} pct={(spAtk / statMax) * 100} variant="stat" compact={compact} />
            <MiniStatRow label={labels.spDef} value={spDef} pct={(spDef / statMax) * 100} variant="stat" compact={compact} />
            <MiniStatRow label={labels.speed} value={speed} pct={(speed / statMax) * 100} variant="stat" compact={compact} />
          </div>
        )}

        {tab === "evolutions" && (
          <EvolutionChainList
            stages={evolutionChain}
            unknownLabel={labels.unknownSpecies}
            evolveAtLevelLabel={labels.evolveAtLevel}
            tradeLabel={labels.evolveByTrade}
            itemLabels={labels.evolveStones}
            compact={compact}
            instanceId={instanceId}
            currentLevel={currentLevel}
            ownedItems={ownedEvolutionItems}
            readyLabel={labels.evolveReadyShort}
            needItemLabel={labels.evolveNeedItem}
            needLevelLabel={labels.evolveNeedLevel}
            evolveActionLabel={labels.evolveNow}
            useStoneLabel={labels.evolveUseStone}
            evolvingLabel={labels.evolving}
          />
        )}
      </div>
      </div>

      {footer}
    </div>
  );
}

function MiniStatRow({
  label,
  value,
  detail,
  pct,
  variant,
  compact,
  segments = 12,
}: {
  label: string;
  value: string | number;
  /** Tooltip (p. ej. HP exacto al hover). */
  detail?: string;
  pct: number;
  variant: "xp" | "hp" | "stat" | "danger";
  compact: boolean;
  segments?: number;
}) {
  return (
    <div
      className={[
        "group/stat relative grid items-center",
        compact
          ? "grid-cols-[1.75rem_2.25rem_minmax(0,1fr)] gap-1"
          : "grid-cols-[2.25rem_2.5rem_minmax(0,1fr)] gap-1.5",
      ].join(" ")}
      title={detail}
    >
      <span
        className={[
          "font-bold uppercase tracking-wider text-white/45",
          compact ? "text-[7px]" : "text-[9px]",
        ].join(" ")}
      >
        {label}
      </span>
      <span
        className={[
          "text-right font-mono font-semibold tabular-nums text-white",
          compact ? "text-[9px]" : "text-[11px]",
        ].join(" ")}
      >
        {value}
      </span>
      <SegmentedStatBar
        pct={pct}
        segments={segments}
        variant={variant}
        heightClass={compact ? "h-2" : "h-2.5"}
      />
      {detail ? (
        <span className="pointer-events-none absolute -top-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 px-1.5 py-0.5 font-mono text-[9px] text-white opacity-0 shadow-lg transition group-hover/stat:opacity-100">
          {detail}
        </span>
      ) : null}
    </div>
  );
}
