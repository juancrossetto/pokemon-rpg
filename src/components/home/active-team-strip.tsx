"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setTeamLayout } from "@/actions/pc";
import { typeColor } from "@/lib/type-colors";
import {
  SquadCardContextMenu,
  type SquadContextLabels,
} from "@/components/squad-card-context-menu";
import { SquadCardSheet, type SquadCardSheetLabels } from "@/components/squad-card-sheet";
import { PokemonShowcaseCard } from "@/components/pokemon-showcase-card";
import { PokeSparks } from "@/components/poke-sparks";
import { SegmentedStatBar, hpBarVariant } from "@/components/segmented-stat-bar";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { SquadBagCounts } from "@/lib/squad-bag";
import { anyEvolveReady } from "@/lib/evolution-readiness";
import { CoachMark } from "@/components/journey-guidance";

const TEAM_SIZE = 6;
/** Strip (md+): cards fijas que desbordan → scroll. Grid (mobile): llena el alto. */
const SLOT_BOX =
  "h-full min-h-[8.75rem] w-full md:h-[200px] md:min-h-0 md:w-[176px] md:shrink-0 lg:h-[210px] lg:w-[188px]";

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
  isDragging,
  isOver,
  pending,
  onDragStart,
  onDragEnd,
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
  isDragging: boolean;
  isOver: boolean;
  pending: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const tTeam = useTranslations("team");
  const tUx = useTranslations("ux");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
    return (
      <CoachMark
        storageKey="coach-team-slot"
        message={tUx("coachTeamSlot")}
        className="block h-full"
      >
        <Link
          href="/team?tab=pc"
          className={`team-slot team-slot--empty group flex ${SLOT_BOX} flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-white/15 bg-white/[0.02] text-on-surface-variant transition hover:border-white/28 hover:bg-white/[0.04]`}
          aria-label={emptyLabel}
        >
          <div className="mb-1.5 flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.03] transition group-hover:border-white/30">
            <span className="material-symbols-outlined text-[22px]!">add</span>
          </div>
          <span className="px-2 text-center text-[10px] uppercase tracking-wider text-on-surface-variant/75">
            {emptyLabel}
          </span>
        </Link>
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
  const skipClickRef = useRef(false);

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
  };

  return (
    <>
      <SquadCardContextMenu {...menuProps} showViewTeam triggerVariant="ghost">
        <button
          type="button"
          draggable={!pending}
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
            if (skipClickRef.current) return;
            setOpen(true);
          }}
          aria-label={`${displayName}, ${member.levelLabel}`}
          className={`team-card team-slot group relative flex ${SLOT_BOX} flex-col overflow-hidden rounded-[1.25rem] border text-left transition duration-300 active:scale-[0.97] ${
            isOver ? "ring-2 ring-pokeball-red/60 ring-offset-2 ring-offset-background" : ""
          } ${isDragging ? "opacity-40" : "hover:scale-[1.01]"} ${
            isLead || member.isFavorite
              ? "border-pokeball-red/35 shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
              : "border-white/[0.08] hover:border-white/20"
          } ${fainted ? "opacity-80" : ""}`}
          style={{ "--type-accent": accent } as CSSProperties}
        >
        <div className="relative flex min-h-0 flex-[1.4] flex-col items-center justify-end px-2 pb-0 pt-5 md:pt-6">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 90% 70% at 50% 42%, ${accent}66 0%, transparent 72%)`,
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[44%] h-[70%] max-h-32 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.08]"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, transparent 36%, currentColor 37%, currentColor 48%, transparent 49%)",
              color: accent,
            }}
            aria-hidden
          />

          <PokeSparks seed={member.id} accent={accent} />

          <div className="absolute left-2 top-1.5 z-[2] flex max-w-[calc(100%-0.75rem)] flex-wrap items-center gap-0.5">
            {isLead ? (
              <span className="flex items-center text-violet-300" title={leadLabel}>
                <span className="material-symbols-outlined text-[15px]! leading-none">
                  military_tech
                </span>
              </span>
            ) : null}
            {member.isFavorite && (
              <span
                className="flex items-center text-electric-yellow"
                title={member.labels.favorite}
              >
                <span className="material-symbols-outlined text-[14px]! leading-none">star</span>
              </span>
            )}
            {member.isTradeLocked && (
              <span
                className="flex items-center text-white/50"
                title={member.labels.tradeLocked}
              >
                <span className="material-symbols-outlined text-[13px]! leading-none">lock</span>
              </span>
            )}
            <span className="rounded-full border border-white/15 bg-black/45 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-white backdrop-blur-sm">
              {member.levelLabel}
            </span>
            {canEvolve && (
              <span
                className="inline-flex items-center rounded-full border border-tertiary/40 bg-tertiary/20 px-1 py-0.5 text-tertiary backdrop-blur-sm"
                title={member.labels.canEvolveBadge}
              >
                <span className="material-symbols-outlined text-[11px]! leading-none">
                  auto_awesome
                </span>
              </span>
            )}
          </div>

          <div className="relative z-[1] flex h-full min-h-[4.25rem] w-full max-h-[7.75rem] items-end justify-center md:h-[90px] md:max-h-none md:min-h-0">
            <div
              className="absolute bottom-0 h-6 w-14 rounded-[100%] opacity-55 blur-md transition group-hover:opacity-75"
              style={{ background: accent }}
            />
            {member.spriteUrl ? (
              <Image
                src={member.spriteUrl}
                alt=""
                width={120}
                height={120}
                className={`team-slot__sprite relative z-[1] h-[90%] w-auto max-h-[118px] max-w-[118px] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.65)] transition duration-300 group-hover:-translate-y-1 group-hover:scale-110 md:h-[90px] md:w-[90px] md:max-h-none md:max-w-none ${
                  fainted ? "grayscale" : ""
                }`}
              />
            ) : (
              <span className="material-symbols-outlined relative z-[1] text-[40px]! text-white/25">
                sports_baseball
              </span>
            )}
          </div>
        </div>

        <div className="relative z-[1] flex shrink-0 flex-col bg-gradient-to-b from-transparent to-black/35 px-2 pb-2 pt-0.5">
          <p className="truncate text-center text-[13px] font-bold capitalize tracking-tight text-white md:text-[13px]">
            {displayName}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-0.5">
            {member.types.slice(0, 2).map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded-full border border-white/10 bg-black/40 px-1.5 py-px text-[7px] font-bold uppercase tracking-wide"
                  style={{ color }}
                >
                  {type}
                </span>
              );
            })}
            {fainted && (
              <span className="rounded-full bg-error/20 px-1.5 py-px text-[7px] font-bold uppercase text-error">
                {member.labels.fainted}
              </span>
            )}
          </div>

          <div className="mt-1.5 space-y-1">
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
      </button>
      </SquadCardContextMenu>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-center pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] sm:items-center sm:p-4 sm:pb-4 xl:pb-4">
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
              className="team-detail-sheet relative z-[1] flex max-h-[min(88dvh,calc(100dvh-var(--bottom-nav-h)-env(safe-area-inset-bottom)-1rem))] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#0b0d13] shadow-[0_-12px_48px_rgba(0,0,0,0.55)] sm:rounded-[1.5rem] sm:shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
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
                    spriteClassName="team-detail-sheet__sprite"
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
  manageLabel,
  title,
  initialBagCounts,
}: {
  locale: string;
  initialMembers: HomeSquadMember[];
  emptySlotLabel: string;
  leadLabel: string;
  slotLabels: string[];
  manageLabel: string;
  title: string;
  initialBagCounts: SquadBagCounts;
}) {
  const t = useTranslations("pc");
  const tHome = useTranslations("home");
  const [members, setMembers] = useState(initialMembers);
  const [bagCounts, setBagCounts] = useState(initialBagCounts);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | null>(null);
  const holdInterval = useRef<number | null>(null);

  useEffect(() => {
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
  }, [initialMembers]);

  useEffect(() => {
    setBagCounts(initialBagCounts);
  }, [initialBagCounts]);

  function updateScrollHints() {
    const rail = railRef.current;
    if (!rail) return;
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    setCanPrev(rail.scrollLeft > 2);
    setCanNext(rail.scrollLeft < max - 2);
  }

  function scrollRail(dir: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>("[data-team-rail-item]");
    const step = card ? card.offsetWidth + 10 : Math.round(rail.clientWidth * 0.72);
    rail.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  function stopHold() {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (holdInterval.current != null) {
      window.clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }

  function startHold(dir: -1 | 1) {
    stopHold();
    scrollRail(dir);
    holdTimer.current = window.setTimeout(() => {
      holdInterval.current = window.setInterval(() => scrollRail(dir), 220);
    }, 320);
  }

  useEffect(() => {
    const railEl = railRef.current;
    if (!railEl) return;

    updateScrollHints();
    railEl.addEventListener("scroll", updateScrollHints, { passive: true });
    const ro = new ResizeObserver(updateScrollHints);
    ro.observe(railEl);

    function onWheel(e: WheelEvent) {
      const target = railRef.current;
      if (!target) return;
      if (window.matchMedia("(max-width: 767px)").matches) return;
      if (target.scrollWidth <= target.clientWidth) return;
      // Trackpad horizontal nativo; rueda vertical → lateral.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      target.scrollLeft += e.deltaY;
      updateScrollHints();
    }
    railEl.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      railEl.removeEventListener("scroll", updateScrollHints);
      railEl.removeEventListener("wheel", onWheel);
      ro.disconnect();
      stopHold();
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(updateScrollHints);
    return () => cancelAnimationFrame(id);
  }, [members, pending]);

  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => members[i] ?? null);

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

  const showRailNav = canPrev || canNext;

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-1 flex-col md:flex-none ${pending ? "opacity-90" : ""}`}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 md:mb-2.5">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-white">
          <Image
            src="/nav/joystick-icon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
            aria-hidden
          />
          {title}
        </h2>
        <Link
          href="/team"
          className="inline-flex min-h-11 items-center gap-0.5 text-[13px] text-on-surface-variant transition hover:text-white"
        >
          {manageLabel}
          <span className="material-symbols-outlined text-[16px]!">chevron_right</span>
        </Link>
      </div>

      {error ? (
        <div className="mb-2 shrink-0 rounded-lg border border-error/40 bg-error-container/30 px-3 py-1.5 text-[12px] text-error">
          {t(`errors.${error}`)}
        </div>
      ) : null}

      {/* Mobile: grilla 2×3. md+: riel con flechas (sin scrollbar; DnD intacto). */}
      <div className="relative min-h-0 min-w-0 flex-1 md:flex-none">
        <div
          ref={railRef}
          className="grid min-h-0 min-w-0 flex-1 auto-rows-fr grid-cols-2 gap-2 md:flex md:gap-2.5 md:overflow-x-auto md:overscroll-x-contain md:scroll-smooth md:px-1 md:pb-1 md:pt-0.5 md:snap-x md:snap-mandatory md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden"
        >
          {slots.map((member, i) => (
            <div
              key={member?.id ?? `empty-${i}`}
              data-team-rail-item
              className="min-h-0 min-w-0 md:w-[176px] md:shrink-0 md:snap-start lg:w-[188px]"
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
                isDragging={member !== null && dragId === member.id}
                isOver={overSlot === i && dragId !== null}
                pending={pending}
                onDragStart={setDragId}
                onDragEnd={() => {
                  setDragId(null);
                  setOverSlot(null);
                }}
              />
            </div>
          ))}
        </div>

        {showRailNav ? (
          <>
            <div
              className={`pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-14 bg-gradient-to-r from-background via-background/80 to-transparent transition-opacity md:block ${
                canPrev ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden
            />
            <div
              className={`pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-14 bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity md:block ${
                canNext ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden
            />

            <button
              type="button"
              tabIndex={canPrev ? 0 : -1}
              disabled={!canPrev}
              aria-label={tHome("scrollTeamPrev")}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!canPrev) return;
                startHold(-1);
              }}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              className={`absolute top-1/2 left-0 z-[2] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-white/30 hover:bg-black/80 active:scale-95 md:grid ${
                canPrev ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]!">chevron_left</span>
            </button>
            <button
              type="button"
              tabIndex={canNext ? 0 : -1}
              disabled={!canNext}
              aria-label={tHome("scrollTeamNext")}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!canNext) return;
                startHold(1);
              }}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              className={`absolute top-1/2 right-0 z-[2] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-white/30 hover:bg-black/80 active:scale-95 md:grid ${
                canNext ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]!">chevron_right</span>
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
