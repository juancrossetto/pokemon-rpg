"use client";

import Image from "next/image";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setTeamLayout } from "@/actions/pc";
import { playPcSfx } from "@/lib/pc-sfx";
import { ShinyMark } from "@/components/shiny-mark";
import { PokeSparks } from "@/components/poke-sparks";
import { SegmentedStatBar, hpBarVariant } from "@/components/segmented-stat-bar";
import { SquadCardContextMenu } from "@/components/squad-card-context-menu";
import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import { typeColor } from "@/lib/type-colors";
import { calculateMaxHp, calculateStat } from "@/lib/stats";
import { squadTypeWallpaper } from "@/lib/squad-type-wallpapers";
import { HOME_TEAM_HEALED_EVENT, announceHomeTeamHealed } from "@/lib/home-heal-fx";
import { HealButton } from "@/components/heal-button";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { HeldItemInfo, HeldItemLabels, OwnedHeldItem } from "@/components/held-item-panel";
import type { SquadBagCounts } from "@/lib/squad-bag";

/** Ventana de doble toque (mobile suele ser más lenta que desktop). */
const DOUBLE_TAP_MS = 340;
/** Duración del slide FLIP al intercambiar. */
const SWAP_FX_MS = 520;

type SquadFlipDelta = { dx: number; dy: number };

function measureSquadCard(id: string): { left: number; top: number } | null {
  const el = document.querySelector<HTMLElement>(
    `[data-squad-id="${CSS.escape(id)}"]`,
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top };
}
/**
 * Poder del Pokémon. Misma fórmula que `pokemonPower` de `@/lib/ranking`,
 * recalculada acá porque el miembro ya viaja con bases, puntos y nivel: pedir
 * el número al server sería un campo más en un payload que ya lo contiene.
 */
function memberPower(m: HomeSquadMember): number {
  const b = m.bases;
  const p = m.points;
  return (
    calculateMaxHp(b.baseHp, m.level, p.ptConstitution) +
    calculateStat(b.baseAttack, p.ptStrength, m.level) +
    calculateStat(b.baseDefense, p.ptDexterity, m.level) +
    calculateStat(b.baseSpAtk, p.ptIntelligence, m.level) +
    calculateStat(b.baseSpDef, p.ptIntelligence, m.level) +
    calculateStat(b.baseSpeed, p.ptSpeed, m.level)
  );
}

/** Familia visual para partículas del fondo (agua flota, planta cae, etc.). */
function typeFamily(type: string): string {
  const t = type.toLowerCase();
  if (t === "water" || t === "ice") return "water";
  if (t === "grass" || t === "bug") return "grass";
  if (t === "fire") return "fire";
  if (t === "fighting") return "fighting";
  if (t === "dragon") return "dragon";
  if (t === "electric" || t === "psychic" || t === "fairy") return t;
  if (t === "poison" || t === "ghost" || t === "dark") return t;
  return "normal";
}

/**
 * Equipo activo en mobile: carrusel horizontal + reorder al estilo PC
 * (doble toque → tiembla; toque en otro → intercambia). Sin drag: el long-press
 * robaba el scroll vertical del home. Un toque ya no abre `/team` (suspendido;
 * se entra por Administrar / ⋮).
 *
 * **Sólo mobile** (`lg:hidden`); en desktop sigue `ActiveTeamStrip`.
 */
