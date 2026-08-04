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
import { PokeSparks } from "@/components/poke-sparks";
import { TowerAbandonButton, TowerParkButton } from "@/components/tower/tower-ui";
import type { RewardDef } from "@/lib/events/rewards";
import type {
  TowerBlessing,
  TowerBlessingRarity,
  TowerFloor,
  TowerPrimaryAction,
  TowerRunCreature,
} from "@/lib/tower";
import { floorNodeVisual, pokeApiSpriteUrl } from "@/lib/tower/icons";

/* ------------------------------------------------------------------ *
 * Tokens visuales por tipo de piso.
 *
 * El color es la única señal que el jugador lee de un vistazo mientras
 * sube, así que cada tipo tiene el suyo y se usa igual en el riel, en la
 * ficha del piso y en el botón. Un elite y un jefe no pueden verse igual.
 *
 * Acentos de marca vía CSS vars (`theme-colors.css`) — no hex sueltos.
 * ------------------------------------------------------------------ */
const THEME = {
  primary: "var(--color-pokeball-red)",
  secondary: "var(--color-water-blue)",
  tertiary: "var(--color-electric-yellow)",
  muted: "#7c8899",
  abandoned: "#94a3b8",
  hpWarn: "#facc15",
} as const;

const CLEARED_ACCENT = THEME.tertiary;

