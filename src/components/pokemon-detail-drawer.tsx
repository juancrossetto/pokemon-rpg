"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { teachMove } from "@/actions/teach-move";
import { equipHeldItem, unequipHeldItem } from "@/actions/equip-held-item";
import type { TeamMember, TeamRosterLabels } from "@/components/team-roster";
import { SegmentedStatBar, hpBarVariant } from "@/components/segmented-stat-bar";
import { EvolutionChainList } from "@/components/evolution-chain-list";
import { SquadCareActions } from "@/components/squad-care-actions";
import { AllocatePointsPanel } from "@/components/allocate-points-panel";
import { EMPTY_SQUAD_BAG, type SquadBagCounts } from "@/lib/squad-bag";
import { UNSPENT_POINTS_PER_LEVEL } from "@/lib/stats";

type DetailTab = "overview" | "moves" | "item";

const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/**
 * Ficha de detalle del Pokémon.
 * Desktop: panel desde la derecha. Mobile: bottom sheet.
 * Tabs para que la info principal entre sin scrollear tanto.
 */
export function PokemonDetailDrawer({
  member,
  labels,
  bagCounts = EMPTY_SQUAD_BAG,
  onMemberPatch,
  onClose,
}: {
  member: TeamMember | null;
  labels: TeamRosterLabels;
  bagCounts?: SquadBagCounts;
  onMemberPatch?: (
    patch: Partial<
      Pick<
        TeamMember,
        | "level"
        | "levelLabel"
        | "currentHp"
        | "maxHp"
        | "isFavorite"
        | "isTradeLocked"
        | "unspentPoints"
      >
    >,
  ) => void;
  onClose: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<DetailTab>("overview");
  const [teachingItemId, setTeachingItemId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [equipOpen, setEquipOpen] = useState(false);
  const [equipPending, startEquipTransition] = useTransition();
  const [equipError, setEquipError] = useState<string | null>(null);
  // Estado optimista de los consumibles: el componente se remonta al cambiar de
  // Pokémon (key en TeamRoster), así que no hace falta sincronizarlo con props.
  const [bag, setBag] = useState(bagCounts);
  const [vitals, setVitals] = useState<{ currentHp: number; maxHp: number; level: number } | null>(
    null,
  );
  const [ppBySlot, setPpBySlot] = useState<Record<number, number>>({});
  const [flags, setFlags] = useState<{ isFavorite: boolean; isTradeLocked: boolean } | null>(null);
  const dirtyRef = useRef(false);

  const handleClose = useCallback(() => {
    // Cerrar al instante; el refresh del server va en background (DB remota
    // tarda varios segundos y no debe bloquear la UI).
    onClose();
    if (dirtyRef.current) {
      startTransition(() => {
        router.refresh();
      });
    }
  }, [onClose, router, startTransition]);

  useEffect(() => {
    if (!member) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [member, handleClose]);

  if (!member) return null;

  const displayName = member.nickname ?? member.speciesName;
  const primaryType = member.types[0] ?? "normal";
  const accent = typeColor(primaryType);
  const currentHp = vitals?.currentHp ?? member.currentHp;
  const maxHp = vitals?.maxHp ?? member.maxHp;
  const level = vitals?.level ?? member.level;
  const levelLabel =
    vitals != null ? labels.levelTemplate.replace("{level}", String(level)) : member.levelLabel;
  const isFavorite = flags?.isFavorite ?? member.isFavorite;
  const isTradeLocked = flags?.isTradeLocked ?? member.isTradeLocked;
  const moves = member.moves.map((move) =>
    move && ppBySlot[move.slot] != null ? { ...move, currentPp: ppBySlot[move.slot] } : move,
  );
  const fainted = currentHp <= 0;
  const teachingItem = member.compatibleTms.find((tm) => tm.itemId === teachingItemId) ?? null;
  const statMax = Math.max(member.atk, member.def, member.spAtk, member.spDef, member.speed, 180);
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "overview", label: labels.tabStats },
    { id: "moves", label: labels.movesTitle },
    { id: "item", label: labels.tabItems },
  ];

  function pickSlot(slot: number) {
    if (!teachingItem || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await teachMove(member!.instanceId, teachingItem.itemId, slot, locale);
      if (!result.ok) {
        setError(labels.teachErrors[result.error] ?? result.error);
        return;
      }
      setTeachingItemId(null);
    });
  }

  function equip(itemId: string) {
    if (equipPending) return;
    setEquipError(null);
    startEquipTransition(async () => {
      const result = await equipHeldItem(member!.instanceId, itemId, locale);
      if (!result.ok) {
        setEquipError(labels.equipErrors[result.error] ?? result.error);
        return;
      }
      setEquipOpen(false);
    });
  }

  function unequip() {
    if (equipPending) return;
    setEquipError(null);
    startEquipTransition(async () => {
      const result = await unequipHeldItem(member!.instanceId, locale);
      if (!result.ok) {
        setEquipError(labels.equipErrors[result.error] ?? result.error);
      }
    });
  }

  // Sale del stacking context del layout (`relative z-10`) para quedar sobre el header.
  const overlay = (
    <div
      className={`fixed inset-0 z-[100] flex ${
        isDesktop ? "items-stretch justify-end" : "items-end justify-center"
      }`}
    >
      <button
        type="button"
        aria-label={labels.close}
        onClick={handleClose}
        className="team-drawer-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div
        className={`relative flex w-full flex-col overflow-hidden border-white/10 bg-surface-container shadow-2xl ${
          isDesktop
            ? "team-drawer-panel h-full max-w-md border-l"
            : "team-drawer-sheet max-h-[92dvh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]"
        }`}
      >
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: accent }}
        />

        {!isDesktop && (
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/15" />
        )}

        <header className="relative shrink-0 border-b border-white/[0.06] px-4 pb-3 pt-3 pr-12">
          <div className="flex items-center gap-3 text-left">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <div
                className="absolute bottom-0 h-6 w-12 rounded-[100%] opacity-45 blur-md"
                style={{ background: accent }}
              />
              {member.spriteUrl ? (
                <Image
                  src={member.spriteUrl}
                  alt={member.speciesName}
                  width={64}
                  height={64}
                  className={`relative z-[1] h-16 w-16 object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] ${
                    fainted ? "grayscale" : ""
                  }`}
                />
              ) : (
                <span className="material-symbols-outlined relative z-[1] text-[32px]! text-on-surface-variant/40">
                  sports_baseball
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold leading-none tracking-tight text-white capitalize">
                {displayName}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {levelLabel}
                </span>
                {member.types.map((type) => {
                  const color = typeColor(type);
                  return (
                    <span
                      key={type}
                      className="rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ boxShadow: `inset 0 0 0 1px ${color}55`, color }}
                    >
                      {type}
                    </span>
                  );
                })}
                {fainted && (
                  <span className="rounded-full bg-error/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-error">
                    {labels.fainted}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label={labels.close}
            onClick={handleClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-on-surface-variant transition hover:border-white/25 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]!">close</span>
          </button>
        </header>

        <div
          className="relative flex shrink-0 gap-0.5 border-b border-white/10 px-2"
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
                onClick={() => setTab(t.id)}
                className={`relative flex-1 truncate px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide transition ${
                  active ? "text-white" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-pokeball-red" />
                )}
              </button>
            );
          })}
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {tab === "overview" && (
            <div className="space-y-4">
              <section>
                <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {labels.statsTitle}
                </h3>
                <div className="space-y-2">
                  <DrawerStatRow
                    label={labels.hp}
                    value={`${currentHp}/${maxHp}`}
                    pct={hpPct}
                    variant={hpBarVariant(hpPct)}
                    segments={16}
                  />
                  <DrawerStatRow
                    label={labels.atk}
                    value={member.atk}
                    pct={(member.atk / statMax) * 100}
                    variant="stat"
                  />
                  <DrawerStatRow
                    label={labels.def}
                    value={member.def}
                    pct={(member.def / statMax) * 100}
                    variant="stat"
                  />
                  <DrawerStatRow
                    label={labels.spAtk}
                    value={member.spAtk}
                    pct={(member.spAtk / statMax) * 100}
                    variant="stat"
                  />
                  <DrawerStatRow
                    label={labels.spDef}
                    value={member.spDef}
                    pct={(member.spDef / statMax) * 100}
                    variant="stat"
                  />
                  <DrawerStatRow
                    label={labels.speed}
                    value={member.speed}
                    pct={(member.speed / statMax) * 100}
                    variant="stat"
                  />
                </div>
              </section>

              {member.evolutionChain.length > 1 && (
                <section>
                  <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {labels.evolutionsTitle}
                  </h3>
                  <EvolutionChainList
                    stages={member.evolutionChain}
                    unknownLabel={labels.unknownSpecies}
                    evolveAtLevelLabel={labels.evolveAtLevel}
                  />
                </section>
              )}
            </div>
          )}

          {tab === "moves" && (
            <div className="space-y-4">
              <section>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {labels.movesTitle}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {moves.map((move, i) =>
                    move ? (
                      <div
                        key={move.slot}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: typeColor(move.type),
                            boxShadow: `0 0 6px ${typeColor(move.type)}88`,
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium capitalize text-on-surface">
                          {move.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-on-surface-variant">
                          {labels.power}: {move.power ?? labels.noPower}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
                          {labels.pp} {move.currentPp}/{move.maxPp}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={`empty-move-${i}`}
                        className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-center text-[11px] text-on-surface-variant/60"
                      >
                        {labels.emptySlotMove}
                      </div>
                    ),
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {labels.tmSectionTitle}
                </h3>
                <p className="mb-2 text-[10px] text-on-surface-variant/70">{labels.tmSectionHint}</p>

                {member.compatibleTms.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-on-surface-variant/60">
                    {labels.tmNone}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {member.compatibleTms.map((tm) => {
                      const color = typeColor(tm.moveType);
                      const isOpen = teachingItemId === tm.itemId;
                      return (
                        <div
                          key={tm.itemId}
                          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium capitalize text-on-surface">
                                {tm.moveName}
                              </p>
                              <p className="truncate text-[9px] text-on-surface-variant">
                                {tm.code} · {labels.power}: {tm.movePower ?? labels.noPower} · x
                                {tm.quantity}
                              </p>
                            </div>
                            {tm.alreadyKnown ? (
                              <span className="shrink-0 text-[10px] font-semibold text-on-surface-variant/60">
                                {labels.alreadyKnown}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => {
                                  setError(null);
                                  setTeachingItemId(isOpen ? null : tm.itemId);
                                }}
                                className="shrink-0 rounded-full bg-tertiary px-3 py-1 text-[10px] font-bold text-surface transition hover:brightness-110 disabled:opacity-40"
                              >
                                {isOpen ? labels.cancel : labels.teach}
                              </button>
                            )}
                          </div>

                          {isOpen && (
                            <div className="mt-2 border-t border-white/[0.06] pt-2">
                              <p className="mb-1.5 text-[10px] text-on-surface-variant">
                                {labels.pickSlot}
                              </p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {member.moves.map((move, i) => (
                                  <button
                                    key={`slot-${i}`}
                                    type="button"
                                    disabled={pending}
                                    onClick={() => pickSlot(i + 1)}
                                    className="truncate rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-left text-[11px] capitalize text-on-surface transition hover:border-tertiary/50 disabled:opacity-40"
                                  >
                                    {pending
                                      ? labels.teaching
                                      : move
                                        ? move.name
                                        : labels.emptySlotMove}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {error && <p className="mt-2 text-[11px] text-error">{error}</p>}
              </section>
            </div>
          )}

          {tab === "item" && (
            <div className="space-y-4">
              <section>
                <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {labels.careTitle}
                </h3>
                <p className="mb-2.5 text-[10px] text-on-surface-variant/70">{labels.careHint}</p>
                <SquadCareActions
                  instanceId={member.instanceId}
                  pokemonName={displayName}
                  currentHp={currentHp}
                  maxHp={maxHp}
                  level={level}
                  isFavorite={isFavorite}
                  isTradeLocked={isTradeLocked}
                  canHeal={currentHp < maxHp}
                  canLevelUp={level < 100}
                  bagCounts={bag}
                  labels={labels.care}
                  deferServerRefresh
                  onBagChange={(next) => {
                    dirtyRef.current = true;
                    setBag(next);
                  }}
                  onHealed={(next) => {
                    dirtyRef.current = true;
                    setVitals({ ...next, level });
                    onMemberPatch?.({ currentHp: next.currentHp, maxHp: next.maxHp });
                  }}
                  onLeveledUp={(next) => {
                    dirtyRef.current = true;
                    setVitals(next);
                    onMemberPatch?.({
                      level: next.level,
                      levelLabel: labels.levelTemplate.replace("{level}", String(next.level)),
                      currentHp: next.currentHp,
                      maxHp: next.maxHp,
                      unspentPoints: member.unspentPoints + UNSPENT_POINTS_PER_LEVEL,
                    });
                  }}
                  onFlagsChange={(next) => {
                    dirtyRef.current = true;
                    setFlags((prev) => ({
                      isFavorite: next.isFavorite ?? prev?.isFavorite ?? member.isFavorite,
                      isTradeLocked:
                        next.isTradeLocked ?? prev?.isTradeLocked ?? member.isTradeLocked,
                    }));
                    onMemberPatch?.(next);
                  }}
                  onPpRestored={({ moveName, restoredBy, allMoves }) => {
                    dirtyRef.current = true;
                    setPpBySlot((prev) => {
                      const next = { ...prev };
                      for (const move of moves) {
                        if (!move) continue;
                        if (!allMoves && move.name !== moveName) continue;
                        next[move.slot] = Math.min(move.maxPp, move.currentPp + restoredBy);
                      }
                      return next;
                    });
                  }}
                />
              </section>

              {member.unspentPoints > 0 && (
                <section>
                  <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {labels.pointsTitle}
                  </h3>
                  <p className="mb-2.5 text-[10px] text-on-surface-variant/70">{labels.pointsHint}</p>
                  <AllocatePointsPanel
                    instanceId={member.instanceId}
                    level={level}
                    unspentPoints={member.unspentPoints}
                    points={member.points}
                    bases={member.bases}
                  />
                </section>
              )}

              <section>
                <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {labels.heldItemTitle}
                </h3>
                <p className="mb-3 text-[10px] text-on-surface-variant/70">{labels.heldItemHint}</p>

                {member.heldItem ? (
                  <div className="rounded-lg border border-tertiary/25 bg-tertiary/10 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]! text-tertiary">
                        auto_awesome
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-on-surface">
                          {member.heldItem.name}
                        </p>
                        {member.heldItem.effectText && (
                          <p className="mt-0.5 text-[11px] leading-snug text-on-surface-variant">
                            {member.heldItem.effectText}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={equipPending}
                        onClick={unequip}
                        className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-on-surface-variant transition hover:border-white/25 disabled:opacity-40"
                      >
                        {equipPending ? labels.equipping : labels.unequip}
                      </button>
                    </div>
                  </div>
                ) : equipOpen ? (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    {member.ownedHeldItems.length === 0 ? (
                      <p className="py-2 text-center text-[11px] text-on-surface-variant/60">
                        {labels.noHeldItems}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {member.ownedHeldItems.map((item) => (
                          <button
                            key={item.itemId}
                            type="button"
                            disabled={equipPending}
                            onClick={() => equip(item.itemId)}
                            className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-left transition hover:border-tertiary/50 disabled:opacity-40"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-medium text-on-surface">
                                {item.name}
                              </p>
                              {item.effectText && (
                                <p className="truncate text-[9px] text-on-surface-variant">
                                  {item.effectText}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
                              x{item.quantity}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setEquipOpen(false)}
                      className="mt-2 w-full rounded-md border border-white/10 py-1 text-[10px] font-semibold text-on-surface-variant transition hover:border-white/25"
                    >
                      {labels.cancel}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEquipOpen(true)}
                    className="w-full rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-on-surface-variant/60 transition hover:border-white/25 hover:text-on-surface-variant"
                  >
                    {labels.heldItemEmpty}
                  </button>
                )}

                {equipError && <p className="mt-2 text-[11px] text-error">{equipError}</p>}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function DrawerStatRow({
  label,
  value,
  pct,
  variant,
  segments = 14,
}: {
  label: string;
  value: string | number;
  pct: number;
  variant: "xp" | "hp" | "stat" | "danger";
  segments?: number;
}) {
  return (
    <div className="grid grid-cols-[3.2rem_2.8rem_1fr] items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="text-right font-mono text-xs font-semibold tabular-nums text-white">
        {value}
      </span>
      <SegmentedStatBar pct={pct} segments={segments} variant={variant} heightClass="h-3" />
    </div>
  );
}
