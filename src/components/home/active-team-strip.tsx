"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setTeamLayout } from "@/actions/pc";
import { typeColor } from "@/lib/type-colors";
import { playPcSfx } from "@/lib/pc-sfx";
import {
  SquadCardContextMenu,
} from "@/components/squad-card-context-menu";
import { SquadCardSheet, type SquadCardSheetLabels } from "@/components/squad-card-sheet";
import { PokemonShowcaseCard } from "@/components/pokemon-showcase-card";
import { AllocatePointsPanel } from "@/components/allocate-points-panel";
import { PokeSparks } from "@/components/poke-sparks";
import { SegmentedStatBar, hpBarVariant } from "@/components/segmented-stat-bar";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { HeldItemInfo, HeldItemLabels, OwnedHeldItem } from "@/components/held-item-panel";
import type { SquadBagCounts } from "@/lib/squad-bag";
import { anyEvolveReady } from "@/lib/evolution-readiness";
import { CoachMark } from "@/components/journey-guidance";
import { useTypeLabel } from "@/hooks/use-type-label";
import type { HomeSquadFilter } from "@/components/home/home-desktop-rail";
import { HOME_TEAM_HEALED_EVENT } from "@/lib/home-heal-fx";
import { itemHdIconUrl, itemSpriteUrl } from "@/lib/item-sprites";
import { lockBodyScroll } from "@/lib/scroll-lock";

const TEAM_SIZE = 6;
/** Mobile 3×2 con HP · md+ fila de 6. */
const SLOT_BOX =
  "h-full min-h-[7.25rem] w-full md:h-[248px] md:min-h-0";