const FLOOR_TONE: Record<string, { accent: string; icon: string }> = {
  normal: { accent: THEME.muted, icon: "swords" },
  elite: { accent: THEME.secondary, icon: "local_fire_department" },
  boss: { accent: THEME.primary, icon: "skull" },
  rest: { accent: THEME.tertiary, icon: "auto_awesome" },
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
  mend: { icon: "healing", accent: THEME.tertiary },
  second_wind: { icon: "ecg_heart", accent: "#fb923c" },
  tide: { icon: "water_drop", accent: THEME.secondary },
  blaze: { icon: "local_fire_department", accent: "#f97316" },
  grove: { icon: "eco", accent: THEME.tertiary },
  fortune: { icon: "monetization_on", accent: "#f2c000" },
  aegis: { icon: "shield", accent: THEME.secondary },
  rally: { icon: "groups", accent: THEME.primary },
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
  const stagger = ascending.length <= 14;

  return (
    <ol className="relative flex w-full min-w-0 flex-col py-2 sm:py-3">
      {ascending.map((floor, i) => {
        const cleared = floor.floorNumber <= highestCleared || floor.floorNumber < currentFloor;
        const isCurrent = floor.floorNumber === currentFloor;
        const tone = toneFor(floor.type);
        const locked = !cleared && !isCurrent;

        const isLast = i === ascending.length - 1;
        const below = floor.floorNumber - 1;
        const segmentFilled = below <= highestCleared || below < currentFloor;
        const segmentJustClimbed = isCurrent && segmentFilled && justClimbed;

        const isDuo =
          floor.enemies.length >= 2 && floor.type !== "boss" && floor.type !== "rest";

        return (
          <li
            key={floor.id}
            ref={isCurrent ? currentNodeRef : undefined}
            className={`relative flex w-full min-w-0 items-start gap-2.5 py-0.5 sm:gap-3 sm:py-1 ${
              stagger ? "tp-rise" : ""
            }`}
            style={
              (stagger ? { animationDelay: `${i * 40}ms` } : undefined) as CSSProperties
            }
          >
            <div className="relative z-[1] flex w-12 shrink-0 flex-col items-center self-stretch sm:w-14">
              <span
                className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-visible rounded-full border transition sm:h-14 sm:w-14 ${
                  segmentJustClimbed ? "tower-node-reached" : ""
                }`}
                style={
                  {
                    borderColor: isCurrent
                      ? tone.accent
                      : cleared
                        ? `color-mix(in srgb, ${CLEARED_ACCENT} 45%, transparent)`
                        : "rgba(255,255,255,0.12)",
                    borderWidth: isCurrent ? 2 : 1.5,
                    background: isCurrent
                      ? `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${tone.accent} 28%, transparent), #0c0e14 70%)`
                      : cleared
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(8,10,14,0.92)",
                    boxShadow: isCurrent
                      ? `0 0 0 1px color-mix(in srgb, ${tone.accent} 40%, transparent), 0 0 20px color-mix(in srgb, ${tone.accent} 28%, transparent)`
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
                  isCurrent
                    ? "text-white"
                    : cleared
                      ? "text-electric-yellow/70"
                      : "text-white/30"
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

            <div
              className={`relative min-w-0 flex-1 self-start rounded-xl border px-2.5 py-1.5 transition sm:rounded-2xl sm:px-3 sm:py-2 ${
                isCurrent
                  ? "border-white/18 bg-white/[0.06]"
                  : locked
                    ? "border-white/[0.05] bg-white/[0.015] opacity-50"
                    : "border-white/[0.07] bg-black/20"
              }`}
              style={
                isCurrent
                  ? {
                      boxShadow: `inset 0 0 28px color-mix(in srgb, ${tone.accent} 12%, transparent)`,
                    }
                  : undefined
              }
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded-md px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{
                    background: `color-mix(in srgb, ${tone.accent} 16%, transparent)`,
                    color: tone.accent,
                  }}
                >
                  {t(`floorTypes.${floor.type}`)}
                </span>
                {isDuo ? (
                  <span className="rounded-md border border-white/15 bg-white/8 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.14em] text-white/80">
                    2v2
                  </span>
                ) : null}
                {isCurrent ? (
                  <span className="rounded-full bg-pokeball-red/90 px-2 py-px text-[9px] font-black uppercase tracking-wider text-white">
                    {t("path.current")}
                  </span>
                ) : null}
                {cleared && !isCurrent ? (
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-electric-yellow/55">
                    ✓
                  </span>
                ) : null}
              </div>

              {isCurrent ? (
                <>
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-white/70">
                    {t("path.recommendedPc", { pc: floor.recommendedCombatPower })}
                  </p>
                  {floor.modifiers.length > 0 ? (
                    <ul className="mt-1.5 flex flex-wrap gap-1">
                      {floor.modifiers.map((m) => (
                        <li
                          key={m.id}
                          title={t(m.descriptionKey)}
                          className="rounded-md border border-secondary/30 bg-secondary/15 px-1.5 py-0.5 text-[9px] font-semibold text-secondary"
                        >
                          {t(m.nameKey)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-white/35">
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
  const dim = cleared ? "opacity-80 grayscale-[0.35]" : locked ? "opacity-45" : "";

  const checkBadge = cleared ? (
    <span className="material-symbols-outlined absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0c0e14] text-[12px]! font-bold text-electric-yellow ring-1 ring-electric-yellow/40">
      check
    </span>
  ) : null;

  const lockBadge = locked ? (
    <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-[14px]! text-white/35 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
      lock
    </span>
  ) : null;

  // Dobles / elite con 2 enemigos: mostrar ambos sprites en el nodo.
  if (floor.enemies.length >= 2 && floor.type !== "boss" && floor.type !== "rest") {
    const [a, b] = floor.enemies;
    return (
      <>
        <div className={`relative flex h-full w-full items-center justify-center ${dim}`}>
          <Image
            src={pokeApiSpriteUrl(a!.speciesId, "icon")}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="absolute left-0.5 top-1 h-8 w-8 object-contain object-center sm:h-9 sm:w-9"
          />
          <Image
            src={pokeApiSpriteUrl(b!.speciesId, "icon")}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="absolute bottom-0.5 right-0.5 h-8 w-8 object-contain object-center sm:h-9 sm:w-9"
          />
        </div>
        {checkBadge}
        {lockBadge}
      </>
    );
  }

  const visual = floorNodeVisual(floor);

  if (visual.kind === "glyph") {
    return (
      <>
        <span
          className="material-symbols-outlined text-[22px]! sm:text-[24px]!"
          style={{
            color: locked ? "#ffffff40" : accent,
            opacity: cleared ? 0.75 : 1,
          }}
        >
          {visual.icon}
        </span>
        {checkBadge}
        {lockBadge}
      </>
    );
  }

  return (
    <>
      {floor.type === "rest" ? (
        <span aria-hidden className="tower-rest-sparkles pointer-events-none absolute inset-0">
          <span className="tower-rest-spark tower-rest-spark--a" />
          <span className="tower-rest-spark tower-rest-spark--b" />
          <span className="tower-rest-spark tower-rest-spark--c" />
          <span className="tower-rest-spark tower-rest-spark--d" />
        </span>
      ) : null}
      <Image
        src={visual.src}
        alt=""
        width={visual.kind === "pokemon" ? 64 : 56}
        height={visual.kind === "pokemon" ? 64 : 56}
        unoptimized
        className={`relative z-[1] object-contain object-center ${
          visual.kind === "pokemon"
            ? "h-[44px] w-[44px] max-w-none scale-[1.1] sm:h-[50px] sm:w-[50px]"
            : "h-[42px] w-[42px] scale-105 sm:h-[46px] sm:w-[46px]"
        } ${dim} ${floor.type === "rest" ? "drop-shadow-[0_0_10px_rgba(240,171,252,0.45)]" : ""}`}
      />
      {checkBadge}
      {lockBadge}
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
  const glow = filled ? CLEARED_ACCENT : accent;

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
 * Layout: header + squad (protagonista) + loot en franja baja alargada.
 * El botín queda en `pendingLoot` hasta que el jugador lo reclame acá.
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
    kind === "COMPLETED"
      ? THEME.tertiary
      : kind === "ABANDONED"
        ? THEME.abandoned
        : THEME.primary;
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

  const lootStatus = lootClaimed
    ? t("result.lootClaimed")
    : alreadyGranted
      ? t("result.lootAlreadyGranted")
      : t("result.lootHint");

  return (
    <section
      className="relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 28%, transparent)`,
        background: `linear-gradient(165deg, color-mix(in srgb, ${accent} 12%, transparent) 0%, rgba(12,14,20,0.96) 42%, rgba(10,12,18,0.98) 100%)`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-3xl"
        style={{ background: `color-mix(in srgb, ${accent} 22%, transparent)` }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3 px-3.5 pt-3.5 sm:px-4 sm:pt-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            {t(titleKey)}
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/60 sm:text-[13px]">
            {t(bodyKey)}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-white/10 bg-black/35 px-3 py-1.5 text-right backdrop-blur-sm">
          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/40">
            {t("result.floorReached")}
          </p>
          <p className="mt-0.5 font-mono text-[22px] font-black leading-none tabular-nums text-white sm:text-[24px]">
            {floorReached}
          </p>
        </div>
      </div>

      {/* Squad — protagonista, ancho completo */}
      <div className="relative mt-3 px-3.5 sm:mt-3.5 sm:px-4">
        <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 sm:px-3.5 sm:py-3">
          <p className="mb-2 text-[8px] font-bold uppercase tracking-[0.16em] text-white/40">
            {t("result.finalTeam")}
          </p>
          <ul className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {team.map((m) => {
              const down = m.defeated || m.currentHp <= 0;
              const pct = m.maxHp > 0 ? m.currentHp / m.maxHp : 0;
              const hpColor =
                pct > 0.5 ? THEME.tertiary : pct > 0.2 ? THEME.hpWarn : "var(--color-error)";
              return (
                <li
                  key={m.instanceId}
                  title={`${m.nickname ?? m.speciesName} · ${m.currentHp}/${m.maxHp}`}
                  className={`relative flex flex-col items-center rounded-lg border px-1 pb-1 pt-1.5 ${
                    down
                      ? "border-error/30 bg-error/10"
                      : "border-white/[0.1] bg-white/[0.04]"
                  }`}
                >
                  <Image
                    src={m.spriteUrl}
                    alt={m.nickname ?? m.speciesName}
                    width={48}
                    height={48}
                    unoptimized
                    className={`h-9 w-9 object-contain sm:h-10 sm:w-10 ${
                      down ? "opacity-85 grayscale-[0.4]" : ""
                    }`}
                  />
                  {down ? (
                    <span className="material-symbols-outlined absolute right-0 top-0 text-[11px]! text-error drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-[12px]!">
                      skull
                    </span>
                  ) : null}
                  <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(Math.max(0, pct) * 100)}%`,
                        background: down ? "var(--color-error)" : hpColor,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] leading-snug text-white/40 sm:text-[11px]">
            {t("result.teamRestored")}
          </p>
        </div>
      </div>

      {/* Loot — franja baja alargada y chata */}
      <div className="relative mt-2.5 px-3.5 pb-3.5 sm:mt-3 sm:px-4 sm:pb-4">
        <div className="flex min-h-[3.25rem] items-center gap-3 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 sm:min-h-[3.5rem] sm:gap-3.5 sm:px-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-electric-yellow/75">
              {t("result.lootKept")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 [&_.font-mono]:text-white!">
              {loot.length > 0 ? (
                <RewardList rewards={loot} size="sm" unitLabels={unitLabels} />
              ) : (
                <p className="text-[11px] text-white/40">{t("result.lootEmpty")}</p>
              )}
              {!canClaim || lootClaimed || alreadyGranted ? (
                <p className="text-[10px] font-medium text-white/45 sm:text-[11px]">{lootStatus}</p>
              ) : null}
            </div>
          </div>

          {canClaim && !lootClaimed ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => claimTowerLoot(locale, runId))}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-pokeball-red px-3 text-[11px] font-bold uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-50 sm:h-10 sm:px-3.5 sm:text-[12px]"
            >
              <span className="material-symbols-outlined text-[16px]! sm:text-[18px]!">redeem</span>
              {pending ? t("actions.working") : t("result.claimCta")}
            </button>
          ) : lootClaimed ? (
            <span className="material-symbols-outlined shrink-0 text-[20px]! text-electric-yellow/80">
              check_circle
            </span>
          ) : null}
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
          const hpColor =
            pct > 0.5 ? THEME.tertiary : pct > 0.2 ? THEME.hpWarn : "var(--color-error)";
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
    <div className="relative overflow-hidden rounded-2xl border border-electric-yellow/20 bg-[#0a0c12] p-3 sm:p-4">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-electric-yellow) 14%, transparent), transparent 55%)",
        }}
      />

      <div className="relative z-10 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-electric-yellow/90">
          {t("rest.title")}
        </p>
        <p className="mt-1 text-[11px] text-on-surface-variant/80">{t("rest.hint")}</p>
      </div>

      <div className="relative z-10 mt-3 grid grid-cols-2 gap-2 sm:gap-2.5">
        <RestOption
          seed="tower-rest-recover"
          imageSrc="/tower/rest-snorlax.png"
          accent={THEME.tertiary}
          foil="linear-gradient(145deg, color-mix(in srgb, var(--theme-tertiary) 65%, black) 0%, color-mix(in srgb, var(--theme-tertiary) 70%, white) 45%, color-mix(in srgb, var(--theme-tertiary) 55%, black) 100%)"
          wash="radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-electric-yellow) 28%, transparent) 0%, transparent 62%)"
          stat={`+${recoveryPct}%`}
          title={t("rest.recoverTitle")}
          body={t("rest.recoverBody", { pct: recoveryPct })}
          pending={pending}
          active={picked === "recover"}
          dimmed={pending && picked !== "recover"}
          onClick={() => choose("recover")}
        />
        <RestOption
          seed="tower-rest-attune"
          imageSrc="/tower/rest-alakazam.png"
          accent={THEME.secondary}
          foil="linear-gradient(145deg, color-mix(in srgb, var(--theme-secondary) 65%, black) 0%, color-mix(in srgb, var(--theme-secondary) 55%, white) 45%, color-mix(in srgb, var(--theme-secondary) 55%, black) 100%)"
          wash="radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-water-blue) 28%, transparent) 0%, transparent 62%)"
          stat="✦"
          title={t("rest.attuneTitle")}
          body={
            canAttune ? t("rest.attuneBody") : t("rest.attuneUnavailable")
          }
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
  seed,
  imageSrc,
  accent,
  foil,
  wash,
  stat,
  title,
  body,
  pending,
  active,
  dimmed,
  disabled,
  onClick,
}: {
  seed: string;
  imageSrc: string;
  accent: string;
  foil: string;
  wash: string;
  stat: string;
  title: string;
  body: string;
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
      <span className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[0.95rem] bg-[#0a0c12] px-2 pb-3 pt-2.5 sm:px-3.5 sm:pb-4 sm:pt-3">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: wash }} />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-5 -top-6 h-28 w-28 rounded-full opacity-35 blur-2xl transition group-hover:opacity-60"
          style={{ background: accent }}
        />
        <PokeSparks seed={seed} accent={accent} />

        <span className="relative z-10 flex flex-1 flex-col items-center text-center">
          <span
            className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center sm:h-28 sm:w-28"
            style={{
              filter: `drop-shadow(0 0 16px ${accent}55)`,
            }}
          >
            <Image
              src={imageSrc}
              alt=""
              width={128}
              height={128}
              unoptimized
              className="h-[4.75rem] w-[4.75rem] object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] sm:h-28 sm:w-28"
            />
            {active ? (
              <span className="absolute inset-0 flex items-center justify-center bg-[#0a0c12]/45">
                <span className="material-symbols-outlined animate-spin text-[22px]! text-white sm:text-[28px]!">
                  progress_activity
                </span>
              </span>
            ) : null}
          </span>

          <span
            className="mt-1.5 font-mono text-[18px] font-black leading-none tracking-tight sm:mt-2 sm:text-[22px]"
            style={{ color: accent }}
          >
            {stat}
          </span>
          <span className="mt-1.5 text-[12px] font-bold uppercase leading-tight tracking-[0.06em] text-white sm:mt-2 sm:text-[15px]">
            {title}
          </span>
          <span className="mt-1 text-[10px] leading-snug text-white/55 sm:text-[11px]">{body}</span>
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
  canAbandon = false,
  canPark = false,
}: {
  action: TowerPrimaryAction;
  locale: string;
  activeBlessings: string[];
  /** Epoch ms del próximo domingo 21hs ART; muestra countdown si el CTA está bloqueado. */
  resetAtMs?: number | null;
  /** Muestra “Abandonar intento” bajo el CTA cuando hay corrida activa. */
  canAbandon?: boolean;
  /** Muestra “Salir a Aventura” (pausa el ascenso). */
  canPark?: boolean;
}) {
  const t = useTranslations("tower");
  const [pending, start] = useTransition();
  /*
    El countdown no puede usar Date.now() en el primer paint: SSR y cliente
    difieren en ~1s y React tira hydration mismatch. Arrancamos sin reloj y
    lo activamos recién en el efecto.
  */
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!resetAtMs || action.enabled) {
      setNow(null);
      return;
    }
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [resetAtMs, action.enabled]);

  const run = () =>
    start(async () => {
      if (action.action === "start_run" || action.action === "restart_run") {
        await startTowerRun(locale);
      } else if (action.action === "challenge_floor" || action.action === "continue_run") {
        await challengeTowerFloor(locale);
      }
    });

  const showTimer = Boolean(resetAtMs) && !action.enabled;
  const timerLabel = showTimer
    ? now != null
      ? formatTowerCountdown(Math.max(0, resetAtMs! - now))
      : "—"
    : null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-white/10 bg-[#0b0d13]/95 px-margin-mobile pt-2 pb-2.5 backdrop-blur-xl sm:pt-2.5 sm:pb-3 md:px-margin-desktop xl:bottom-0">
      <div className="mx-auto w-full max-w-6xl">
      {activeBlessings.length > 0 && (
        <ul className="mb-1.5 flex gap-1 overflow-x-auto [scrollbar-width:none] sm:mb-2 [&::-webkit-scrollbar]:hidden">
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
        <div className="mb-1.5 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 sm:mb-2 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2">
          <span className="material-symbols-outlined text-[15px]! text-on-surface-variant sm:text-[16px]!">
            schedule
          </span>
          <p className="text-[10px] text-on-surface-variant sm:text-[11px]">
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
        <p className="mt-1.5 pb-0.5 text-center text-[10px] leading-snug text-on-surface-variant">
          {t(action.reasonKey)}
        </p>
      )}
      {canPark ? <TowerParkButton locale={locale} variant="bar" /> : null}
      {canAbandon ? <TowerAbandonButton locale={locale} variant="bar" /> : null}
      </div>
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
