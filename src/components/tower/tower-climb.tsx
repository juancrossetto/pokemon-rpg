"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  applyTowerRest,
  challengeTowerFloor,
  chooseTowerBlessing,
  claimTowerLoot,
  startTowerRun,
  type TowerRestChoice,
} from "@/actions/tower";
import { GameCtaButton } from "@/components/game-cta-button";
import { RewardList } from "@/components/events/reward-chip";
import type { RewardDef } from "@/lib/events/rewards";
import type {
  TowerBlessing,
  TowerBlessingRarity,
  TowerFloor,
  TowerPrimaryAction,
  TowerRunCreature,
} from "@/lib/tower";
import { floorNodeVisual } from "@/lib/tower/icons";

/* ------------------------------------------------------------------ *
 * Tokens visuales por tipo de piso.
 *
 * El color es la única señal que el jugador lee de un vistazo mientras
 * sube, así que cada tipo tiene el suyo y se usa igual en el riel, en la
 * ficha del piso y en el botón. Un elite y un jefe no pueden verse igual.
 * ------------------------------------------------------------------ */
const FLOOR_TONE: Record<string, { accent: string; icon: string }> = {
  normal: { accent: "#7c8899", icon: "swords" },
  elite: { accent: "#a78bfa", icon: "local_fire_department" },
  boss: { accent: "#ee1515", icon: "skull" },
  rest: { accent: "#4ade80", icon: "local_hotel" },
};

const RARITY_FOIL: Record<
  TowerBlessingRarity,
  {
    foil: string;
    text: string;
    glow: string;
    wash: string;
    chip: string;
  }
> = {
  common: {
    foil: "linear-gradient(145deg,#4b5563 0%,#9ca3af 42%,#374151 100%)",
    text: "text-slate-200",
    glow: "rgba(148,163,184,0.35)",
    wash: "radial-gradient(ellipse at 50% 0%, rgba(148,163,184,0.22) 0%, transparent 62%)",
    chip: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  },
  rare: {
    foil: "linear-gradient(145deg,#0369a1 0%,#7dd3fc 45%,#0c4a6e 100%)",
    text: "text-sky-200",
    glow: "rgba(56,189,248,0.45)",
    wash: "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.28) 0%, transparent 62%)",
    chip: "border-sky-400/35 bg-sky-400/12 text-sky-200",
  },
  epic: {
    foil: "linear-gradient(145deg,#6d28d9 0%,#e9d5ff 42%,#f2c000 78%,#4c1d95 100%)",
    text: "text-violet-100",
    glow: "rgba(196,181,253,0.5)",
    wash: "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.32) 0%, transparent 62%)",
    chip: "border-violet-300/40 bg-violet-400/15 text-violet-100",
  },
};

/** Ícono + acento por bendición: la rareza pinta el marco, esto pinta el efecto. */
const BLESSING_VISUAL: Record<string, { icon: string; accent: string }> = {
  vitality: { icon: "favorite", accent: "#fb7185" },
  swift: { icon: "speed", accent: "#fbbf24" },
  mend: { icon: "healing", accent: "#4ade80" },
  second_wind: { icon: "ecg_heart", accent: "#fb923c" },
  tide: { icon: "water_drop", accent: "#38bdf8" },
  blaze: { icon: "local_fire_department", accent: "#f97316" },
  grove: { icon: "eco", accent: "#4ade80" },
  fortune: { icon: "monetization_on", accent: "#f2c000" },
  aegis: { icon: "shield", accent: "#c4b5fd" },
  rally: { icon: "groups", accent: "#f0abfc" },
};

function blessingVisual(id: string) {
  return BLESSING_VISUAL[id] ?? { icon: "auto_awesome", accent: "#a78bfa" };
}

/** Número grande que el jugador lee antes del texto. */
function blessingStatLabel(blessing: TowerBlessing): string {
  const effect = blessing.effects[0];
  if (!effect) return "";
  if (effect.kind === "shield_first_hit") return "1×";
  return `+${effect.value}%`;
}

function toneFor(type: string) {
  return FLOOR_TONE[type] ?? FLOOR_TONE.normal;
}

/* ------------------------------------------------------------------ *
 * Riel de ascenso
 * ------------------------------------------------------------------ */