export function HomeSquadCards({
  locale,
  initialMembers,
  title,
  manageHref,
  manageLabel,
  leadLabel,
  initialBagCounts,
  ownedHeldItems,
  heldLabels,
  onCompanionTypesChange,
  heal,
}: {
  locale: string;
  initialMembers: HomeSquadMember[];
  title: string;
  manageHref: string;
  manageLabel: string;
  leadLabel: string;
  initialBagCounts: SquadBagCounts;
  ownedHeldItems: OwnedHeldItem[];
  heldLabels: HeldItemLabels;
  onCompanionTypesChange?: (types: string[]) => void;
  /** Centro Pokémon compacto en el header (sólo si hay heridos). */
  heal?: {
    needsHealing: boolean;
    cooldownMsLeft: number;
    rushCost: number;
    coins: number;
    teamMaxLevel: number;
  } | null;
}) {
  const tTeam = useTranslations("team");
  const tPc = useTranslations("pc");

  const [members, setMembers] = useState(initialMembers);
  const [bagCounts, setBagCounts] = useState(initialBagCounts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [swapFx, setSwapFx] = useState<Record<string, SquadFlipDelta>>({});
  const swapFxTimers = useRef<Map<string, number>>(new Map());
  const pendingFlipRef = useRef<{
    ids: string[];
    first: Record<string, { left: number; top: number }>;
  } | null>(null);
  const [depositingId, setDepositingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [healHidden, setHealHidden] = useState(false);
  const healSyncKey = heal
    ? `${heal.needsHealing ? 1 : 0}:${heal.cooldownMsLeft}:${heal.rushCost}:${heal.coins}`
    : "none";
  const [lastHealKey, setLastHealKey] = useState(healSyncKey);
  if (lastHealKey !== healSyncKey) {
    setLastHealKey(healSyncKey);
    setHealHidden(false);
  }
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

  useEffect(() => {
    const timers = swapFxTimers.current;
    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
      timers.clear();
    };
  }, []);

  useLayoutEffect(() => {
    const pending = pendingFlipRef.current;
    if (!pending) return;
    pendingFlipRef.current = null;

    const flips: Record<string, SquadFlipDelta> = {};
    for (const id of pending.ids) {
      const first = pending.first[id];
      const last = measureSquadCard(id);
      if (!first || !last) continue;
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      flips[id] = { dx, dy };
    }
    if (Object.keys(flips).length === 0) return;

    setSwapFx(flips);
    for (const id of Object.keys(flips)) {
      const prev = swapFxTimers.current.get(id);
      if (prev) window.clearTimeout(prev);
      const timer = window.setTimeout(() => {
        setSwapFx((cur) => {
          if (!(id in cur)) return cur;
          const next = { ...cur };
          delete next[id];
          return next;
        });
        swapFxTimers.current.delete(id);
      }, SWAP_FX_MS);
      swapFxTimers.current.set(id, timer);
    }
  }, [members]);

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

  function pickMember(id: string) {
    if (depositingId || pending) return;
    if (selectedId === id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    playPcSfx("select");
  }

  function placeSelection(targetIndex: number) {
    if (!selectedId || depositingId || pending) return;
    const fromIndex = members.findIndex((m) => m.id === selectedId);
    if (fromIndex < 0) {
      setSelectedId(null);
      return;
    }
    if (fromIndex === targetIndex) {
      setSelectedId(null);
      return;
    }
    const a = members[fromIndex];
    const b = members[targetIndex];
    if (!a || !b) {
      setSelectedId(null);
      return;
    }
    const next = members.map((m, i) => {
      if (i === fromIndex) return b;
      if (i === targetIndex) return a;
      return m;
    });

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const first: Record<string, { left: number; top: number }> = {};
      for (const id of [a.id, b.id]) {
        const box = measureSquadCard(id);
        if (box) first[id] = box;
      }
      if (Object.keys(first).length > 0) {
        pendingFlipRef.current = { ids: [a.id, b.id], first };
      }
    }

    setSelectedId(null);
    playPcSfx("reorder");
    commit(next);
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
    setSelectedId(null);
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

  if (members.length === 0) return null;

  const canDeposit = members.length > 1;
  const busy = pending || depositingId !== null;
  const selectionArmed = selectedId !== null;
  const showHeal = Boolean(heal?.needsHealing && !healHidden);

  return (
    <section className={`squad-cards lg:hidden${busy ? " opacity-90" : ""}`}>
      <header className="squad-cards__head">
        <h2 className="squad-cards__title">{title}</h2>
        <div className="squad-cards__actions">
          {showHeal && heal ? (
            <HealButton
              locale={locale}
              needsHealing
              cooldownMsLeft={heal.cooldownMsLeft}
              rushCost={heal.rushCost}
              coins={heal.coins}
              teamMaxLevel={heal.teamMaxLevel}
              iconOnly
              onHealed={() => {
                setHealHidden(true);
                announceHomeTeamHealed();
              }}
              onHealFailed={() => setHealHidden(false)}
            />
          ) : null}
          <Link
            href={manageHref}
            className="squad-cards__manage"
            aria-label={manageLabel}
            title={manageLabel}
          >
            <span className="material-symbols-outlined" aria-hidden>
              tune
            </span>
          </Link>
        </div>
      </header>

      {error ? (
        <div className="mb-2 rounded-lg border border-error/40 bg-error-container/30 px-3 py-1.5 text-[12px] text-error">
          {tPc(`errors.${error}`)}
        </div>
      ) : null}

      <ul data-squad-rail className="squad-cards__rail">
        {members.map((m, index) => {
          const primaryType = m.types[0] ?? "normal";
          const accent = typeColor(primaryType);
          const wallpaper = squadTypeWallpaper(primaryType);
          const power = memberPower(m);
          const hpPct =
            m.maxHp > 0 ? Math.max(0, Math.min(100, (m.currentHp / m.maxHp) * 100)) : 0;
          const fainted = m.currentHp <= 0;
          const displayName = m.nickname ?? m.speciesName;
          const isSelected = selectedId === m.id;
          const isArmedTarget = selectionArmed && !isSelected;
          const isDepositing = depositingId === m.id;
          const flip = swapFx[m.id] ?? null;
          const isSwapping = flip !== null;

          const menuProps = {
            instanceId: m.id,
            pokemonName: displayName,
            currentHp: m.currentHp,
            maxHp: m.maxHp,
            level: m.level,
            isFavorite: m.isFavorite,
            isTradeLocked: m.isTradeLocked,
            canHeal: m.currentHp > 0 && m.currentHp < m.maxHp,
            canRevive: m.currentHp <= 0,
            canLevelUp: m.level < 100,
            labels: m.menuLabels,
            bagCounts,
            allocatePoints: m.points,
            allocateUnspent: m.unspentPoints,
            allocateBases: m.bases,
            onBagChange: setBagCounts,
            onHealed: ({ currentHp, maxHp }: { currentHp: number; maxHp: number }) =>
              setMembers((prev) =>
                prev.map((x) => (x.id === m.id ? { ...x, currentHp, maxHp } : x)),
              ),
            onPpRestored: (next: {
              moveName: string;
              restoredBy: number;
              allMoves: boolean;
            }) =>
              setMembers((prev) =>
                prev.map((x) => {
                  if (x.id !== m.id) return x;
                  return {
                    ...x,
                    moves: x.moves.map((slot) => {
                      if (!slot) return slot;
                      if (!next.allMoves && slot.name !== next.moveName) return slot;
                      return {
                        ...slot,
                        currentPp: Math.min(slot.maxPp, slot.currentPp + next.restoredBy),
                      };
                    }),
                  };
                }),
              ),
            onLeveledUp: (next: { level: number; currentHp: number; maxHp: number }) =>
              setMembers((prev) =>
                prev.map((x) =>
                  x.id === m.id
                    ? {
                        ...x,
                        level: next.level,
                        currentHp: next.currentHp,
                        maxHp: next.maxHp,
                        levelLabel: tTeam("level", { level: next.level }),
                        xpPct: 0,
                      }
                    : x,
                ),
              ),
            onFlagsChange: (next: { isFavorite?: boolean; isTradeLocked?: boolean }) => {
              if (next.isFavorite === true) {
                onCompanionTypesChange?.(m.types);
              } else if (next.isFavorite === false) {
                onCompanionTypesChange?.(members[0]?.types ?? []);
              }
              setMembers((prev) =>
                prev.map((x) => {
                  if (x.id === m.id) return { ...x, ...next };
                  if (next.isFavorite === true && x.isFavorite) {
                    return { ...x, isFavorite: false };
                  }
                  return x;
                }),
              );
            },
            onPointsAllocated: (next: {
              unspentPoints: number;
              points: HomeSquadMember["points"];
              maxHp: number;
              currentHpDelta: number;
              atk: number;
              def: number;
              spAtk: number;
              spDef: number;
              speed: number;
            }) =>
              setMembers((prev) =>
                prev.map((x) => {
                  if (x.id !== m.id) return x;
                  const nextCurrentHp =
                    x.currentHp <= 0
                      ? 0
                      : Math.min(next.maxHp, x.currentHp + next.currentHpDelta);
                  return {
                    ...x,
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
              ),
            onDepositToPc: () => depositToPc(m.id),
            canDepositToPc: canDeposit,
            heldItem: m.heldItem,
            ownedHeldItems,
            heldLabels,
            onHeldChange: (next: HeldItemInfo | null) =>
              setMembers((prev) =>
                prev.map((x) =>
                  x.id === m.id
                    ? {
                        ...x,
                        heldItem: next,
                        heldItemName: next?.displayName ?? null,
                      }
                    : next && x.heldItem?.itemId === next.itemId
                      ? { ...x, heldItem: null, heldItemName: null }
                      : x,
                ),
              ),
          };

          return (
            <li key={m.id} className="squad-cards__item" data-squad-id={m.id}>
              <SquadCardContextMenu
                {...menuProps}
                showViewTeam
                triggerVariant="ghost"
                triggerPosition="right-0.5 top-0.5"
                className="squad-cards__menu-host"
              >
                <SquadCardButton
                  member={m}
                  index={index}
                  leadLabel={leadLabel}
                  displayName={displayName}
                  accent={accent}
                  wallpaper={wallpaper}
                  primaryType={primaryType}
                  power={power}
                  hpPct={hpPct}
                  fainted={fainted}
                  pending={busy}
                  isSelected={isSelected}
                  isArmedTarget={isArmedTarget}
                  isDepositing={isDepositing}
                  isSwapping={isSwapping}
                  flip={flip}
                  onPick={() => pickMember(m.id)}
                  onPlace={() => placeSelection(index)}
                  selectionArmed={selectionArmed}
                />
              </SquadCardContextMenu>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SquadCardButton({
  member: m,
  index,
  leadLabel,
  displayName,
  accent,
  wallpaper,
  primaryType,
  power,
  hpPct,
  fainted,
  pending,
  isSelected,
  isArmedTarget,
  isDepositing,
  isSwapping,
  flip,
  selectionArmed,
  onPick,
  onPlace,
}: {
  member: HomeSquadMember;
  index: number;
  leadLabel: string;
  displayName: string;
  accent: string;
  wallpaper: string | null;
  primaryType: string;
  power: number;
  hpPct: number;
  fainted: boolean;
  pending: boolean;
  isSelected: boolean;
  isArmedTarget: boolean;
  isDepositing: boolean;
  isSwapping: boolean;
  flip: SquadFlipDelta | null;
  selectionArmed: boolean;
  onPick: () => void;
  onPlace: () => void;
}) {
  const lastTapAtRef = useRef(0);
  const singleTapTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current != null) {
        window.clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  function clearSingleTapTimer() {
    if (singleTapTimerRef.current != null) {
      window.clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  }

  function armSingleTap(action: () => void) {
    clearSingleTapTimer();
    singleTapTimerRef.current = window.setTimeout(() => {
      singleTapTimerRef.current = null;
      lastTapAtRef.current = 0;
      action();
    }, DOUBLE_TAP_MS);
  }

  function handlePick() {
    clearSingleTapTimer();
    lastTapAtRef.current = 0;
    onPick();
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (isDepositing || pending) return;
        const now = performance.now();
        // Segundo toque dentro de la ventana → seleccionar (no ir a /team).
        if (now - lastTapAtRef.current < DOUBLE_TAP_MS) {
          handlePick();
          return;
        }
        lastTapAtRef.current = now;
        if (!selectionArmed) {
          // Mobile: un toque no abre /team (suspendido). Sólo doble toque arma.
          return;
        }
        armSingleTap(() => {
          if (isSelected) onPick();
          else onPlace();
        });
      }}
      aria-label={`${displayName}, ${m.levelLabel}`}
      aria-pressed={isSelected || undefined}
      className={`squad-card${fainted ? " squad-card--fainted" : ""}${
        wallpaper ? " squad-card--wallpaper" : ""
      }${isSelected ? " squad-card--selected" : ""}${
        isArmedTarget ? " squad-card--armed" : ""
      }${isDepositing ? " squad-card--depositing" : ""}${
        isSwapping ? " squad-card--swap" : ""
      }`}
      data-type-family={typeFamily(primaryType)}
      style={
        {
          "--card-accent": accent,
          ...(wallpaper ? { "--card-wallpaper": `url(${wallpaper})` } : null),
          ...(flip
            ? {
                "--flip-x": `${flip.dx}px`,
                "--flip-y": `${flip.dy}px`,
              }
            : null),
        } as CSSProperties
      }
    >
      {wallpaper ? null : (
        <span className="squad-card__fx" aria-hidden>
          <span className="squad-card__fx-dot" />
          <span className="squad-card__fx-dot" />
          <span className="squad-card__fx-dot" />
          <span className="squad-card__fx-dot" />
          <span className="squad-card__fx-dot" />
          <span className="squad-card__fx-dot" />
        </span>
      )}

      <span className="squad-card__badges">
        <span className="squad-card__badge squad-card__badge--level">
          {m.levelLabel}
        </span>
        {index === 0 ? (
          <span
            className="squad-card__lead"
            title={leadLabel}
            aria-label={leadLabel}
          >
            <span className="material-symbols-outlined ms-fill" aria-hidden>
              military_tech
            </span>
          </span>
        ) : null}
      </span>

      <span className="squad-card__art">
        <span className="squad-card__pool" aria-hidden />
        {m.isShiny ? (
          <PokeSparks seed={m.id} accent="#FFE566" density="dense" />
        ) : null}
        <span className="squad-card__shadow" aria-hidden />
        <Image
          src={m.spriteUrl}
          alt=""
          width={140}
          height={140}
          draggable={false}
          className="squad-card__sprite"
          unoptimized
        />
      </span>

      <span className="squad-card__bars">
        <span className="squad-card__hp">
          <SegmentedStatBar
            pct={hpPct}
            variant={hpBarVariant(hpPct)}
            segments={8}
            heightClass="h-1.5"
          />
        </span>
        <span className="squad-card__exp">
          <SegmentedStatBar
            pct={m.xpPct}
            variant="xp"
            segments={8}
            heightClass="h-1"
          />
        </span>
      </span>

      <span className="squad-card__foot">
        <span className="squad-card__name">{displayName}</span>
        <span className="squad-card__meta">
          <span
            className="squad-card__type-chip"
            style={{ "--type-chip": accent } as CSSProperties}
            title={primaryType}
          >
            <Image
              src={showdownTypeSymbolUrl(primaryType)}
              alt=""
              width={11}
              height={11}
              className="squad-card__type"
              unoptimized
            />
          </span>
          <span className="squad-card__cp">{power.toLocaleString()}</span>
          {m.isShiny ? <ShinyMark className="squad-card__flag" title="" /> : null}
          {m.isFavorite ? (
            <span className="squad-card__flag squad-card__flag--fav" aria-hidden>
              <span className="material-symbols-outlined ms-fill">star</span>
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
