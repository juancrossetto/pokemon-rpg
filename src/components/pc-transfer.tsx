"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { typeColor } from "@/lib/type-colors";
import { setTeamLayout } from "@/actions/pc";
import {
  SquadCardContextMenu,
  type SquadContextLabels,
} from "@/components/squad-card-context-menu";
import { PcAlert } from "@/components/pc-alert";
import type { SquadBagCounts } from "@/lib/squad-bag";
import { playPcSfx, unlockPcAudio, type PcSfxKind } from "@/lib/pc-sfx";
import { useTypeLabel } from "@/hooks/use-type-label";

export type PcMon = {
  id: string;
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
  types: string[];
  currentHp: number;
  maxHp: number;
  isFavorite: boolean;
  isTradeLocked: boolean;
  listed: boolean;
  breeding: boolean;
};

type Zone = "team" | "box";
type DragState = { id: string; from: Zone };
type GhostState = { mon: PcMon; x: number; y: number };
type CardFx = "swap" | "arrive";

const DRAG_THRESHOLD_PX = 10;
const FX_MS = 520;

/**
 * Equipo y PC con drag & drop (mouse + touch).
 *
 * El estado local es optimista y se revierte si la acción falla. Cualquier
 * gesto termina en `setTeamLayout`: reordenar, mandar a la PC, traer del PC
 * o intercambiar cuando el equipo está lleno.
 */