function TeamSlot({
  member,
  index,
  leadLabel,
  slotLabel,
  emptyLabel,
  bagCounts,
  onBagChange,
  onHealed,
  onLeveledUp,
  onPpRestored,
  onFlagsChange,
  onPointsAllocated,
  onDepositToPc,
  canDepositToPc,
  isDepositing,
  isDragging,
  isOver,
  pending,
  onDragStart,
  onDragEnd,
  showEmptyCoach,
  ownedHeldItems,
  heldLabels,
  onHeldChange,
}: {
  member: HomeSquadMember | null;
  index: number;
  leadLabel: string;
  slotLabel: string;
  emptyLabel: string;
  bagCounts: SquadBagCounts;
  onBagChange: (next: SquadBagCounts) => void;
  onHealed: (id: string, currentHp: number, maxHp: number) => void;
  onLeveledUp: (
    id: string,
    next: { level: number; currentHp: number; maxHp: number; levelLabel: string },
  ) => void;
  onPpRestored: (
    id: string,
    next: { moveName: string; restoredBy: number; allMoves: boolean },
  ) => void;
  onFlagsChange: (
    id: string,
    next: { isFavorite?: boolean; isTradeLocked?: boolean },
  ) => void;
  onPointsAllocated: (
    id: string,
    next: {
      unspentPoints: number;
      points: HomeSquadMember["points"];
      maxHp: number;
      currentHpDelta: number;
      atk: number;
      def: number;
      spAtk: number;
      spDef: number;
      speed: number;
    },
  ) => void;
  onDepositToPc: (id: string) => void;
  canDepositToPc: boolean;
  isDepositing: boolean;
  isDragging: boolean;
  isOver: boolean;
  pending: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  /** Un solo coach mark en el primer slot vacío, no uno por cada hueco. */
  showEmptyCoach?: boolean;
  ownedHeldItems: OwnedHeldItem[];
  heldLabels: HeldItemLabels;
  onHeldChange: (id: string, next: HeldItemInfo | null) => void;
}) {
  const tTeam = useTranslations("team");
  const typeLabel = useTypeLabel();
  const tUx = useTranslations("ux");
  const tRail = useTranslations("home.rail");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const skipClickRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const releaseScroll = lockBodyScroll();
    document.addEventListener("keydown", onKey);
    return () => {
      releaseScroll();
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!member) {
    const emptySlot = (
      <Link
        href="/team?tab=pc"
        className={`team-slot team-slot--empty group flex ${SLOT_BOX} flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-on-surface-variant transition hover:border-white/28 hover:bg-white/[0.04] md:rounded-[1.25rem]`}
        aria-label={emptyLabel}
      >
        <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.03] transition group-hover:border-white/30 md:mb-1.5 md:h-11 md:w-11">
          <span className="material-symbols-outlined text-[18px]! md:text-[22px]!">add</span>
        </div>
        <span className="hidden px-2 text-center text-[10px] uppercase tracking-wider text-on-surface-variant/75 md:block">
          {emptyLabel}
        </span>
      </Link>
    );
    if (!showEmptyCoach) return emptySlot;
    return (
      <CoachMark
        storageKey="coach-team-slot"
        message={tUx("coachTeamSlot")}
        oncePerSession
        className="block h-full"
      >
        {emptySlot}
      </CoachMark>
    );
  }

  const accent = typeColor(member.types[0] ?? "normal");
  const fainted = member.currentHp <= 0;
  const hpPct =
    member.maxHp > 0
      ? Math.max(0, Math.min(100, (member.currentHp / member.maxHp) * 100))
      : 0;
  const canEvolve = anyEvolveReady(
    member.evolutionChain,
    member.level,
    new Set(member.ownedEvolutionItems ?? []),
  );
  const displayName = member.nickname ?? member.speciesName;
  const isLead = index === 0;
  /* Misma suma que `pokemonPower` en ranking: HP + las 5 stats de combate. */
  const combatPower =
    member.maxHp +
    member.atk +
    member.def +
    member.spAtk +
    member.spDef +
    member.speed;
  const cpMark = `${tRail("cp")} ${combatPower.toLocaleString()}`;

  const sheetLabels: SquadCardSheetLabels = {
    showDetails: member.labels.showDetails,
    hideDetails: member.labels.hideDetails,
    tabAbout: member.labels.tabAbout,
    tabStats: member.labels.tabStats,
    tabEvolutions: member.labels.tabEvolutions,
    hp: member.labels.hp,
    exp: member.labels.exp,
    atk: member.labels.atk,
    def: member.labels.def,
    spAtk: member.labels.spAtk,
    spDef: member.labels.spDef,
    speed: member.labels.speed,
    emptyMove: member.labels.emptyMove,
    unknownSpecies: member.labels.unknownSpecies,
    evolveAtLevel: member.labels.evolveAtLevel,
    evolveByTrade: member.labels.evolveByTrade,
    evolveTradeItemHint: member.labels.evolveTradeItemHint,
    evolveStones: member.labels.evolveStones,
    evolveReadyShort: member.labels.evolveReadyShort,
    evolveNeedItem: member.labels.evolveNeedItem,
    evolveNeedLevel: member.labels.evolveNeedLevel,
    evolveNow: member.labels.evolveNow,
    evolveUseStone: member.labels.evolveUseStone,
    evolving: member.labels.evolving,
  };

  const menuProps = {
    instanceId: member.id,
    pokemonName: displayName,
    currentHp: member.currentHp,
    maxHp: member.maxHp,
    level: member.level,
    isFavorite: member.isFavorite,
    isTradeLocked: member.isTradeLocked,
    canHeal: member.currentHp > 0 && member.currentHp < member.maxHp,
    canRevive: member.currentHp <= 0,
    canLevelUp: member.level < 100,
    labels: member.menuLabels,
    bagCounts,
    allocatePoints: member.points,
    allocateUnspent: member.unspentPoints,
    allocateBases: member.bases,
    onBagChange,
    onHealed: ({ currentHp, maxHp }: { currentHp: number; maxHp: number }) =>
      onHealed(member.id, currentHp, maxHp),
    onPpRestored: (next: { moveName: string; restoredBy: number; allMoves: boolean }) =>
      onPpRestored(member.id, next),
    onLeveledUp: (next: { level: number; currentHp: number; maxHp: number }) =>
      onLeveledUp(member.id, {
        ...next,
        levelLabel: tTeam("level", { level: next.level }),
      }),
    onFlagsChange: (next: { isFavorite?: boolean; isTradeLocked?: boolean }) =>
      onFlagsChange(member.id, next),
    onPointsAllocated: (
      next: {
        unspentPoints: number;
        points: HomeSquadMember["points"];
        maxHp: number;
        currentHpDelta: number;
        atk: number;
        def: number;
        spAtk: number;
        spDef: number;
        speed: number;
      },
    ) => onPointsAllocated(member.id, next),
    onDepositToPc: () => {
      setOpen(false);
      onDepositToPc(member.id);
    },
    canDepositToPc,
    heldItem: member.heldItem,
    ownedHeldItems,
    heldLabels,
    onHeldChange: (next: HeldItemInfo | null) => onHeldChange(member.id, next),
  };

  return (
    <>
      <SquadCardContextMenu {...menuProps} showViewTeam triggerVariant="ghost">
        <button
          type="button"
          draggable={!pending && !isDepositing}
          onDragStart={(e) => {
            skipClickRef.current = true;
            onDragStart(member.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", member.id);
          }}
          onDragEnd={() => {
            onDragEnd();
            requestAnimationFrame(() => {
              skipClickRef.current = false;
            });
          }}
          onClick={() => {
            if (skipClickRef.current || isDepositing) return;
            setOpen(true);
          }}
          aria-label={`${displayName}, ${member.levelLabel}, ${cpMark}`}
          className={`team-card team-slot group relative flex ${SLOT_BOX} flex-col overflow-hidden rounded-xl border text-left transition duration-300 active:scale-[0.97] md:rounded-[1.25rem] ${
            isDepositing ? "team-slot--depositing" : ""
          } ${isOver ? "ring-2 ring-pokeball-red/60 ring-offset-2 ring-offset-background" : ""} ${
            isDragging ? "opacity-40" : isDepositing ? "" : "hover:scale-[1.01]"
          } ${
            isLead || member.isFavorite
              ? "border-pokeball-red/35 shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
              : "border-white/[0.08] hover:border-white/20"
          } ${fainted ? "opacity-80" : ""}`}
          style={{ "--type-accent": accent } as CSSProperties}
        >
        <div className="relative flex min-h-0 flex-[1.15] flex-col items-center justify-end px-1 pb-0 pt-2.5 md:flex-[1.4] md:px-2 md:pt-6">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 90% 70% at 50% 42%, ${accent}66 0%, transparent 72%)`,
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[44%] hidden h-[70%] max-h-32 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.08] md:block"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, transparent 36%, currentColor 37%, currentColor 48%, transparent 49%)",
              color: accent,
            }}
            aria-hidden
          />

          <div className="hidden md:contents">
            <PokeSparks seed={member.id} accent={accent} />
          </div>

          <div className="absolute left-1 top-1 z-[2] flex max-w-[calc(100%-0.5rem)] flex-wrap items-center gap-0.5 md:left-2 md:top-1.5 md:max-w-[calc(100%-0.75rem)]">
            {isLead ? (
              <span
                className="flex items-center text-[#21CEA1] drop-shadow-[0_0_6px_rgba(33,206,161,0.55)]"
                title={leadLabel}
              >
                <span className="material-symbols-outlined ms-fill text-[13px]! leading-none md:text-[15px]!">
                  military_tech
                </span>
              </span>
            ) : null}
            {member.isFavorite && (
              <span
                className="flex items-center text-electric-yellow"
                title={member.labels.favorite}
              >
                <span className="material-symbols-outlined ms-fill text-[12px]! leading-none md:text-[14px]!">
                  star
                </span>
              </span>
            )}
            {member.isTradeLocked && (
              <span
                className="hidden items-center text-white/50 md:flex"
                title={member.labels.tradeLocked}
              >
                <span className="material-symbols-outlined text-[13px]! leading-none">lock</span>
              </span>
            )}
            <span className="rounded-full border border-white/15 bg-black/45 px-1 py-px font-mono text-[9px] font-semibold leading-none text-white backdrop-blur-sm md:px-1.5 md:py-0.5 md:text-[10px]">
              {member.levelLabel}
            </span>
            {canEvolve && (
              <span
                className="inline-flex items-center rounded-full border border-tertiary/40 bg-tertiary/20 px-0.5 py-px text-tertiary backdrop-blur-sm md:px-1 md:py-0.5"
                title={member.labels.canEvolveBadge}
              >
                <span className="material-symbols-outlined text-[10px]! leading-none md:text-[11px]!">
                  auto_awesome
                </span>
              </span>
            )}
            {member.heldItem ? (
              <span
                title={member.heldItem.displayName}
                className="inline-flex items-center rounded-full border border-white/15 bg-black/50 p-0.5 backdrop-blur-sm"
              >
                <Image
                  src={
                    itemHdIconUrl(member.heldItem.name) ??
                    itemSpriteUrl(member.heldItem.name)
                  }
                  alt=""
                  width={16}
                  height={16}
                  unoptimized
                  className="h-3.5 w-3.5 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] md:h-4 md:w-4"
                />
              </span>
            ) : null}
          </div>

          {/* El sprite manda: ocupa ~55% de la card en desktop. Antes eran 90px
              sobre 230 (39%) y el Pokémon quedaba detrás del cromo. */}
          <div className="relative z-[1] flex h-full min-h-[2.75rem] w-full max-h-[4.5rem] items-end justify-center md:h-[132px] md:max-h-none md:min-h-0">
            <div
              className="absolute bottom-0 h-4 w-10 rounded-[100%] opacity-55 blur-md transition group-hover:opacity-75 md:h-7 md:w-20"
              style={{ background: accent }}
            />
            {member.spriteUrl ? (
              <Image
                src={member.spriteUrl}
                alt=""
                width={160}
                height={160}
                className={`relative z-[1] h-[88%] w-auto max-h-[72px] max-w-[72px] object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.65)] transition duration-300 group-hover:scale-105 md:h-[130px] md:w-[130px] md:max-h-none md:max-w-none ${
                  fainted ? "grayscale" : ""
                }`}
              />
            ) : (
              <span className="material-symbols-outlined relative z-[1] text-[28px]! text-white/25 md:text-[56px]!">
                sports_baseball
              </span>
            )}
          </div>
        </div>

        <div className="relative z-[1] flex shrink-0 flex-col bg-gradient-to-b from-transparent to-black/35 px-1 pb-1 pt-0 md:px-2 md:pb-2 md:pt-0.5">
          <p className="truncate text-center text-[11px] font-bold capitalize tracking-tight text-white md:text-[13px]">
            {displayName}
          </p>
          <div className="mt-0.5 hidden flex-wrap items-center justify-center gap-0.5 md:flex">
            {member.types.slice(0, 2).map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded-full border border-white/10 bg-black/40 px-1.5 py-px text-[7px] font-bold uppercase tracking-wide"
                  style={{ color }}
                >
                  {typeLabel(type)}
                </span>
              );
            })}
            {fainted && (
              <span className="rounded-full bg-error/20 px-1.5 py-px text-[7px] font-bold uppercase text-error">
                {member.labels.fainted}
              </span>
            )}
          </div>

          {/* PC + HP: meta de combate al pie, sin watermark sobre el sprite. */}
          <div
            className="mt-1 grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-1 gap-y-0.5 md:mt-1.5 md:grid-cols-[1.6rem_minmax(0,1fr)] md:gap-y-1"
            title={`${cpMark} · ${member.labels.hp} ${member.currentHp}/${member.maxHp}`}
          >
            <span className="text-[8px] font-bold uppercase tracking-wider text-white/45">
              {tRail("cp")}
            </span>
            <span className="font-mono text-[10px] font-semibold tabular-nums leading-none text-white/70 md:text-[11px]">
              {combatPower.toLocaleString()}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-white/45">
              {member.labels.hp}
            </span>
            <SegmentedStatBar
              pct={hpPct}
              variant={hpBarVariant(hpPct)}
              segments={8}
              heightClass="h-1.5 md:h-2"
            />
          </div>
        </div>
      </button>
      </SquadCardContextMenu>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-center px-margin-mobile pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.5rem)] sm:items-center sm:p-4 sm:pb-4 xl:pb-4">
            <button
              type="button"
              aria-label={tTeam("drawer.hideDetails")}
              className="team-detail-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={displayName}
              className="team-detail-sheet relative z-[1] flex max-h-[min(88dvh,calc(100dvh-var(--bottom-nav-h)-env(safe-area-inset-bottom)-1.5rem))] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0b0d13] shadow-[0_12px_48px_rgba(0,0,0,0.55)] sm:rounded-[1.5rem] sm:shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
            >
              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* El disparador "…" se corre a la izquierda: la esquina es
                    del botón de cerrar y los dos se pisaban. */}
                <SquadCardContextMenu
                  {...menuProps}
                  showViewTeam={false}
                  triggerPosition="right-14 top-3"
                >
                  <PokemonShowcaseCard
                    flush
                    interactive={false}
                    speciesId={member.speciesId}
                    speciesName={member.speciesName}
                    nickname={member.nickname}
                    types={member.types}
                    spriteUrl={member.spriteUrl}
                    fainted={fainted}
                    faintedLabel={member.labels.fainted}
                    badges={{
                      slot: index === 0 ? null : slotLabel,
                      lead: index === 0 ? leadLabel : null,
                      level: member.levelLabel,
                      favorite: member.isFavorite ? member.labels.favorite : null,
                      tradeLocked: member.isTradeLocked ? member.labels.tradeLocked : null,
                      canEvolve: canEvolve ? (member.labels.canEvolveBadge ?? "") : null,
                      heldItem: member.heldItemName,
                      heldItemName: member.heldItem?.name ?? null,
                    }}
                    overlay={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                        }}
                        className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-black/55 text-on-surface-variant backdrop-blur-sm transition hover:border-white/25 hover:text-on-surface"
                        aria-label={tTeam("drawer.hideDetails")}
                      >
                        <span className="material-symbols-outlined text-[20px]!">close</span>
                      </button>
                    }
                  >
                    <div className="mt-3">
                      <SquadCardSheet
                        labels={sheetLabels}
                        moves={member.moves}
                        currentHp={member.currentHp}
                        maxHp={member.maxHp}
                        xpPct={member.xpPct}
                        atk={member.atk}
                        def={member.def}
                        spAtk={member.spAtk}
                        spDef={member.spDef}
                        speed={member.speed}
                        evolutionChain={member.evolutionChain}
                        instanceId={member.id}
                        currentLevel={member.level}
                        ownedEvolutionItems={member.ownedEvolutionItems}
                      />
                      <div className="relative mt-1" onClick={(e) => e.stopPropagation()}>
                        <AllocatePointsPanel
                          instanceId={member.id}
                          level={member.level}
                          unspentPoints={member.unspentPoints}
                          points={member.points}
                          bases={member.bases}
                          defaultOpen={member.unspentPoints > 0}
                          onAllocated={(next) => onPointsAllocated(member.id, next)}
                        />
                      </div>
                    </div>
                  </PokemonShowcaseCard>
                </SquadCardContextMenu>
              </div>

              <div className="border-t border-white/10 bg-[#0a0a0a] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Link
                  href="/team"
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/15 text-[13px] font-semibold text-on-surface transition hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  {member.menuLabels.viewTeam}
                  <span className="material-symbols-outlined text-[16px]!">chevron_right</span>
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function ActiveTeamStrip({
  locale,
  initialMembers,
  emptySlotLabel,
  leadLabel,
  slotLabels,
  initialBagCounts,
  ownedHeldItems,
  heldLabels,
  focusFilter = "all",
  title,
  manageHref,
  manageLabel,
  onCompanionTypesChange,
}: {
  locale: string;
  initialMembers: HomeSquadMember[];
  emptySlotLabel: string;
  leadLabel: string;
  slotLabels: string[];
  initialBagCounts: SquadBagCounts;
  ownedHeldItems: OwnedHeldItem[];
  heldLabels: HeldItemLabels;
  focusFilter?: HomeSquadFilter;
  title?: string;
  manageHref?: string;
  manageLabel?: string;
  /** Tipos del favorito (o líder) — el banner de home pinta el flúor con esto. */
  onCompanionTypesChange?: (types: string[]) => void;
}) {
  const t = useTranslations("pc");
  const [members, setMembers] = useState(initialMembers);
  const [bagCounts, setBagCounts] = useState(initialBagCounts);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [depositingId, setDepositingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [lastInitialMembers, setLastInitialMembers] = useState(initialMembers);
  if (lastInitialMembers !== initialMembers) {
    setLastInitialMembers(initialMembers);
    setMembers((prev) => {
      const byId = new Map(initialMembers.map((m) => [m.id, m]));
      const merged = prev
        .map((m) => {
          const fresh = byId.get(m.id);
          return fresh ? { ...m, ...fresh, id: m.id } : null;
        })
        .filter((m): m is HomeSquadMember => m !== null);
      for (const m of initialMembers) {
        if (!merged.some((x) => x.id === m.id)) merged.push(m);
      }
      return merged;
    });
  }
  const [lastBagCounts, setLastBagCounts] = useState(initialBagCounts);
  if (lastBagCounts !== initialBagCounts) {
    setLastBagCounts(initialBagCounts);
    setBagCounts(initialBagCounts);
  }

  useEffect(() => {
    function onTeamHealed() {
      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          currentHp: m.maxHp,
          moves: m.moves.map((slot) =>
            slot ? { ...slot, currentPp: slot.maxPp } : null,
          ),
        })),
      );
    }
    window.addEventListener(HOME_TEAM_HEALED_EVENT, onTeamHealed);
    return () => window.removeEventListener(HOME_TEAM_HEALED_EVENT, onTeamHealed);
  }, []);

  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => members[i] ?? null);
  const firstEmptyIndex = slots.findIndex((m) => m === null);

  function commit(next: HomeSquadMember[]) {
    const previous = members;
    setMembers(next);
    setError(null);
    startTransition(async () => {
      const result = await setTeamLayout(
        locale,
        next.map((m) => m.id),
      );
      if (!result.ok) {
        setMembers(previous);
        setError(result.error);
      }
    });
  }

  function dropOnSlot(index: number) {
    if (!dragId) return;
    const mon = members.find((m) => m.id === dragId);
    if (!mon) return;
    const rest = members.filter((m) => m.id !== mon.id);
    const at = Math.min(index, rest.length);
    commit([...rest.slice(0, at), mon, ...rest.slice(at)]);
  }

  function depositToPc(id: string) {
    if (depositingId || pending) return;
    const mon = members.find((m) => m.id === id);
    if (!mon) return;
    if (mon.isTradeLocked) {
      setError("trade_locked");
      return;
    }
    if (members.length <= 1) {
      setError("last_team_member");
      return;
    }
    const next = members.filter((m) => m.id !== id);
    if (next.length === members.length) return;

    setError(null);
    setDepositingId(id);
    playPcSfx("store");

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : 480;

    window.setTimeout(() => {
      const previous = members;
      setMembers(next);
      setDepositingId(null);
      startTransition(async () => {
        const result = await setTeamLayout(
          locale,
          next.map((m) => m.id),
        );
        if (!result.ok) {
          setMembers(previous);
          setError(result.error);
        }
      });
    }, delay);
  }

  const canDeposit = members.length > 1;

  return (
    <section
      className={`relative flex min-w-0 flex-col ${pending ? "opacity-90" : ""}`}
    >
      {title ? (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="page-title text-[10px] leading-none tracking-[0.16em] text-secondary sm:text-white/45">
            {title}
          </p>
          {manageHref && manageLabel ? (
            <Link
              href={manageHref}
              aria-label={manageLabel}
              title={manageLabel}
              className="-mr-0.5 inline-flex shrink-0 items-center justify-center p-0.5 text-secondary transition hover:brightness-125 active:scale-95 sm:text-white/45 sm:hover:text-white/75"
            >
              <span className="material-symbols-outlined text-[16px]! leading-none">
                tune
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mb-2 shrink-0 rounded-lg border border-error/40 bg-error-container/30 px-3 py-1.5 text-[12px] text-error">
          {t(`errors.${error}`)}
        </div>
      ) : null}

      {/* Mobile 3×2 (foco en el equipo) · md+: fila de 6. */}
      <div className="min-w-0">
        <div className="grid min-w-0 grid-cols-3 gap-1.5 md:grid-cols-6 md:gap-2">
          {slots.map((member, i) => {
            const matches =
              !member ||
              focusFilter === "all" ||
              (focusFilter === "favorites" && member.isFavorite) ||
              (focusFilter === "injured" && member.currentHp < member.maxHp) ||
              (focusFilter === "ready" && member.currentHp >= member.maxHp);
            return (
            <div
              key={member?.id ?? `empty-${i}`}
              data-team-rail-item
              className={`min-h-0 min-w-0 transition-opacity duration-200 ${
                matches ? "opacity-100" : "opacity-35"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverSlot(i);
              }}
              onDragLeave={() => setOverSlot((s) => (s === i ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                dropOnSlot(i);
                setDragId(null);
                setOverSlot(null);
              }}
            >
              <TeamSlot
                member={member}
                index={i}
                leadLabel={leadLabel}
                slotLabel={slotLabels[i] ?? String(i + 1)}
                emptyLabel={emptySlotLabel}
                bagCounts={bagCounts}
                ownedHeldItems={ownedHeldItems}
                heldLabels={heldLabels}
                showEmptyCoach={i === firstEmptyIndex}
                onBagChange={setBagCounts}
                onHeldChange={(id, next) =>
                  setMembers((prev) =>
                    prev.map((m) =>
                      m.id === id
                        ? {
                            ...m,
                            heldItem: next,
                            heldItemName: next?.displayName ?? null,
                          }
                        : // Unique held (Exp. Share): al equipar acá, los otros lo pierden.
                          next && m.heldItem?.itemId === next.itemId
                          ? { ...m, heldItem: null, heldItemName: null }
                          : m,
                    ),
                  )
                }
                onHealed={(id, currentHp, maxHp) =>
                  setMembers((prev) =>
                    prev.map((m) => (m.id === id ? { ...m, currentHp, maxHp } : m)),
                  )
                }
                onLeveledUp={(id, next) =>
                  setMembers((prev) =>
                    prev.map((m) =>
                      m.id === id
                        ? {
                            ...m,
                            level: next.level,
                            currentHp: next.currentHp,
                            maxHp: next.maxHp,
                            levelLabel: next.levelLabel,
                            xpPct: 0,
                          }
                        : m,
                    ),
                  )
                }
                onPpRestored={(id, next) =>
                  setMembers((prev) =>
                    prev.map((m) => {
                      if (m.id !== id) return m;
                      return {
                        ...m,
                        moves: m.moves.map((slot) => {
                          if (!slot) return slot;
                          if (!next.allMoves && slot.name !== next.moveName) return slot;
                          return {
                            ...slot,
                            currentPp: Math.min(slot.maxPp, slot.currentPp + next.restoredBy),
                          };
                        }),
                      };
                    }),
                  )
                }
                onFlagsChange={(id, next) => {
                  if (next.isFavorite === true) {
                    const picked = members.find((m) => m.id === id);
                    onCompanionTypesChange?.(picked?.types ?? []);
                  } else if (next.isFavorite === false) {
                    // Sin favorito: el banner vuelve al líder (slot 1 / primero).
                    onCompanionTypesChange?.(members[0]?.types ?? []);
                  }
                  setMembers((prev) =>
                    prev.map((m) => {
                      if (m.id === id) return { ...m, ...next };
                      // Un solo favorito: al marcar uno se limpia el resto en UI.
                      if (next.isFavorite === true && m.isFavorite) {
                        return { ...m, isFavorite: false };
                      }
                      return m;
                    }),
                  );
                }}
                onPointsAllocated={(id, next) =>
                  setMembers((prev) =>
                    prev.map((m) => {
                      if (m.id !== id) return m;
                      const nextCurrentHp =
                        m.currentHp <= 0
                          ? 0
                          : Math.min(next.maxHp, m.currentHp + next.currentHpDelta);
                      return {
                        ...m,
                        unspentPoints: next.unspentPoints,
                        points: next.points,
                        maxHp: next.maxHp,
                        currentHp: nextCurrentHp,
                        atk: next.atk,
                        def: next.def,
                        spAtk: next.spAtk,
                        spDef: next.spDef,
                        speed: next.speed,
                      };
                    }),
                  )
                }
                onDepositToPc={depositToPc}
                canDepositToPc={canDeposit}
                isDepositing={member !== null && depositingId === member.id}
                isDragging={member !== null && dragId === member.id}
                isOver={overSlot === i && dragId !== null}
                pending={pending || depositingId !== null}
                onDragStart={setDragId}
                onDragEnd={() => {
                  setDragId(null);
                  setOverSlot(null);
                }}
              />
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