/**
 * ¿El jugador acaba de subir un piso, y lo está viendo?
 *
 * Dos condiciones, y las dos hicieron falta:
 *
 * 1. Que haya avanzado de verdad. El piso visto se guarda en `sessionStorage`
 *    —estado de presentación, no de partida— y el efecto corre sólo cuando el
 *    número creció. Sin esto, recargar la pantalla parecía una victoria.
 * 2. Que el riel esté en pantalla. Al volver de la arena la vista aparece
 *    arriba de todo y el riel vive debajo del hero y de las métricas, así que
 *    la animación terminaba antes de que el jugador llegara scrolleando.
 *
 * Devuelve `false` en el primer render a propósito: en SSR no hay
 * `sessionStorage` ni `IntersectionObserver`, y devolver otra cosa daría un
 * HTML distinto al del cliente y rompería la hidratación.
 */
function useJustClimbed(currentFloor: number) {
  const [justClimbed, setJustClimbed] = useState(false);
  const currentNodeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (currentFloor < 1) return;

    const KEY = "tower:last-floor";
    const previous = window.sessionStorage.getItem(KEY);
    window.sessionStorage.setItem(KEY, String(currentFloor));

    const node = currentNodeRef.current;
    if (!node) return;

    const climbed = previous != null && Number(previous) < currentFloor;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroller = node.closest<HTMLElement>("[data-tower-rail-scroll]");

    /*
      Centramos el piso actual dentro del riel (no de la página): si no, al
      abrir en un piso alto la lista arranca arriba y los primeros niveles
      quedan fuera de vista.
    */
    /*
      Centramos el piso actual dentro del riel (no de la página). El `py-3`
      del `<ol>` evita que nodo/ficha se corten contra el borde del overflow.
    */
    if (scroller) {
      const nodeRect = node.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const delta =
        nodeRect.top -
        scrollerRect.top -
        scroller.clientHeight / 2 +
        nodeRect.height / 2;
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTo({
        top: Math.min(maxScroll, Math.max(0, scroller.scrollTop + delta)),
        behavior: climbed && !reduced ? "smooth" : "auto",
      });
    } else {
      node.scrollIntoView({
        block: "center",
        behavior: climbed && !reduced ? "smooth" : "instant",
      });
    }

    if (!climbed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setJustClimbed(true);
        observer.disconnect();
      },
      { root: scroller, threshold: 0.6 },
    );
    observer.observe(node);

    const timer = window.setTimeout(() => {
      observer.disconnect();
      setJustClimbed(false);
    }, 6000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [currentFloor]);

  return { justClimbed, currentNodeRef };
}

/**
 * El camino, invertido.
 *
 * Antes los pisos se listaban en orden ascendente de arriba hacia abajo, así
 * que avanzar movía al jugador HACIA ABAJO: la pantalla contradecía la única
 * metáfora que tiene que vender. Acá la lista se da vuelta —el piso más alto
 * arriba— y el piso actual queda anclado con su ficha desplegada, de modo que
 * lo conquistado baja y lo que falta sube.
 */