export function PcTransfer({
  locale,
  teamSize,
  initialTeam,
  initialBox,
  menuLabels,
  initialBagCounts,
}: {
  locale: string;
  teamSize: number;
  initialTeam: PcMon[];
  initialBox: PcMon[];
  menuLabels: SquadContextLabels;
  initialBagCounts: SquadBagCounts;
}) {
  const t = useTranslations("pc");
  const [team, setTeam] = useState(initialTeam);
  const [box, setBox] = useState(initialBox);
  const [bagCounts, setBagCounts] = useState(initialBagCounts);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [cardFx, setCardFx] = useState<Record<string, CardFx>>({});
  const fxTimers = useRef<Map<string, number>>(new Map());
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [overBox, setOverBox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      for (const id of fxTimers.current.values()) window.clearTimeout(id);
      fxTimers.current.clear();
    };
  }, []);

  function patchMon(id: string, patch: Partial<PcMon>) {
    const apply = (list: PcMon[]) =>
      list.map((m) => {
        if (m.id === id) return { ...m, ...patch };
        if (patch.isFavorite === true && m.isFavorite) {
          return { ...m, isFavorite: false };
        }
        return m;
      });
    setTeam((prev) => apply(prev));
    setBox((prev) => apply(prev));
  }

  function flashCards(ids: string[], kind: CardFx) {
    setCardFx((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = kind;
      return next;
    });
    for (const id of ids) {
      const prev = fxTimers.current.get(id);
      if (prev) window.clearTimeout(prev);
      const timer = window.setTimeout(() => {
        setCardFx((cur) => {
          if (!(id in cur)) return cur;
          const { [id]: _, ...rest } = cur;
          return rest;
        });
        fxTimers.current.delete(id);
      }, FX_MS);
      fxTimers.current.set(id, timer);
    }
  }

  function commit(
    nextTeam: PcMon[],
    nextBox: PcMon[],
    sfx: PcSfxKind,
    animateIds: string[],
  ) {
    const previous = { team, box };
    setTeam(nextTeam);
    setBox(nextBox);
    setError(null);
    playPcSfx(sfx);
    flashCards(animateIds, sfx === "swap" ? "swap" : "arrive");
    startTransition(async () => {
      const result = await setTeamLayout(
        locale,
        nextTeam.map((m) => m.id),
      );
      if (!result.ok) {
        setTeam(previous.team);
        setBox(previous.box);
        setError(result.error);
      }
    });
  }

  function monFrom(source: DragState) {
    return source.from === "team"
      ? team.find((m) => m.id === source.id)
      : box.find((m) => m.id === source.id);
  }

  function dropOnSlot(index: number, source: DragState) {
    const mon = monFrom(source);
    if (!mon || mon.listed || mon.breeding) return;

    if (source.from === "team") {
      if (team[index]?.id === mon.id) return;
      const without = team.filter((m) => m.id !== mon.id);
      const nextTeam = [...without];
      nextTeam.splice(Math.min(index, nextTeam.length), 0, mon);
      commit(nextTeam, box, "reorder", [mon.id]);
      return;
    }

    const occupant = team[index] ?? null;
    if (occupant?.id === mon.id) return;

    if (occupant && team.length >= teamSize) {
      commit(
        team.map((m, i) => (i === index ? mon : m)),
        [occupant, ...box.filter((m) => m.id !== mon.id)],
        "swap",
        [mon.id, occupant.id],
      );
      return;
    }

    if (team.length >= teamSize) {
      setError("team_full");
      return;
    }

    const at = Math.min(index, team.length);
    commit(
      [...team.slice(0, at), mon, ...team.slice(at)],
      box.filter((m) => m.id !== mon.id),
      "withdraw",
      [mon.id],
    );
  }

  function dropOnBox(source: DragState) {
    if (source.from !== "team") return;
    if (team.length <= 1) {
      setError("last_team_member");
      return;
    }
    const mon = team.find((m) => m.id === source.id);
    if (!mon || mon.listed || mon.breeding) return;
    if (mon.isTradeLocked) {
      setError("trade_locked");
      return;
    }
    commit(
      team.filter((m) => m.id !== mon.id),
      [mon, ...box],
      "store",
      [mon.id],
    );
  }

  function beginDrag(source: DragState, x: number, y: number) {
    unlockPcAudio();
    const mon = monFrom(source);
    if (!mon) return;
    dragRef.current = source;
    setDrag(source);
    setGhost({ mon, x, y });
  }

  function clearDragVisual() {
    dragRef.current = null;
    setDrag(null);
    setGhost(null);
    setOverSlot(null);
    setOverBox(false);
  }

  function endDrag(clientX: number, clientY: number) {
    const source = dragRef.current;
    if (!source) {
      clearDragVisual();
      return;
    }

    const target = document.elementFromPoint(clientX, clientY)?.closest("[data-pc-drop]");
    if (target instanceof HTMLElement) {
      const zone = target.dataset.pcDrop;
      if (zone === "box") dropOnBox(source);
      else if (zone?.startsWith("team-")) {
        dropOnSlot(Number(zone.slice(5)), source);
      }
    }

    clearDragVisual();
  }

  function resolveHover(clientX: number, clientY: number) {
    setGhost((prev) => (prev ? { ...prev, x: clientX, y: clientY } : prev));
    const target = document.elementFromPoint(clientX, clientY)?.closest("[data-pc-drop]");
    if (!(target instanceof HTMLElement)) {
      setOverSlot(null);
      setOverBox(false);
      return;
    }
    const zone = target.dataset.pcDrop;
    if (zone === "box") {
      setOverBox(true);
      setOverSlot(null);
    } else if (zone?.startsWith("team-")) {
      setOverSlot(Number(zone.slice(5)));
      setOverBox(false);
    } else {
      setOverSlot(null);
      setOverBox(false);
    }
  }

  const slots = Array.from({ length: teamSize }, (_, i) => team[i] ?? null);
  const dragChips = ["dragChipReorder", "dragChipStore", "dragChipSwap"] as const;

  return (
    <div className={pending ? "opacity-90 transition-opacity" : undefined}>
      {error ? (
        <PcAlert kind="error" onDismiss={() => setError(null)}>
          {t(`errors.${error}`)}
        </PcAlert>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {dragChips.map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[13px]! opacity-70">
              {key === "dragChipReorder"
                ? "swap_vert"
                : key === "dragChipStore"
                  ? "inventory_2"
                  : "sync_alt"}
            </span>
            {t(key)}
          </span>
        ))}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-headline-md text-on-surface">
          <Image
            src="/nav/joystick-icon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
            aria-hidden
          />
          {t("teamSection", { count: team.length, max: teamSize })}
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((mon, index) => (
            <div
              key={mon?.id ?? `empty-${index}`}
              data-pc-drop={`team-${index}`}
              className={`rounded-xl transition ${
                overSlot === index ? "ring-2 ring-pokeball-red/60 scale-[1.01]" : ""
              }`}
            >
              {mon ? (
                <MonCard
                  mon={mon}
                  slot={index + 1}
                  zone="team"
                  dragging={drag?.id === mon.id}
                  fx={cardFx[mon.id]}
                  onDragEnd={clearDragVisual}
                  onPointerDragStart={(x, y) =>
                    beginDrag({ id: mon.id, from: "team" }, x, y)
                  }
                  onPointerDragMove={resolveHover}
                  onPointerDragEnd={endDrag}
                  levelLabel={t("level", { level: mon.level })}
                  menuLabels={menuLabels}
                  bagCounts={bagCounts}
                  onBagChange={setBagCounts}
                  onHealed={(next) => patchMon(mon.id, next)}
                  onLeveledUp={(next) =>
                    patchMon(mon.id, {
                      level: next.level,
                      currentHp: next.currentHp,
                      maxHp: next.maxHp,
                    })
                  }
                  onFlagsChange={(next) => patchMon(mon.id, next)}
                  onDepositToPc={
                    team.length > 1
                      ? () =>
                          dropOnBox({ id: mon.id, from: "team" })
                      : undefined
                  }
                  canDepositToPc={team.length > 1}
                />
              ) : (
                <div className="flex min-h-[92px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-label-sm text-on-surface-variant/50">
                  {t("emptySlot", { slot: index + 1 })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section
        data-pc-drop="box"
        className={`rounded-xl transition-colors ${
          overBox ? "ring-2 ring-electric-yellow/50" : ""
        }`}
      >
        <h2 className="mb-3 flex items-center gap-2 text-headline-md text-on-surface">
          <Image
            src="/nav/pc-icon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
            aria-hidden
          />
          {t("storageSection", { count: box.length })}
        </h2>

        {box.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/5 bg-glass-surface p-8 text-on-surface-variant">
            <span className="material-symbols-outlined mb-2 text-[40px]! opacity-50">storage</span>
            <span className="text-label-md">{t("emptyStorage")}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {box.map((mon) => (
              <MonCard
                key={mon.id}
                mon={mon}
                zone="box"
                dragging={drag?.id === mon.id}
                fx={cardFx[mon.id]}
                onDragEnd={clearDragVisual}
                onPointerDragStart={(x, y) =>
                  beginDrag({ id: mon.id, from: "box" }, x, y)
                }
                onPointerDragMove={resolveHover}
                onPointerDragEnd={endDrag}
                levelLabel={t("level", { level: mon.level })}
                listedLabel={t("listed")}
                breedingLabel={t("breedingLocked")}
                menuLabels={menuLabels}
                bagCounts={bagCounts}
                onBagChange={setBagCounts}
                onHealed={(next) => patchMon(mon.id, next)}
                onLeveledUp={(next) =>
                  patchMon(mon.id, {
                    level: next.level,
                    currentHp: next.currentHp,
                    maxHp: next.maxHp,
                  })
                }
                onFlagsChange={(next) => patchMon(mon.id, next)}
              />
            ))}
          </div>
        )}
      </section>

      {ghost ? <DragGhost mon={ghost.mon} x={ghost.x} y={ghost.y} /> : null}
    </div>
  );
}

function DragGhost({ mon, x, y }: { mon: PcMon; x: number; y: number }) {
  return (
    <div
      className="pc-drag-ghost fixed w-[min(280px,70vw)]"
      style={{ left: x, top: y }}
      aria-hidden
    >
      <div className="flex items-center gap-2.5 rounded-xl border border-pokeball-red/50 bg-surface-container-high/95 p-2.5 shadow-2xl backdrop-blur-md">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-pokeball-red/40 bg-surface-container-highest">
          <Image
            src={mon.spriteUrl}
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-label-md capitalize text-on-surface">{mon.name}</p>
          <p className="text-[11px] text-on-surface-variant">Nv. {mon.level}</p>
        </div>
      </div>
    </div>
  );
}

function MonCard({
  mon,
  slot,
  zone,
  dragging,
  fx,
  onDragEnd,
  onPointerDragStart,
  onPointerDragMove,
  onPointerDragEnd,
  levelLabel,
  listedLabel,
  breedingLabel,
  menuLabels,
  bagCounts,
  onBagChange,
  onHealed,
  onLeveledUp,
  onFlagsChange,
  onDepositToPc,
  canDepositToPc = true,
}: {
  mon: PcMon;
  slot?: number;
  zone: Zone;
  dragging: boolean;
  fx?: CardFx;
  onDragEnd: () => void;
  onPointerDragStart: (x: number, y: number) => void;
  onPointerDragMove: (x: number, y: number) => void;
  onPointerDragEnd: (x: number, y: number) => void;
  levelLabel: string;
  listedLabel?: string;
  breedingLabel?: string;
  menuLabels: SquadContextLabels;
  bagCounts: SquadBagCounts;
  onBagChange: (next: SquadBagCounts) => void;
  onHealed: (next: { currentHp: number; maxHp: number }) => void;
  onLeveledUp: (next: { level: number; currentHp: number; maxHp: number }) => void;
  onFlagsChange: (next: { isFavorite?: boolean; isTradeLocked?: boolean }) => void;
  onDepositToPc?: () => void;
  canDepositToPc?: boolean;
}) {
  const typeLabel = useTypeLabel();
  const hpPct = Math.max(0, Math.min(100, (mon.currentHp / mon.maxHp) * 100));
  const hpClass = hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red";
  const canMove = !mon.listed && !mon.breeding;
  const pointerOrigin = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const fxClass =
    fx === "swap" ? "pc-card-swap" : fx === "arrive" ? "pc-card-arrive" : "";

  return (
    <SquadCardContextMenu
      instanceId={mon.id}
      pokemonName={mon.name || mon.speciesName}
      currentHp={mon.currentHp}
      maxHp={mon.maxHp}
      level={mon.level}
      isFavorite={mon.isFavorite}
      isTradeLocked={mon.isTradeLocked}
      canHeal={mon.currentHp > 0 && mon.currentHp < mon.maxHp}
      canRevive={mon.currentHp <= 0}
      canLevelUp={mon.level < 100}
      labels={menuLabels}
      bagCounts={bagCounts}
      onBagChange={onBagChange}
      onHealed={onHealed}
      onLeveledUp={onLeveledUp}
      onFlagsChange={onFlagsChange}
      onDepositToPc={zone === "team" ? onDepositToPc : undefined}
      canDepositToPc={canDepositToPc}
    >
      <article
        className={`flex items-center gap-3 rounded-xl border border-white/10 bg-glass-surface p-3 pr-8 backdrop-blur-xl transition-opacity ${
          canMove ? "" : "opacity-60"
        } ${dragging ? "pointer-events-none opacity-35" : ""} ${fxClass}`}
      >
        <span
          onPointerDown={(e) => {
            if (!canMove || e.button !== 0) return;
            e.preventDefault();
            pointerOrigin.current = { x: e.clientX, y: e.clientY, active: false };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!pointerOrigin.current || !canMove) return;
            const dx = e.clientX - pointerOrigin.current.x;
            const dy = e.clientY - pointerOrigin.current.y;
            if (!pointerOrigin.current.active) {
              if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
              pointerOrigin.current.active = true;
              onPointerDragStart(e.clientX, e.clientY);
            }
            onPointerDragMove(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (pointerOrigin.current?.active) onPointerDragEnd(e.clientX, e.clientY);
            else onDragEnd();
            pointerOrigin.current = null;
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              /* already released */
            }
          }}
          onPointerCancel={() => {
            pointerOrigin.current = null;
            onDragEnd();
          }}
          className={`shrink-0 touch-none select-none ${
            canMove ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-40"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]! text-on-surface-variant/40">
            drag_indicator
          </span>
        </span>

        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface-variant bg-surface-container-high">
          <Image
            src={mon.spriteUrl}
            alt={mon.speciesName}
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
          {zone === "team" && slot && (
            <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 font-mono text-[9px] leading-tight text-white">
              {slot}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-label-md capitalize text-on-surface">{mon.name}</span>
            <span className="shrink-0 text-label-sm text-on-surface-variant">{levelLabel}</span>
            {mon.isFavorite ? (
              <span className="material-symbols-outlined ms-fill shrink-0 text-[14px]! text-electric-yellow">
                star
              </span>
            ) : null}
            {mon.breeding && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-tertiary/30 bg-tertiary/10 px-1.5 py-0.5 text-[10px] text-tertiary">
                <span className="material-symbols-outlined text-[11px]! leading-none">egg</span>
                {breedingLabel}
              </span>
            )}
            {mon.listed && listedLabel && (
              <span className="shrink-0 rounded border border-electric-yellow/30 bg-electric-yellow/10 px-1.5 py-0.5 text-[10px] text-electric-yellow">
                {listedLabel}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1">
            {mon.types.map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded border px-1.5 py-0.5 text-[10px] uppercase"
                  style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
                >
                  {typeLabel(type)}
                </span>
              );
            })}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
            <div className={`h-full health-bar-fill ${hpClass}`} style={{ width: `${hpPct}%` }} />
          </div>
        </div>
      </article>
    </SquadCardContextMenu>
  );
}
