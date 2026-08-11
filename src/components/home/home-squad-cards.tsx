"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
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
import { HOME_TEAM_HEALED_EVENT } from "@/lib/home-heal-fx";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { HeldItemInfo, HeldItemLabels, OwnedHeldItem } from "@/components/held-item-panel";
import type { SquadBagCounts } from "@/lib/squad-bag";
import { useSquadReorderGesture } from "@/components/home/use-squad-reorder-gesture";
import { SquadReorderGhost } from "@/components/home/squad-reorder-ghost";

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
 * Equipo activo en mobile: carrusel de cards con el color del tipo y el PC
 * de cada Pokémon. **Sólo mobile** (`lg:hidden`); en desktop sigue
 * `ActiveTeamStrip`.
 *
 * Long-press (touch) / arrastre (mouse) reordena; el ⋮ abre el menú de
 * acciones; tap corto lleva a la ficha en `/team`.
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
}) {
  const t = useTranslations("home.hub.identity");
  const tTeam = useTranslations("team");
  const tPc = useTranslations("pc");
  const router = useRouter();

  const [members, setMembers] = useState(initialMembers);
  const [bagCounts, setBagCounts] = useState(initialBagCounts);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
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

  function beginDrag(id: string) {
    dragIdRef.current = id;
    setDragId(id);
  }

  function endDrag() {
    dragIdRef.current = null;
    setDragId(null);
    setOverSlot(null);
    setDragPoint(null);
  }

  function dropOnSlot(index: number) {
    const id = dragIdRef.current ?? dragId;
    if (!id) return;
    const mon = members.find((m) => m.id === id);
    if (!mon) return;
    const rest = members.filter((m) => m.id !== mon.id);
    const at = Math.min(Math.max(0, index), rest.length);
    const next = [...rest.slice(0, at), mon, ...rest.slice(at)];
    if (
      next.length === members.length &&
      next.every((m, i) => m.id === members[i]?.id)
    ) {
      return;
    }
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

  const totalPower = members.reduce((sum, m) => sum + memberPower(m), 0);
  const canDeposit = members.length > 1;
  const busy = pending || depositingId !== null;
  const draggingMember = dragId ? members.find((m) => m.id === dragId) ?? null : null;

  return (
    <section className={`squad-cards lg:hidden${busy ? " opacity-90" : ""}`}>
      <header className="squad-cards__head">
        <h2 className="squad-cards__title">{title}</h2>
        <span className="squad-cards__power">
          <span className="squad-cards__power-key">{t("combatPower")}</span>
          <span className="squad-cards__power-val">{totalPower.toLocaleString()}</span>
        </span>
        <Link href={manageHref} className="squad-cards__manage">
          {manageLabel}
        </Link>
      </header>

      {error ? (
        <div className="mb-2 rounded-lg border border-error/40 bg-error-container/30 px-3 py-1.5 text-[12px] text-error">
          {tPc(`errors.${error}`)}
        </div>
      ) : null}

      {draggingMember && dragPoint ? (
        <SquadReorderGhost
          x={dragPoint.x}
          y={dragPoint.y}
          spriteUrl={draggingMember.spriteUrl}
          name={draggingMember.nickname ?? draggingMember.speciesName}
          accent={typeColor(draggingMember.types[0] ?? "normal")}
        />
      ) : null}

      <ul
        data-squad-rail
        className={`squad-cards__rail${dragId ? " squad-cards__rail--reordering" : ""}`}
      >
        {members.map((m, index) => {
          const primaryType = m.types[0] ?? "normal";
          const accent = typeColor(primaryType);
          const wallpaper = squadTypeWallpaper(primaryType);
          const power = memberPower(m);
          const hpPct =
            m.maxHp > 0 ? Math.max(0, Math.min(100, (m.currentHp / m.maxHp) * 100)) : 0;
          const fainted = m.currentHp <= 0;
          const displayName = m.nickname ?? m.speciesName;
          const isDragging = dragId === m.id;
          const isOver = overSlot === index && dragId !== null && dragId !== m.id;
          const isDepositing = depositingId === m.id;

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
            <li
              key={m.id}
              data-squad-slot={index}
              className={`squad-cards__item${isDragging ? " squad-cards__item--dragging" : ""}`}
            >
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
                  isDragging={isDragging}
                  isOver={isOver}
                  isDepositing={isDepositing}
                  onOpen={() => router.push(`/team?focus=${m.id}`)}
                  onDragStart={() => beginDrag(m.id)}
                  onDragEnd={endDrag}
                  onDragHover={setOverSlot}
                  onDragMove={(x, y) => setDragPoint({ x, y })}
                  onDragDrop={(slot) => {
                    dropOnSlot(slot);
                  }}
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
  isDragging,
  isOver,
  isDepositing,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragHover,
  onDragMove,
  onDragDrop,
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
  isDragging: boolean;
  isOver: boolean;
  isDepositing: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragHover: (slotIndex: number | null) => void;
  onDragMove: (clientX: number, clientY: number) => void;
  onDragDrop: (slotIndex: number) => void;
}) {
  const gesture = useSquadReorderGesture({
    disabled: pending || isDepositing,
    memberId: m.id,
    slotAttr: "data-squad-slot",
    onDragStart: () => onDragStart(),
    onDragHover,
    onDragMove,
    onDragDrop,
    onDragEnd,
  });

  return (
    <button
      type="button"
      onPointerDown={gesture.onPointerDown}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      onPointerCancel={gesture.onPointerCancel}
      onContextMenu={gesture.onContextMenu}
      onClick={() => {
        if (gesture.shouldSkipClick() || isDepositing || pending) return;
        onOpen();
      }}
      aria-label={`${displayName}, ${m.levelLabel}`}
      className={`squad-card${fainted ? " squad-card--fainted" : ""}${
        wallpaper ? " squad-card--wallpaper" : ""
      }${isDragging ? " squad-card--dragging" : ""}${
        isOver ? " squad-card--over" : ""
      }${isDepositing ? " squad-card--depositing" : ""}${
        isDragging ? " touch-none" : ""
      }`}
      data-type-family={typeFamily(primaryType)}
      style={
        {
          "--card-accent": accent,
          ...(wallpaper ? { "--card-wallpaper": `url(${wallpaper})` } : null),
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
        {m.isShiny ? <PokeSparks seed={m.id} accent="#FFE566" /> : null}
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
