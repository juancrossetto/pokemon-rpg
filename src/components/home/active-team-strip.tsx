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
import { PokeSparks } from "@/components/poke-sparks";
import { SegmentedStatBar, hpBarVariant } from "@/components/segmented-stat-bar";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { SquadBagCounts } from "@/lib/squad-bag";
import { anyEvolveReady } from "@/lib/evolution-readiness";
import { CoachMark } from "@/components/journey-guidance";
import { useTypeLabel } from "@/hooks/use-type-label";
import type { HomeSquadFilter } from "@/components/home/home-desktop-rail";

const TEAM_SIZE = 6;
/** Mobile compacto · md+ fila de 6. */
const SLOT_BOX =
  "h-full min-h-[6.75rem] w-full md:h-[230px] md:min-h-0";

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
  onDepositToPc,
  canDepositToPc,
  isDepositing,
  isDragging,
  isOver,
  pending,
  onDragStart,
  onDragEnd,
  showEmptyCoach,
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
}) {
  const tTeam = useTranslations("team");
  const typeLabel = useTypeLabel();
  const tUx = useTranslations("ux");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const skipClickRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
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
    canHeal: member.currentHp < member.maxHp,
    canLevelUp: member.level < 100,
    labels: member.menuLabels,
    bagCounts,
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
    onDepositToPc: () => {
      setOpen(false);
      onDepositToPc(member.id);
    },
    canDepositToPc,
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
          aria-label={`${displayName}, ${member.levelLabel}`}
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
        <div className="relative flex min-h-0 flex-[1.15] flex-col items-center justify-end px-1 pb-0 pt-3.5 md:flex-[1.4] md:px-2 md:pt-6">
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
              <span className="flex items-center text-violet-300" title={leadLabel}>
                <span className="material-symbols-outlined text-[13px]! leading-none md:text-[15px]!">
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
          </div>

          <div className="relative z-[1] flex h-full min-h-[2.75rem] w-full max-h-[4.25rem] items-end justify-center md:h-[90px] md:max-h-none md:min-h-0">
            <div
              className="absolute bottom-0 h-4 w-10 rounded-[100%] opacity-55 blur-md transition group-hover:opacity-75 md:h-6 md:w-14"
              style={{ background: accent }}
            />
            {member.spriteUrl ? (
              <Image
                src={member.spriteUrl}
                alt=""
                width={120}
                height={120}
                className={`relative z-[1] h-[88%] w-auto max-h-[68px] max-w-[68px] object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.65)] transition duration-300 group-hover:scale-105 md:h-[90px] md:w-[90px] md:max-h-none md:max-w-none ${
                  fainted ? "grayscale" : ""
                }`}
              />
            ) : (
              <span className="material-symbols-outlined relative z-[1] text-[28px]! text-white/25 md:text-[40px]!">
                sports_baseball
              </span>
            )}
          </div>
        </div>

        <div className="relative z-[1] flex shrink-0 flex-col bg-gradient-to-b from-transparent to-black/35 px-1.5 pb-1.5 pt-0 md:px-2 md:pb-2 md:pt-0.5">
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

          <div className="mt-1 space-y-1 md:mt-1.5">
            {/* Mobile: barras rectangulares HP + EXP. Desktop: segmentadas. */}
            <div className="space-y-1 md:hidden">
              <div
                className="grid grid-cols-[1.4rem_minmax(0,1fr)] items-center gap-1"
                title={`${member.labels.hp} ${member.currentHp}/${member.maxHp}`}
              >
                <span className="text-[7px] font-bold uppercase tracking-wider text-white/45">
                  {member.labels.hp}
                </span>
                <div className="h-1.5 overflow-hidden rounded-[2px] bg-white/12">
                  <div
                    className={`h-full rounded-[2px] transition-[width] duration-300 ${
                      fainted
                        ? "bg-error"
                        : hpPct <= 25
                          ? "bg-gradient-to-r from-orange-500 to-amber-300"
                          : "bg-gradient-to-r from-emerald-500 to-lime-400"
                    }`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              </div>
              <div
                className="grid grid-cols-[1.4rem_minmax(0,1fr)] items-center gap-1"
                title={`${member.labels.exp} ${Math.round(member.xpPct)}%`}
              >
                <span className="text-[7px] font-bold uppercase tracking-wider text-white/45">
                  {member.labels.exp}
                </span>
                <div className="h-1.5 overflow-hidden rounded-[2px] bg-white/12">
                  <div
                    className="h-full rounded-[2px] bg-gradient-to-r from-orange-500 to-amber-300 transition-[width] duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, member.xpPct))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="hidden space-y-1 md:block">
              <div
                className="grid grid-cols-[1.6rem_minmax(0,1fr)] items-center gap-1"
                title={`${member.currentHp}/${member.maxHp}`}
              >
                <span className="text-[8px] font-bold uppercase tracking-wider text-white/45">
                  {member.labels.hp}
                </span>
                <SegmentedStatBar
                  pct={hpPct}
                  variant={hpBarVariant(hpPct)}
                  segments={10}
                  heightClass="h-2"
                />
              </div>
              <div className="grid grid-cols-[1.6rem_minmax(0,1fr)] items-center gap-1">
                <span className="text-[8px] font-bold uppercase tracking-wider text-white/45">
                  {member.labels.exp}
                </span>
                <SegmentedStatBar
                  pct={member.xpPct}
                  variant="xp"
                  segments={10}
                  heightClass="h-2"
                />
              </div>
            </div>
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
        <div className="mb-2 flex items-end justify-between gap-3 px-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            {title}
          </p>
          {manageHref && manageLabel ? (
            <Link
              href={manageHref}
              className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:text-white/75"
            >
              {manageLabel}
            </Link>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mb-2 shrink-0 rounded-lg border border-error/40 bg-error-container/30 px-3 py-1.5 text-[12px] text-error">
          {t(`errors.${error}`)}
        </div>
      ) : null}

      {/* Mobile 3×2 · md+ los 6 en una fila. */}
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
                showEmptyCoach={i === firstEmptyIndex}
                onBagChange={setBagCounts}
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