export function TowerClimbRail({
  floors,
  currentFloor,
  highestCleared,
  autoScroll = true,
}: {
  floors: TowerFloor[];
  currentFloor: number;
  highestCleared: number;
  /** Centrar el piso actual al montar. Desactivar al revisar un intento cerrado. */
  autoScroll?: boolean;
}) {
  const t = useTranslations("tower");
  const { justClimbed, currentNodeRef } = useJustClimbed(autoScroll ? currentFloor : -1);
  const ascending = [...floors].sort((a, b) => b.floorNumber - a.floorNumber);

  return (
    <ol className="relative flex w-full min-w-0 flex-col py-3">
      {ascending.map((floor, i) => {
        const cleared = floor.floorNumber <= highestCleared || floor.floorNumber < currentFloor;
        const isCurrent = floor.floorNumber === currentFloor;
        const tone = toneFor(floor.type);
        const locked = !cleared && !isCurrent;

        /*
          El riel dejó de ser una línea absoluta única: ahora cada piso dibuja
          el tramo que baja hacia el piso anterior. Hacía falta para poder
          animar UN tramo —el recién superado— sin tocar los demás, y además
          se adapta solo a que cada item mida distinto según cuánto detalle
          muestre.

          `isLast` es el piso más bajo de la ventana: debajo no hay nada que
          conectar.
        */
        const isLast = i === ascending.length - 1;
        const below = floor.floorNumber - 1;
        const segmentFilled = below <= highestCleared || below < currentFloor;
        // El tramo que se acaba de subir es el que entra al piso actual.
        const segmentJustClimbed = isCurrent && segmentFilled && justClimbed;

        return (
          <li
            key={floor.id}
            ref={isCurrent ? currentNodeRef : undefined}
            className="tp-rise relative flex w-full min-w-0 items-start gap-2.5 py-1"
            style={{ animationDelay: `${i * 50}ms` } as CSSProperties}
          >
            {/* Nodo + tramo hacia el piso de abajo */}
            <div className="relative z-[1] flex w-14 shrink-0 flex-col items-center self-stretch sm:w-16">
              <span
                className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-visible rounded-2xl border-2 transition sm:h-16 sm:w-16 ${
                  segmentJustClimbed ? "tower-node-reached" : ""
                }`}
                style={
                  {
                    borderColor: isCurrent ? tone.accent : cleared ? "#34d39988" : "#ffffff1f",
                    background: isCurrent
                      ? `radial-gradient(circle at 50% 30%, ${tone.accent}44, #0b0e14)`
                      : "#0b0e14",
                    boxShadow: isCurrent
                      ? `0 0 0 1px ${tone.accent}66, 0 0 18px ${tone.accent}44`
                      : undefined,
                    "--tower-node-glow": `${tone.accent}99`,
                  } as CSSProperties
                }
              >
                <FloorNodeFace
                  floor={floor}
                  cleared={cleared}
                  locked={locked}
                  accent={tone.accent}
                />
              </span>
              <span
                className={`mt-0.5 shrink-0 font-mono text-[10px] font-bold tabular-nums ${
                  isCurrent ? "text-white" : "text-white/35"
                }`}
              >
                {floor.floorNumber}
              </span>

              {!isLast && (
                <RailSegment
                  filled={segmentFilled}
                  animate={segmentJustClimbed}
                  accent={tone.accent}
                />
              )}
            </div>

            {/*
              `self-start`: la ficha no se estira con el tramo del riel. Antes
              `items-stretch` dejaba el card del piso actual (guardián) con un
              hueco vacío abajo, como si estuviera incompleto.
            */}
            <div
              className={`relative min-w-0 flex-1 self-start rounded-xl border px-2.5 py-2 transition sm:px-3 sm:py-2.5 ${
                isCurrent
                  ? "border-white/20 bg-white/[0.05]"
                  : locked
                    ? "border-white/[0.05] bg-white/[0.012] opacity-55"
                    : "border-white/[0.07] bg-white/[0.025]"
              }`}
              style={isCurrent ? { boxShadow: `inset 0 0 24px ${tone.accent}1f` } : undefined}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded px-1.5 py-px text-[9px] font-black uppercase tracking-wider"
                  style={{ background: `${tone.accent}22`, color: tone.accent }}
                >
                  {t(`floorTypes.${floor.type}`)}
                </span>
                {isCurrent && (
                  <span className="rounded bg-pokeball-red px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-white">
                    {t("path.current")}
                  </span>
                )}
              </div>

              {/* El detalle sólo en el piso actual: en los demás sería ruido */}
              {isCurrent ? (
                <>
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-on-surface-variant">
                    {t("path.recommendedPc", { pc: floor.recommendedCombatPower })}
                  </p>
                  {floor.modifiers.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1">
                      {floor.modifiers.map((m) => (
                        <li
                          key={m.id}
                          title={t(m.descriptionKey)}
                          className="rounded border border-violet-400/25 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-200"
                        >
                          {t(m.nameKey)}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-white/30">
                  {t("path.recommendedPc", { pc: floor.recommendedCombatPower })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function FloorNodeFace({
  floor,
  cleared,
  locked,
  accent,
}: {
  floor: TowerFloor;
  cleared: boolean;
  locked: boolean;
  accent: string;
}) {
  const visual = floorNodeVisual(floor);

  if (visual.kind === "glyph") {
    return (
      <>
        <span
          className="material-symbols-outlined text-[26px]!"
          style={{
            color: locked ? "#ffffff40" : cleared ? "#34d39955" : accent,
            opacity: cleared ? 0.4 : 1,
          }}
        >
          {visual.icon}
        </span>
        {cleared ? (
          <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-[22px]! font-bold text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            check
          </span>
        ) : null}
        {locked ? (
          <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-[16px]! text-white/40">
            lock
          </span>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Image
        src={visual.src}
        alt=""
        width={visual.kind === "pokemon" ? 64 : 56}
        height={visual.kind === "pokemon" ? 64 : 56}
        unoptimized
        className={`object-contain object-center ${
          visual.kind === "pokemon"
            ? "h-[58px] w-[58px] max-w-none scale-[1.15]"
            : "h-[52px] w-[52px] scale-110"
        } ${cleared ? "opacity-40" : ""} ${locked ? "opacity-45" : ""}`}
      />
      {cleared ? (
        <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-[22px]! font-bold text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          check
        </span>
      ) : null}
      {locked ? (
        <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-[16px]! text-white/40 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
          lock
        </span>
      ) : null}
    </>
  );
}

/**
 * Tramo del riel entre dos pisos.
 *
 * Tres capas sobre el mismo eje de 2px: la vía apagada, el relleno y —sólo en
 * el tramo recién superado— una chispa que sube por delante. La chispa es lo
 * que hace que se lea como "escalando" y no como "una barra que crece".
 *
 * `flex-1` en vez de una altura fija: el tramo ocupa lo que sobre del item, y
 * los items miden distinto porque el piso actual despliega modificadores y PC
 * recomendado. Con altura fija el riel quedaría cortado justo en ese piso.
 */
function RailSegment({
  filled,
  animate,
  accent,
}: {
  filled: boolean;
  animate: boolean;
  accent: string;
}) {
  const glow = filled ? "#34d399" : accent;

  return (
    /*
      `min-h` además de `flex-1`: medido, sin él el tramo colapsa a 0px en los
      pisos cuya ficha es más baja que el nodo —que son casi todos, porque sólo
      el piso actual despliega modificadores—. El mínimo garantiza el tramo
      visible y de paso separa los nodos entre sí.
    */
    <span aria-hidden className="relative min-h-[18px] w-[2px] flex-1 self-center">
      {/* Vía */}
      <span className="absolute inset-0 rounded-full bg-white/[0.09]" />

      {/* Relleno. Sin `animate` queda puesto de una: los tramos viejos no
          tienen que volver a llenarse en cada render. */}
      {filled && (
        <span
          className={`absolute inset-x-0 bottom-0 top-0 origin-bottom rounded-full ${
            animate ? "tower-climb-fill" : ""
          }`}
          style={{
            background: `linear-gradient(to top, ${glow}55, ${glow})`,
            boxShadow: `0 0 8px ${glow}aa, 0 0 16px ${glow}55`,
          }}
        />
      )}

      {animate && (
        <span
          className="tower-climb-spark absolute left-1/2 h-[7px] w-[7px] rounded-full"
          style={{
            background: glow,
            boxShadow: `0 0 10px ${glow}, 0 0 20px ${glow}aa`,
          }}
        />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Estado del ascenso
 * ------------------------------------------------------------------ */

/**
 * Franja compacta del ascenso: acumulado | este piso | vidas.
 * Una sola pieza, sin cards sueltas que dejen aire muerto.
 */
export function TowerRunStatus({
  earned,
  next,
  hasFirstClear,
  unitLabels,
  attemptsRemaining,
  attemptsMax,
}: {
  earned: RewardDef[];
  next: RewardDef[];
  hasFirstClear: boolean;
  unitLabels: { coins: string; energy: string };
  attemptsRemaining: number;
  attemptsMax: number;
}) {
  const t = useTranslations("tower");

  return (
    <div
      className="grid grid-cols-1 overflow-hidden rounded-xl border border-white/[0.1] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 45%, rgba(0,0,0,0.22) 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <LootLane
        label={t("loot.earnedTitle")}
        accent="#f2c000"
        empty={earned.length === 0 ? t("loot.earnedEmpty") : null}
      >
        {earned.length > 0 ? (
          <RewardList rewards={earned} size="sm" unitLabels={unitLabels} />
        ) : null}
      </LootLane>

      <LootLane
        label={t("loot.nextTitle")}
        accent="#a78bfa"
        badge={hasFirstClear ? t("loot.firstClear") : null}
        className="border-t border-white/[0.07] sm:border-l sm:border-t-0"
      >
        {next.length > 0 ? (
          <RewardList rewards={next} size="sm" unitLabels={unitLabels} />
        ) : (
          <p className="text-[10px] text-on-surface-variant/45">—</p>
        )}
      </LootLane>

      <div className="flex items-center gap-2.5 border-t border-white/[0.07] px-3 py-2.5 sm:border-l sm:border-t-0 sm:px-3.5">
        <div className="min-w-0">
          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/65">
            {t("status.attempts")}
          </p>
          <p className="mt-0.5 font-mono text-[11px] font-bold tabular-nums text-white/70">
            {attemptsRemaining}
            <span className="text-white/35">/{attemptsMax}</span>
            <span className="ml-1 text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant/45">
              {t("status.attemptsHint")}
            </span>
          </p>
        </div>
        <div
          className="flex items-center gap-0.5"
          role="img"
          aria-label={`${attemptsRemaining}/${attemptsMax}`}
        >
          {Array.from({ length: attemptsMax }, (_, i) => {
            const alive = i < attemptsRemaining;
            return (
              <span
                key={i}
                className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center ${
                  alive ? "" : "opacity-25 grayscale"
                }`}
              >
                <Image
                  src="/tower/poke-health-icon.png"
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain mix-blend-screen"
                  unoptimized
                />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LootLane({
  label,
  accent,
  badge,
  empty,
  children,
  className = "",
}: {
  label: string;
  accent: string;
  badge?: string | null;
  empty?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 px-3 py-2.5 ${className}`}>
      <span
        aria-hidden
        className="absolute inset-x-3 top-0 h-[2px] sm:inset-x-0"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accent}99 40%, ${accent}66 70%, transparent 100%)`,
        }}
      />
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/65">
          {label}
        </p>
        {badge ? (
          <span className="rounded bg-violet-500/25 px-1.5 py-px text-[7px] font-black uppercase tracking-wider text-violet-200">
            {badge}
          </span>
        ) : null}
      </div>
      {empty ? (
        <p className="text-[10px] leading-snug text-on-surface-variant/50">{empty}</p>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * Resumen al cerrar un intento: derrota, victoria o abandono.
 *
 * El botín queda en `pendingLoot` hasta que el jugador lo reclame acá.
 * También muestra el estado final del equipo del intento.
 */
export function TowerEndedSummary({
  kind,
  runId,
  locale,
  floorReached,
  loot,
  canClaim,
  lootClaimed,
  alreadyGranted = false,
  team,
  unitLabels,
}: {
  kind: "FAILED" | "COMPLETED" | "ABANDONED";
  runId: string;
  locale: string;
  floorReached: number;
  loot: RewardDef[];
  canClaim: boolean;
  lootClaimed: boolean;
  /** Ascensos viejos que acreditaron piso a piso (sin pendingLoot). */
  alreadyGranted?: boolean;
  team: TowerRunCreature[];
  unitLabels: { coins: string; energy: string };
}) {
  const t = useTranslations("tower");
  const [pending, start] = useTransition();
  const accent =
    kind === "COMPLETED" ? "#4ade80" : kind === "ABANDONED" ? "#94a3b8" : "#ee1515";
  const titleKey =
    kind === "COMPLETED"
      ? "result.completedTitle"
      : kind === "ABANDONED"
        ? "result.abandonedTitle"
        : "result.failedTitle";
  const bodyKey =
    kind === "COMPLETED"
      ? "result.completedBody"
      : kind === "ABANDONED"
        ? "result.abandonedBody"
        : "result.failedBody";

  return (
    <section
      className="relative overflow-hidden rounded-2xl border px-3 py-3 sm:px-4"
      style={{
        borderColor: `${accent}44`,
        background: `linear-gradient(180deg, ${accent}14 0%, rgba(10,12,18,0.92) 55%)`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            {t(titleKey)}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/70">{t(bodyKey)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-right">
          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/65">
            {t("result.floorReached")}
          </p>
          <p className="font-mono text-[22px] font-black leading-none tabular-nums text-white">
            {floorReached}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
          <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.16em] text-electric-yellow/80">
            {t("result.lootKept")}
          </p>
          {loot.length > 0 ? (
            <RewardList rewards={loot} size="sm" unitLabels={unitLabels} />
          ) : (
            <p className="text-[11px] text-on-surface-variant/55">{t("result.lootEmpty")}</p>
          )}
          {lootClaimed ? (
            <p className="mt-2 text-[10px] font-semibold text-emerald-300/90">
              {t("result.lootClaimed")}
            </p>
          ) : alreadyGranted ? (
            <p className="mt-2 text-[10px] leading-snug text-on-surface-variant/55">
              {t("result.lootAlreadyGranted")}
            </p>
          ) : (
            <p className="mt-2 text-[10px] leading-snug text-on-surface-variant/55">
              {t("result.lootHint")}
            </p>
          )}
          {canClaim && !lootClaimed ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => claimTowerLoot(locale, runId))}
              className="mt-2.5 flex w-full min-h-11 items-center justify-center gap-1.5 rounded-xl bg-electric-yellow px-3 py-2 text-[12px] font-black uppercase tracking-wider text-surface transition hover:bg-electric-yellow/90 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]!">redeem</span>
              {pending ? t("actions.working") : t("result.claimCta")}
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
          <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/65">
            {t("result.finalTeam")}
          </p>
          <ul className="grid grid-cols-6 gap-1">
            {team.map((m) => {
              const down = m.defeated || m.currentHp <= 0;
              const pct = m.maxHp > 0 ? m.currentHp / m.maxHp : 0;
              const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.2 ? "#facc15" : "#ef4444";
              return (
                <li
                  key={m.instanceId}
                  title={`${m.nickname ?? m.speciesName} · ${m.currentHp}/${m.maxHp}`}
                  className={`relative flex flex-col items-center rounded-lg border px-0.5 pb-1 pt-1 ${
                    down
                      ? "border-error/25 bg-error/10"
                      : "border-white/[0.08] bg-white/[0.03]"
                  }`}
                >
                  <Image
                    src={m.spriteUrl}
                    alt={m.nickname ?? m.speciesName}
                    width={36}
                    height={36}
                    unoptimized
                    className={`h-8 w-8 object-contain ${down ? "grayscale opacity-70" : ""}`}
                  />
                  {down ? (
                    <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-[14px]! text-error">
                      skull
                    </span>
                  ) : null}
                  <div className="mt-0.5 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(Math.max(0, pct) * 100)}%`,
                        background: down ? "#ef4444" : hpColor,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] leading-snug text-on-surface-variant/55">
            {t("result.teamRestored")}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Equipo del ascenso
 * ------------------------------------------------------------------ */

export function TowerSquad({ team }: { team: TowerRunCreature[] }) {
  const t = useTranslations("tower");
  return (
    <div>
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/70">
        {t("team.title")}
      </p>
      <ul className="grid grid-cols-6 gap-1.5">
        {team.map((m) => {
          const pct = m.maxHp > 0 ? m.currentHp / m.maxHp : 0;
          const down = m.defeated || m.currentHp <= 0;
          const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.2 ? "#facc15" : "#ef4444";
          return (
            <li
              key={m.instanceId}
              title={`${m.nickname ?? m.speciesName} · ${m.currentHp}/${m.maxHp}`}
              className={`relative flex flex-col items-center rounded-lg border px-1 pb-1 pt-1.5 ${
                down
                  ? "border-white/[0.04] bg-black/20 opacity-40"
                  : "border-white/[0.08] bg-white/[0.03]"
              }`}
            >
              <Image
                src={m.spriteUrl}
                alt={m.nickname ?? m.speciesName}
                width={40}
                height={40}
                unoptimized
                className={`h-9 w-9 object-contain ${down ? "grayscale" : ""}`}
              />
              {down && (
                <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-[16px]! text-error/80">
                  close
                </span>
              )}
              <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round(pct * 100)}%`, background: hpColor }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Draft de bendiciones
 * ------------------------------------------------------------------ */

/**
 * El draft, como momento y no como lista.
 *
 * Es la decisión más importante del modo: tres cartas con foil de rareza,
 * ícono del efecto y el número grande adelante. No hay forma de seguir sin
 * elegir — exactamente el peso que tiene la mecánica dentro del juego.
 */
export function TowerBlessingDraft({
  blessings,
  locale,
}: {
  blessings: TowerBlessing[];
  locale: string;
}) {
  const t = useTranslations("tower");
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(124,58,237,0.18),transparent_55%)]"
      />

      <div className="tp-rise relative w-full max-w-3xl">
        <div className="mb-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300/90">
            {t("blessing.pickTitle")}
          </p>
          <p className="mt-1.5 text-label-sm text-on-surface-variant/80">
            {t("blessing.pickHint")}
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3">
          {blessings.map((b, i) => {
            const foil = RARITY_FOIL[b.rarity];
            const visual = blessingVisual(b.id);
            const stat = blessingStatLabel(b);
            const isPicked = picked === b.id;
            const dimmed = pending && !isPicked;

            return (
              <li key={b.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setPicked(b.id);
                    start(async () => chooseTowerBlessing(b.id, locale));
                  }}
                  style={
                    {
                      background: foil.foil,
                      animationDelay: `${i * 80}ms`,
                      "--blessing-glow": foil.glow,
                    } as CSSProperties
                  }
                  className={`tower-blessing-card tp-rise group relative block w-full rounded-2xl p-[2px] text-left transition duration-200 disabled:cursor-wait ${
                    dimmed ? "scale-[0.98] opacity-35" : "hover:-translate-y-1 hover:scale-[1.02]"
                  } ${isPicked ? "scale-[1.02]" : ""}`}
                >
                  <span
                    className="relative flex h-full min-h-[13.5rem] flex-col overflow-hidden rounded-[0.95rem] bg-[#0a0c12] p-3.5 sm:min-h-[15rem]"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{ background: foil.wash }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
                      style={{ background: visual.accent }}
                    />

                    <span
                      className={`relative z-10 inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${foil.chip}`}
                    >
                      {t(`blessing.rarity.${b.rarity}`)}
                    </span>

                    <span className="relative z-10 mt-4 flex flex-1 flex-col items-center text-center">
                      <span
                        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        style={{
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 28px ${visual.accent}33`,
                        }}
                      >
                        <span
                          className="material-symbols-outlined text-[30px]! leading-none"
                          style={{ color: visual.accent }}
                        >
                          {visual.icon}
                        </span>
                      </span>

                      {stat ? (
                        <span
                          className="mt-2.5 font-mono text-[26px] font-black leading-none tracking-tight tabular-nums"
                          style={{ color: visual.accent }}
                        >
                          {stat}
                        </span>
                      ) : null}

                      <span className="mt-3 text-[15px] font-bold leading-tight text-white">
                        {t(b.nameKey)}
                      </span>
                      <span className="mt-1.5 text-[11px] leading-snug text-white/55">
                        {t(b.descriptionKey)}
                      </span>
                    </span>

                    <span
                      className={`relative z-10 mt-3 flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70 transition group-hover:border-white/20 group-hover:text-white ${
                        isPicked ? "border-white/25 text-white" : ""
                      }`}
                    >
                      {isPicked ? (
                        <span className="material-symbols-outlined animate-spin text-[14px]!">
                          progress_activity
                        </span>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]!">ads_click</span>
                          {t("blessing.pickCta")}
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {pending ? (
          <p className="mt-4 text-center text-label-sm text-on-surface-variant">
            {t("actions.working")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bifurcación de descanso
 * ------------------------------------------------------------------ */

/**
 * Descanso con coste de oportunidad.
 *
 * Curarse o llevarse una bendición es la única elección real entre draft y
 * draft. Las dos opciones se presentan como cartas enfrentadas —mismo peso
 * visual que el draft— para que la renuncia se sienta.
 */
export function TowerRestFork({
  locale,
  recoveryPct,
  canAttune,
  teamHpPct,
}: {
  locale: string;
  recoveryPct: number;
  canAttune: boolean;
  teamHpPct: number;
}) {
  const t = useTranslations("tower");
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<TowerRestChoice | null>(null);
  const lowHp = teamHpPct < 0.35 && canAttune;

  const choose = (choice: TowerRestChoice) => {
    setPicked(choice);
    start(async () => applyTowerRest(locale, choice));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-[#0a0c12] p-3 sm:p-4">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(74,222,128,0.14),transparent_55%)]"
      />

      <div className="relative z-10 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300/90">
          {t("rest.title")}
        </p>
        <p className="mt-1 text-[11px] text-on-surface-variant/80">{t("rest.hint")}</p>
      </div>

      <div className="relative z-10 mt-3 grid gap-2.5 sm:grid-cols-2">
        <RestOption
          icon="local_hotel"
          accent="#4ade80"
          foil="linear-gradient(145deg,#166534 0%,#86efac 45%,#14532d 100%)"
          wash="radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.28) 0%, transparent 62%)"
          stat={`+${recoveryPct}%`}
          title={t("rest.recoverTitle")}
          body={t("rest.recoverBody", { pct: recoveryPct })}
          cta={t("rest.recoverCta")}
          pending={pending}
          active={picked === "recover"}
          dimmed={pending && picked !== "recover"}
          onClick={() => choose("recover")}
        />
        <RestOption
          icon="auto_awesome"
          accent="#c79bf0"
          foil="linear-gradient(145deg,#5b21b6 0%,#e9d5ff 45%,#4c1d95 100%)"
          wash="radial-gradient(ellipse at 50% 0%, rgba(196,181,253,0.28) 0%, transparent 62%)"
          stat="✦"
          title={t("rest.attuneTitle")}
          body={
            canAttune ? t("rest.attuneBody") : t("rest.attuneUnavailable")
          }
          cta={t("rest.attuneCta")}
          pending={pending}
          active={picked === "attune"}
          dimmed={pending && picked !== "attune"}
          disabled={!canAttune}
          onClick={() => choose("attune")}
        />
      </div>

      {lowHp ? (
        <div className="relative z-10 mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2">
          <span className="material-symbols-outlined mt-0.5 text-[16px]! text-amber-300">
            warning
          </span>
          <p className="text-[11px] leading-snug text-amber-100/90">
            {t("rest.lowHpWarning")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function RestOption({
  icon,
  accent,
  foil,
  wash,
  stat,
  title,
  body,
  cta,
  pending,
  active,
  dimmed,
  disabled,
  onClick,
}: {
  icon: string;
  accent: string;
  foil: string;
  wash: string;
  stat: string;
  title: string;
  body: string;
  cta: string;
  pending: boolean;
  active: boolean;
  dimmed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={onClick}
      style={{ background: foil, "--rest-glow": `${accent}66` } as CSSProperties}
      className={`tower-blessing-card group relative block w-full rounded-2xl p-[2px] text-left transition duration-200 disabled:cursor-not-allowed ${
        dimmed || disabled ? "opacity-40" : "hover:-translate-y-0.5 hover:scale-[1.015]"
      } ${active ? "scale-[1.015]" : ""}`}
    >
      <span className="relative flex h-full min-h-[11.5rem] flex-col overflow-hidden rounded-[0.95rem] bg-[#0a0c12] p-3.5">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: wash }} />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-5 -top-6 h-24 w-24 rounded-full opacity-35 blur-2xl transition group-hover:opacity-60"
          style={{ background: accent }}
        />

        <span className="relative z-10 flex flex-1 flex-col items-center text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/35"
            style={{
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 24px ${accent}33`,
            }}
          >
            <span
              className="material-symbols-outlined text-[26px]! leading-none"
              style={{ color: accent }}
            >
              {icon}
            </span>
          </span>

          <span
            className="mt-2.5 font-mono text-[22px] font-black leading-none tracking-tight"
            style={{ color: accent }}
          >
            {stat}
          </span>
          <span className="mt-2 text-[15px] font-bold leading-tight text-white">{title}</span>
          <span className="mt-1 text-[11px] leading-snug text-white/55">{body}</span>
        </span>

        <span
          className={`relative z-10 mt-3 flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70 transition group-hover:border-white/20 group-hover:text-white ${
            active ? "border-white/25 text-white" : ""
          }`}
        >
          {active ? (
            <span className="material-symbols-outlined animate-spin text-[14px]!">
              progress_activity
            </span>
          ) : (
            <>
              <span className="material-symbols-outlined text-[14px]!">ads_click</span>
              {cta}
            </>
          )}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Barra de acción
 * ------------------------------------------------------------------ */

/**
 * Acción principal, siempre alcanzable.
 *
 * En el layout anterior el CTA era el último bloque de la tercera columna: en
 * mobile había que pasar el camino, la grilla de stats, el acordeón de reglas
 * y la nota de "Experto próximamente" para poder desafiar un piso. Acá queda
 * fijo sobre la bottom nav, que es donde el pulgar ya está.
 */
export function TowerActionBar({
  action,
  locale,
  activeBlessings,
  resetAtMs,
}: {
  action: TowerPrimaryAction;
  locale: string;
  activeBlessings: string[];
  /** Epoch ms del próximo domingo 21hs ART; muestra countdown si el CTA está bloqueado. */
  resetAtMs?: number | null;
}) {
  const t = useTranslations("tower");
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!resetAtMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [resetAtMs]);

  const run = () =>
    start(async () => {
      if (action.action === "start_run" || action.action === "restart_run") {
        await startTowerRun(locale);
      } else if (action.action === "challenge_floor" || action.action === "continue_run") {
        await challengeTowerFloor(locale);
      }
    });

  const remainingMs = resetAtMs ? Math.max(0, resetAtMs - now) : 0;
  const timerLabel =
    resetAtMs && !action.enabled && remainingMs > 0
      ? formatTowerCountdown(remainingMs)
      : null;

  return (
    <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-margin-mobile mt-2 border-t border-white/10 bg-[#0b0d13]/95 px-margin-mobile py-2.5 backdrop-blur-xl md:-mx-margin-desktop md:px-margin-desktop xl:bottom-0">
      {activeBlessings.length > 0 && (
        <ul className="mb-2 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {activeBlessings.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold text-violet-200"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
      {timerLabel ? (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <span className="material-symbols-outlined text-[16px]! text-on-surface-variant">
            schedule
          </span>
          <p className="text-[11px] text-on-surface-variant">
            {t("reset.nextIn")}{" "}
            <span className="font-mono font-bold tabular-nums text-white">{timerLabel}</span>
          </p>
        </div>
      ) : null}
      {action.destination ? (
        <GameCtaButton href={action.destination} variant="red" disabled={!action.enabled}>
          {t(action.labelKey)}
        </GameCtaButton>
      ) : (
        <GameCtaButton
          type="button"
          variant="red"
          icon="swords"
          disabled={!action.enabled || pending}
          onClick={run}
        >
          {pending ? t("actions.working") : t(action.labelKey)}
        </GameCtaButton>
      )}
      {action.reasonKey && (
        <p className="mt-1 text-center text-[10px] text-on-surface-variant">
          {t(action.reasonKey)}
        </p>
      )}
    </div>
  );
}

function formatTowerCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
