"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { typeColor } from "@/lib/type-colors";
import { setTeamLayout } from "@/actions/pc";

export type PcMon = {
  id: string;
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
  types: string[];
  currentHp: number;
  maxHp: number;
  /** Publicado en el mercado: está en escrow, no se puede mover. */
  listed: boolean;
};

type Zone = "team" | "box";
type DragState = { id: string; from: Zone } | null;

/**
 * Equipo y PC con drag & drop.
 *
 * El estado local es optimista y se revierte si la acción falla. La página lo
 * monta con una `key` derivada del layout del servidor, así que cualquier
 * cambio hecho por otra vía (una venta en el mercado, por ejemplo) lo resetea
 * sin necesidad de sincronizar con un efecto.
 *
 * Cualquier gesto termina en la misma acción: se manda el equipo completo en
 * orden (`setTeamLayout`). Reordenar, mandar a la PC y traer de la PC son el
 * mismo "así queda el equipo ahora", y el servidor lo aplica atómicamente.
 */
export function PcTransfer({
  locale,
  teamSize,
  initialTeam,
  initialBox,
}: {
  locale: string;
  teamSize: number;
  initialTeam: PcMon[];
  initialBox: PcMon[];
}) {
  const t = useTranslations("pc");
  const [team, setTeam] = useState(initialTeam);
  const [box, setBox] = useState(initialBox);
  const [drag, setDrag] = useState<DragState>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [overBox, setOverBox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit(nextTeam: PcMon[], nextBox: PcMon[]) {
    const previous = { team, box };
    setTeam(nextTeam);
    setBox(nextBox);
    setError(null);
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

  function dropOnSlot(index: number) {
    if (!drag) return;
    const mon =
      drag.from === "team"
        ? team.find((m) => m.id === drag.id)
        : box.find((m) => m.id === drag.id);
    if (!mon || mon.listed) return;

    if (drag.from === "team") {
      const rest = team.filter((m) => m.id !== mon.id);
      const at = Math.min(index, rest.length);
      commit([...rest.slice(0, at), mon, ...rest.slice(at)], box);
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
    );
  }

  function dropOnBox() {
    if (!drag || drag.from !== "team") return;
    if (team.length <= 1) {
      setError("last_team_member");
      return;
    }
    const mon = team.find((m) => m.id === drag.id);
    if (!mon) return;
    commit(
      team.filter((m) => m.id !== mon.id),
      [mon, ...box],
    );
  }

  const slots = Array.from({ length: teamSize }, (_, i) => team[i] ?? null);

  return (
    <div className={pending ? "opacity-90 transition-opacity" : undefined}>
      {error && (
        <div className="mb-4 rounded-lg border border-error/40 bg-error-container/30 px-4 py-2 text-label-md text-error">
          {t(`errors.${error}`)}
        </div>
      )}

      <p className="mb-3 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
        {t("dragHint")}
      </p>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-headline-md text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-pokeball-red">group</span>
          {t("teamSection", { count: team.length, max: teamSize })}
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((mon, index) => (
            <div
              key={mon?.id ?? `empty-${index}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverSlot(index);
              }}
              onDragLeave={() => setOverSlot((s) => (s === index ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOverSlot(null);
                dropOnSlot(index);
              }}
              className={`rounded-xl transition-colors ${
                overSlot === index ? "ring-2 ring-pokeball-red/60" : ""
              }`}
            >
              {mon ? (
                <MonCard
                  mon={mon}
                  slot={index + 1}
                  zone="team"
                  dragging={drag?.id === mon.id}
                  onDragStart={() => setDrag({ id: mon.id, from: "team" })}
                  onDragEnd={() => setDrag(null)}
                  levelLabel={t("level", { level: mon.level })}
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
        onDragOver={(e) => {
          e.preventDefault();
          setOverBox(true);
        }}
        onDragLeave={() => setOverBox(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOverBox(false);
          dropOnBox();
        }}
        className={`rounded-xl transition-colors ${
          overBox ? "ring-2 ring-electric-yellow/50" : ""
        }`}
      >
        <h2 className="mb-3 flex items-center gap-2 text-headline-md text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-electric-yellow">
            storage
          </span>
          {t("storageSection", { count: box.length })}
        </h2>

        {box.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/5 bg-glass-surface p-8 text-on-surface-variant">
            <span className="material-symbols-outlined mb-2 text-[40px] opacity-50">storage</span>
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
                onDragStart={() => setDrag({ id: mon.id, from: "box" })}
                onDragEnd={() => setDrag(null)}
                levelLabel={t("level", { level: mon.level })}
                listedLabel={t("listed")}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MonCard({
  mon,
  slot,
  zone,
  dragging,
  onDragStart,
  onDragEnd,
  levelLabel,
  listedLabel,
}: {
  mon: PcMon;
  slot?: number;
  zone: Zone;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  levelLabel: string;
  listedLabel?: string;
}) {
  const hpPct = Math.max(0, Math.min(100, (mon.currentHp / mon.maxHp) * 100));
  const hpClass = hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red";

  return (
    <article
      draggable={!mon.listed}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 rounded-xl border border-white/10 bg-glass-surface p-3 backdrop-blur-xl transition-opacity ${
        mon.listed ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"
      } ${dragging ? "opacity-40" : ""}`}
    >
      <span className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant/40">
        drag_indicator
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
                {type}
              </span>
            );
          })}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
          <div className={`h-full health-bar-fill ${hpClass}`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>
    </article>
  );
}
