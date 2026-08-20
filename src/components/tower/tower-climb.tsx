"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties } from "react";
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
import { playRewardCollectFx } from "@/lib/loot-fly-fx";
import type { RewardDef } from "@/lib/events/rewards";
import type {
  TowerBlessing,
  TowerBlessingRarity,
  TowerFloor,
  TowerPrimaryAction,
  TowerRunCreature,
} from "@/lib/tower";
import { floorNodeVisual, pokeApiSpriteUrl } from "@/lib/tower/icons";
import { scrollElementIntoViewSafe } from "@/lib/scroll-lock";
import { playUiSfx } from "@/lib/battle-sfx";
import {
  getServerTowerAuto,
  getTowerAuto,
  pickTowerAutoBlessing,
  subscribeTowerAuto,
} from "@/lib/tower-auto";

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

const CLEARED_ACCENT = THEME.secondary;

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

/** Arte circular en `/public/tower/skills` — skill1…skill13. */
function towerSkillSrc(n: number): string {
  // ?v=2 fuerza refresh tras regenerar PNGs con alpha.
  return `/tower/skills/skill${n}.png?v=2`;
}

/** Ícono/arte + acento por bendición (el % usa este color). */
const BLESSING_VISUAL: Record<string, { icon: string; accent: string; src: string }> = {
  vitality: { icon: "favorite", accent: "#fb7185", src: towerSkillSrc(8) },
  swift: { icon: "speed", accent: "#fbbf24", src: towerSkillSrc(2) },
  mend: { icon: "healing", accent: "#4ade80", src: towerSkillSrc(3) },
  second_wind: { icon: "ecg_heart", accent: "#fb923c", src: towerSkillSrc(4) },
  tide: { icon: "water_drop", accent: "#38bdf8", src: towerSkillSrc(5) },
  blaze: { icon: "local_fire_department", accent: "#38bdf8", src: towerSkillSrc(6) },
  grove: { icon: "eco", accent: "#4ade80", src: towerSkillSrc(7) },
  fortune: { icon: "monetization_on", accent: "#c084fc", src: towerSkillSrc(1) },
  aegis: { icon: "shield", accent: "#a78bfa", src: towerSkillSrc(9) },
  rally: { icon: "groups", accent: "#e879f9", src: towerSkillSrc(10) },
};

function blessingVisual(id: string) {
  return (
    BLESSING_VISUAL[id] ?? {
      icon: "auto_awesome",
      accent: "#a78bfa",
      src: towerSkillSrc(1),
    }
  );
}

/** Arte / ícono por modificador de piso. */
const MODIFIER_VISUAL: Record<
  string,
  { icon: string; accent: string; src?: string }
> = {
  sun_field: { icon: "wb_sunny", accent: "#fbbf24", src: towerSkillSrc(11) },
  rain_field: { icon: "water_drop", accent: THEME.secondary, src: towerSkillSrc(12) },
  fire_boost: { icon: "local_fire_department", accent: "#f97316", src: towerSkillSrc(13) },
  // Arte de corazones (skill8): cura ↔ cura reducida.
  heal_cut: { icon: "heart_minus", accent: "#fb7185", src: towerSkillSrc(8) },
  speed_surge: { icon: "speed", accent: "#fbbf24" },
  no_items: { icon: "block", accent: "#94a3b8" },
};

function modifierVisual(id: string) {
  return MODIFIER_VISUAL[id] ?? { icon: "tune", accent: "#a78bfa" };
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

const TOWER_JUST_BLESSING_KEY = "tower:just-blessing";
/** Tiempo para que se vean las tres cartas antes de que AUTO elija. */
const AUTO_BLESSING_PICK_MS = 1100;

type JustBlessingPayload = {
  id: string;
  name: string;
  src: string;
  accent: string;
};

/**
 * Tras elegir una bendición, el redirect remonta /tower. Leemos el payload
 * de sessionStorage, mostramos el arte al centro y lo “aplicamos” volando
 * hasta el chip junto a Equipo del intento.
 */
export function TowerBlessingArrival({
  blessingIds,
}: {
  blessingIds: string[];
}) {
  const t = useTranslations("tower");
  const [payload, setPayload] = useState<JustBlessingPayload | null>(null);
  const [phase, setPhase] = useState<"idle" | "center" | "fly" | "done">("idle");
  const flyerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(TOWER_JUST_BLESSING_KEY);
      if (raw) window.sessionStorage.removeItem(TOWER_JUST_BLESSING_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let data: JustBlessingPayload;
    try {
      data = JSON.parse(raw) as JustBlessingPayload;
    } catch {
      return;
    }
    if (!data?.id || !blessingIds.includes(data.id)) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.requestAnimationFrame(() => {
      setPayload(data);
      setPhase(reduced ? "done" : "center");
    });
    return () => window.cancelAnimationFrame(id);
  }, [blessingIds]);

  useEffect(() => {
    if (phase !== "center" || !payload) return;
    const target = document.querySelector<HTMLElement>(
      `[data-tower-blessing="${payload.id}"]`,
    );
    if (target) {
      scrollElementIntoViewSafe(target, {
        block: "nearest",
        behavior: "smooth",
        preferAppMain: true,
      });
    }
    const id = window.setTimeout(() => setPhase("fly"), 1100);
    return () => window.clearTimeout(id);
  }, [phase, payload]);

  useEffect(() => {
    if (phase !== "fly" || !payload) return;
    const flyer = flyerRef.current;
    const target = document.querySelector<HTMLElement>(
      `[data-tower-blessing="${payload.id}"]`,
    );
    if (!flyer || !target) {
      setPhase("done");
      return;
    }

    const from = flyer.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = Math.max(0.22, to.width / from.width);

    flyer.style.transition =
      "transform 780ms cubic-bezier(0.22, 1, 0.36, 1), opacity 780ms ease";
    flyer.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    flyer.style.opacity = "0.2";

    const id = window.setTimeout(() => setPhase("done"), 820);
    return () => window.clearTimeout(id);
  }, [phase, payload]);

  if (!payload || phase === "idle" || phase === "done") return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
      aria-live="polite"
      aria-label={t("blessing.applied", { name: payload.name })}
    >
      {phase === "center" ? (
        <div aria-hidden className="tower-blessing-arrival-wash absolute inset-0" />
      ) : null}
      <div
        ref={flyerRef}
        className={`relative flex flex-col items-center ${
          phase === "center" ? "tower-blessing-arrival-pop" : ""
        }`}
        style={{ willChange: "transform, opacity" }}
      >
        <div className="relative h-28 w-28 sm:h-32 sm:w-32">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[8%] rounded-full opacity-60 blur-xl"
            style={{ background: payload.accent }}
          />
          <span
            aria-hidden
            className="tower-blessing-arrival-ring absolute inset-[-18%] rounded-full border-2"
            style={{ borderColor: `${payload.accent}66` }}
          />
          <Image
            src={payload.src}
            alt=""
            width={128}
            height={128}
            unoptimized
            className="relative h-full w-full object-contain"
          />
        </div>
        {phase === "center" ? (
          <p className="mt-3 text-center text-[12px] font-bold uppercase tracking-[0.16em] text-white drop-shadow-md">
            {payload.name}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Riel de ascenso
 * ------------------------------------------------------------------ */

/**
 * ¿El jugador acaba de subir un piso, y lo está viendo?
 *
 * Tras una batalla mobile la página abre arriba (banner/botín) y el riel
 * queda fuera de vista: hay que (1) traer el camino al viewport, (2) centrar
 * el nodo en el scroller interno y (3) disparar la animación de subida.
 *
 * El piso visto vive en `sessionStorage` para no celebrar un refresh.
 * Devuelve `false` en el primer render a propósito (hidratación).
 */
function useJustClimbed(currentFloor: number) {
  const [justClimbed, setJustClimbed] = useState(false);
  const currentNodeRef = useRef<HTMLLIElement>(null);
  // `undefined` distingue “todavía no leí sessionStorage” de “no había piso”.
  // No se adelanta al piso actual hasta que la animación realmente comienza:
  // así sobrevive al doble montaje de efectos de React Strict Mode en dev.
  const previousFloorRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (currentFloor < 1) return;

    const KEY = "tower:last-floor";
    if (previousFloorRef.current === undefined) {
      const stored = window.sessionStorage.getItem(KEY);
      previousFloorRef.current = stored == null ? null : Number(stored);
    }
    const previous = previousFloorRef.current;

    const node = currentNodeRef.current;
    if (!node) return;

    const climbed = previous != null && previous < currentFloor;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroller = node.closest<HTMLElement>("[data-tower-rail-scroll]");
    const railSection =
      scroller?.closest<HTMLElement>("section") ?? scroller ?? node;

    const centerInScroller = (behavior: ScrollBehavior) => {
      if (!scroller) {
        scrollElementIntoViewSafe(node, { block: "center", behavior, preferAppMain: true });
        return;
      }
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
        behavior,
      });
    };

    const bringRailIntoView = (behavior: ScrollBehavior) => {
      scrollElementIntoViewSafe(railSection, {
        block: climbed ? "center" : "nearest",
        behavior,
        preferAppMain: true,
      });
    };

    const behavior: ScrollBehavior = climbed && !reduced ? "smooth" : "auto";

    // Doble rAF: espera layout (imágenes/nodos) antes de medir.
    let cancel = false;
    const timers: number[] = [];
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancel) return;
        bringRailIntoView(behavior);
        timers.push(
          window.setTimeout(
            () => {
              if (cancel) return;
              centerInScroller(behavior);
            },
            climbed && !reduced ? 280 : 0,
          ),
        );
      });
    });

    if (!climbed) {
      previousFloorRef.current = currentFloor;
      window.sessionStorage.setItem(KEY, String(currentFloor));
      return () => {
        cancel = true;
        timers.forEach((id) => window.clearTimeout(id));
      };
    }

    // No dependemos de IntersectionObserver: en mobile el nodo puede
    // seguir midiendo "fuera" mientras el smooth scroll termina.
    timers.push(
      window.setTimeout(() => {
        if (!cancel) {
          previousFloorRef.current = currentFloor;
          window.sessionStorage.setItem(KEY, String(currentFloor));
          setJustClimbed(true);
          if (!reduced) playUiSfx("levelUp");
        }
      }, reduced ? 0 : 1100),
    );
    timers.push(
      window.setTimeout(() => {
        if (!cancel) setJustClimbed(false);
      }, reduced ? 1200 : 4800),
    );

    return () => {
      cancel = true;
      timers.forEach((id) => window.clearTimeout(id));
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
  const currentTone = toneFor(
    floors.find((f) => f.floorNumber === currentFloor)?.type ?? "normal",
  );

  return (
    <div className="relative">
      {justClimbed ? (
        <div
          aria-live="polite"
          className="tower-climb-toast pointer-events-none absolute inset-x-0 top-1 z-30 flex justify-center px-2 sm:top-2"
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#0b0d13]/92 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md"
            style={{
              boxShadow: `0 8px 28px rgba(0,0,0,0.45), 0 0 24px color-mix(in srgb, ${currentTone.accent} 35%, transparent)`,
            }}
          >
            <span
              className="material-symbols-outlined text-[16px]!"
              style={{ color: THEME.primary }}
            >
              arrow_upward
            </span>
            {t("path.climbedTo", { n: currentFloor })}
          </span>
        </div>
      ) : null}
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
            className={`relative flex w-full min-w-0 items-start gap-2.5 py-1 sm:gap-3 sm:py-1.5 ${
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
                      ? "text-water-blue/75"
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
              className={`relative flex min-w-0 flex-1 items-stretch gap-2.5 self-start pt-0.5 sm:gap-3 ${
                locked ? "opacity-40" : cleared && !isCurrent ? "opacity-70" : ""
              } ${isCurrent && justClimbed ? "tower-floor-ticket--climbed" : ""}`}
            >
              <span
                aria-hidden
                className="w-0.5 shrink-0 self-stretch rounded-full"
                style={{
                  background: isCurrent
                    ? tone.accent
                    : cleared
                      ? `color-mix(in srgb, ${CLEARED_ACCENT} 55%, transparent)`
                      : `color-mix(in srgb, ${tone.accent} 35%, transparent)`,
                  boxShadow: isCurrent ? `0 0 10px ${tone.accent}66` : undefined,
                  opacity: locked ? 0.45 : 1,
                }}
              />

              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.18em] sm:text-[11px]"
                    style={{
                      color: isCurrent
                        ? tone.accent
                        : locked
                          ? "rgba(255,255,255,0.35)"
                          : `color-mix(in srgb, ${tone.accent} 85%, white)`,
                    }}
                  >
                    {t(`floorTypes.${floor.type}`)}
                  </span>
                  {isDuo ? (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      · 2v2
                    </span>
                  ) : null}
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/85">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background: THEME.primary,
                          boxShadow: `0 0 8px ${THEME.primary}`,
                        }}
                      />
                      {t("path.current")}
                    </span>
                  ) : null}
                  {cleared && !isCurrent ? (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-water-blue/60">
                      {t("path.cleared")}
                    </span>
                  ) : null}
                </div>

                <p
                  className={`mt-0.5 font-mono tabular-nums tracking-tight ${
                    isCurrent
                      ? "text-[13px] font-bold text-white/90 sm:text-[14px]"
                      : "text-[11px] text-white/40"
                  }`}
                >
                  {t("path.recommendedPc", { pc: floor.recommendedCombatPower })}
                </p>

                {isCurrent && floor.modifiers.length > 0 ? (
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug text-white/65">
                    {floor.modifiers.map((m, idx) => {
                      const mod = modifierVisual(m.id);
                      return (
                        <span key={m.id} className="inline-flex items-center gap-1" title={t(m.descriptionKey)}>
                          {idx > 0 ? <span className="mr-0.5 text-white/25">·</span> : null}
                          {mod.src ? (
                            <Image
                              src={mod.src}
                              alt=""
                              width={20}
                              height={20}
                              unoptimized
                              className="h-5 w-5 shrink-0 object-contain"
                            />
                          ) : (
                            <span
                              className="material-symbols-outlined text-[14px]!"
                              style={{ color: mod.accent }}
                            >
                              {mod.icon}
                            </span>
                          )}
                          {t(m.nameKey)}
                        </span>
                      );
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
    </div>
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
    <span className="material-symbols-outlined absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0c0e14] text-[12px]! font-bold text-water-blue ring-1 ring-water-blue/45">
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
  // Tramos superados: primary flúor. El resto usa el acento del piso de abajo.
  const glow = filled ? THEME.primary : accent;

  return (
    /*
      `min-h` además de `flex-1`: medido, sin él el tramo colapsa a 0px en los
      pisos cuya ficha es más baja que el nodo —que son casi todos, porque sólo
      el piso actual despliega modificadores—. El mínimo garantiza el tramo
      visible y de paso separa los nodos entre sí.
    */
    <span aria-hidden className="relative min-h-[30px] w-[4px] flex-1 self-center">
      {/* Vía */}
      <span className="absolute inset-0 rounded-full border border-white/[0.06] bg-white/[0.08]" />

      {/* Relleno. Sin `animate` queda puesto de una: los tramos viejos no
          tienen que volver a llenarse en cada render. */}
      {filled && (
        <span
          className={`absolute inset-x-0 bottom-0 top-0 origin-bottom rounded-full ${
            animate ? "tower-climb-fill" : ""
          }`}
          style={{
            background: `linear-gradient(to top, ${glow}88 0%, #ffffff 55%, ${glow} 100%)`,
            boxShadow: `0 0 7px ${glow}, 0 0 16px ${glow}dd, 0 0 28px ${glow}88`,
          }}
        />
      )}

      {animate && (
        <span
          className="tower-climb-spark absolute left-1/2 h-[11px] w-[11px] rounded-full border border-white/80"
          style={{
            background: "white",
            boxShadow: `0 0 8px white, 0 0 16px ${glow}, 0 0 30px ${glow}`,
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
 * Botín del ascenso + pago del próximo piso.
 * Los intentos van aparte (`TowerAttemptsChip`) para no robarle ancho a las
 * recompensas en desktop.
 */
export function TowerRunStatus({
  earned,
  next,
  hasFirstClear,
  unitLabels,
}: {
  earned: RewardDef[];
  next: RewardDef[];
  hasFirstClear: boolean;
  unitLabels: { coins: string; energy: string };
}) {
  const t = useTranslations("tower");

  return (
    <div
      className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.1]"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 45%, rgba(0,0,0,0.22) 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <LootLane
        label={t("loot.earnedTitle")}
        accent="var(--color-pokeball-red)"
        empty={earned.length === 0 ? t("loot.earnedEmpty") : null}
      >
        {earned.length > 0 ? (
          <RewardList rewards={earned} size="sm" unitLabels={unitLabels} />
        ) : null}
      </LootLane>

      <LootLane
        label={t("loot.nextTitle")}
        accent="var(--theme-secondary)"
        badge={hasFirstClear ? t("loot.firstClear") : null}
        className="border-l border-white/[0.07]"
      >
        {next.length > 0 ? (
          <RewardList rewards={next} size="sm" unitLabels={unitLabels} />
        ) : (
          <p className="text-[10px] text-on-surface-variant/45">—</p>
        )}
      </LootLane>
    </div>
  );
}

/**
 * Intentos semanales en chip compacto.
 * Con un ascenso activo el cupo ya se descontó (`remaining === 0`), pero el
 * ícono tiene que verse vivo: ese intento se está usando ahora.
 */
export function TowerAttemptsChip({
  remaining,
  max,
  inProgress = false,
}: {
  remaining: number;
  max: number;
  inProgress?: boolean;
}) {
  const t = useTranslations("tower");
  const lit = Math.min(max, remaining + (inProgress ? 1 : 0));
  const label = `${remaining}/${max}`;

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-black/40 py-0.5 pl-0.5 pr-2 backdrop-blur-sm"
      title={`${t("status.attempts")} · ${t("status.attemptsHint")}`}
      role="img"
      aria-label={`${t("status.attempts")}: ${label}${inProgress ? ` (${t("status.active")})` : ""}`}
    >
      <span className="flex items-center">
        {Array.from({ length: max }, (_, i) => {
          const alive = i < lit;
          return (
            <span
              key={i}
              className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center ${
                alive ? "" : "opacity-30 grayscale"
              }`}
            >
              <Image
                src="/tower/poke-health-icon.png"
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 object-contain mix-blend-screen"
                unoptimized
              />
            </span>
          );
        })}
      </span>
      <span className="font-mono text-[10px] font-bold tabular-nums text-white/80">
        {label}
      </span>
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
    <div className={`relative min-w-0 px-2.5 py-2 sm:px-3 sm:py-2.5 ${className}`}>
      <span
        aria-hidden
        className="absolute inset-x-2.5 top-0 h-[2px] sm:inset-x-0"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accent}99 40%, ${accent}66 70%, transparent 100%)`,
        }}
      />
      <div className="mb-1 flex flex-wrap items-center gap-1 sm:mb-1.5 sm:gap-1.5">
        <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/65 sm:text-[8px] sm:tracking-[0.16em]">
          {label}
        </p>
        {badge ? (
          <span className="rounded bg-violet-500/25 px-1 py-px text-[6px] font-black uppercase tracking-wider text-violet-200 sm:px-1.5 sm:text-[7px]">
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
 * Pantalla de resultado tipo juego: piso como héroe, lineup, botín con sello.
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

  const coinLoot = loot.find((r): r is Extract<RewardDef, { kind: "coins" }> => r.kind === "coins");
  const otherLoot = loot.filter((r) => r.kind !== "coins");
  const coinAmount = coinLoot?.amount ?? null;

  return (
    <section
      className="tower-result relative isolate overflow-hidden rounded-2xl px-3 py-3 sm:px-4 sm:py-5"
      style={
        {
          "--tower-result-accent": accent,
        } as CSSProperties
      }
    >
      <span aria-hidden className="tower-result__glow pointer-events-none absolute inset-0" />

      {/* Status + floor hero */}
      <div className="relative flex flex-col items-center text-center">
        <p className="tower-result__status">
          {t(titleKey)}
        </p>

        <div className="relative mt-2 flex flex-col items-center sm:mt-3">
          <span
            aria-hidden
            className="tower-result__ring pointer-events-none absolute left-1/2 top-1/2 h-[5.25rem] w-[5.25rem] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-24 sm:w-24"
          />
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/40 sm:block hidden">
            {t("result.floorReached")}
          </p>
          <p className="tower-result__floor mt-0 text-[2.7rem] leading-none tracking-[0.02em] text-white sm:mt-1 sm:text-[3.6rem]">
            {floorReached}
          </p>
        </div>

        <p className="mt-3 hidden w-full truncate px-1 text-center text-[12px] leading-none text-white/50 sm:block sm:text-[13px]">
          {t(bodyKey)}
        </p>
      </div>

      {/* Lineup */}
      <div className="relative mt-3.5 sm:mt-5">
        <ul className="flex items-end justify-center gap-1 sm:gap-1.5">
          {team.map((m, i) => {
            const down = m.defeated || m.currentHp <= 0;
            const pct = m.maxHp > 0 ? m.currentHp / m.maxHp : 0;
            return (
              <li
                key={m.instanceId}
                title={`${m.nickname ?? m.speciesName} · ${m.currentHp}/${m.maxHp}`}
                className="tower-result__mon relative flex min-w-0 flex-1 flex-col items-center"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute bottom-1 h-3.5 w-10 rounded-[100%] opacity-50 blur-md"
                  style={{
                    background: down
                      ? "color-mix(in srgb, var(--color-error) 55%, transparent)"
                      : "color-mix(in srgb, var(--tower-result-accent) 40%, transparent)",
                  }}
                />
                <Image
                  src={m.spriteUrl}
                  alt={m.nickname ?? m.speciesName}
                  width={72}
                  height={72}
                  unoptimized
                  className={`relative z-[1] h-14 w-14 object-contain sm:h-[3.35rem] sm:w-[3.35rem] ${
                    down ? "opacity-70 grayscale-[0.65] brightness-90" : ""
                  }`}
                />
                {down ? (
                  <span className="material-symbols-outlined absolute -right-0.5 -top-0.5 z-[2] text-[14px]! leading-none text-error drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                    skull
                  </span>
                ) : null}
                <div className="relative z-[1] mt-1 h-1 w-[78%] overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(Math.max(0, pct) * 100)}%`,
                      background: down
                        ? "var(--color-error)"
                        : pct > 0.5
                          ? "#21CEA1"
                          : pct > 0.2
                            ? THEME.hpWarn
                            : "var(--color-error)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Loot — premio protagonista */}
      <div className="relative mt-3.5 flex flex-col items-center sm:mt-5">
        {loot.length === 0 ? (
          <p className="text-[12px] text-white/40">{t("result.lootEmpty")}</p>
        ) : (
          <div className="relative flex items-center gap-2.5">
            {coinAmount != null ? (
              <>
                <Image
                  src="/items/hd/poke-coin-bundle-s.png"
                  alt=""
                  width={48}
                  height={48}
                  className={`h-14 w-14 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)] sm:h-11 sm:w-11 ${
                    lootClaimed ? "opacity-70" : ""
                  }`}
                  unoptimized
                />
                <span
                  className={`tower-result__loot-n text-[1.75rem] leading-none tracking-[0.04em] tabular-nums sm:text-[1.85rem] ${
                    lootClaimed ? "text-white/55" : "text-white"
                  }`}
                >
                  {coinAmount.toLocaleString()}
                </span>
              </>
            ) : (
              <RewardList rewards={loot} size="md" unitLabels={unitLabels} />
            )}
          </div>
        )}

        {otherLoot.length > 0 && coinAmount != null ? (
          <div className="mt-2">
            <RewardList rewards={otherLoot} size="sm" unitLabels={unitLabels} />
          </div>
        ) : null}

        {lootClaimed ? (
          <p className="tower-result__claimed mt-2">
            {t("result.lootClaimed")}
          </p>
        ) : !canClaim || alreadyGranted ? (
          <p className="mt-2 text-center text-[11px] leading-snug text-white/45">
            {lootStatus}
          </p>
        ) : (
          <GameCtaButton
            type="button"
            variant="gold"
            className="tower-cta game-cta--gold mt-3 w-full max-w-xs"
            disabled={pending}
            onClick={(e) => {
              // El FX sale del botón antes de invocar la acción: `claimTowerLoot`
              // redirige a /tower, así que después del await ya no hay dónde
              // anclar el vuelo. El bundle es el mismo que acredita el server.
              const r = e.currentTarget.getBoundingClientRect();
              playRewardCollectFx(loot, {
                x: r.left + r.width / 2,
                y: r.top + r.height / 2,
              });
              start(async () => claimTowerLoot(locale, runId));
            }}
          >
            {pending ? t("actions.working") : t("result.claimCta")}
          </GameCtaButton>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Equipo del ascenso
 * ------------------------------------------------------------------ */

export function TowerSquad({
  team,
  blessings = [],
}: {
  team: TowerRunCreature[];
  blessings?: { id: string; name: string }[];
}) {
  const t = useTranslations("tower");
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <p className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/70">
          {t("team.title")}
        </p>
        {blessings.length > 0 ? (
          <ul
            className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={t("blessing.active")}
          >
            {blessings.map((b, index) => {
              const visual = blessingVisual(b.id);
              return (
                <li key={`${b.id}:${index}`} title={b.name} data-tower-blessing={b.id}>
                  <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-10 sm:w-10">
                    <Image
                      src={visual.src}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-full w-full object-contain"
                    />
                    <span className="sr-only">{b.name}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
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
  teamHpPct,
}: {
  blessings: TowerBlessing[];
  locale: string;
  teamHpPct: number;
}) {
  const t = useTranslations("tower");
  const auto = useSyncExternalStore(
    subscribeTowerAuto,
    getTowerAuto,
    getServerTowerAuto,
  );
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const pickingRef = useRef(false);

  const pick = useCallback((b: TowerBlessing) => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    const visual = blessingVisual(b.id);
    try {
      window.sessionStorage.setItem(
        TOWER_JUST_BLESSING_KEY,
        JSON.stringify({
          id: b.id,
          name: t(b.nameKey),
          src: visual.src,
          accent: visual.accent,
        }),
      );
    } catch {
      /* private mode / quota */
    }
    setPicked(b.id);
    start(async () => chooseTowerBlessing(b.id, locale));
  }, [locale, start, t]);

  useEffect(() => {
    if (!auto) return;
    const best = pickTowerAutoBlessing(blessings, teamHpPct);
    if (!best) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => {
      if (!getTowerAuto()) return;
      pick(best);
    }, reduced ? 280 : AUTO_BLESSING_PICK_MS);
    return () => window.clearTimeout(id);
  }, [auto, blessings, pick, teamHpPct]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/85 px-2 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.75rem)] pt-4 backdrop-blur-md sm:items-center sm:p-4 sm:pb-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(124,58,237,0.18),transparent_55%)]"
      />

      <div className="tp-rise relative my-auto w-full max-w-3xl">
        <div className="mb-3.5 text-center sm:mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300/90">
            {t("blessing.pickTitle")}
          </p>
          <p className="mt-1 text-[11px] text-on-surface-variant/80 sm:mt-1.5 sm:text-label-sm">
            {t("blessing.pickHint")}
          </p>
        </div>

        <ul className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
          {blessings.map((b, i) => {
            const foil = RARITY_FOIL[b.rarity];
            const visual = blessingVisual(b.id);
            const stat = blessingStatLabel(b);
            const isPicked = picked === b.id;
            const dimmed = pending && !isPicked;
            const inviting = !pending;

            return (
              <li key={b.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => pick(b)}
                  style={
                    {
                      background: foil.foil,
                      animationDelay: inviting ? `${i * 280}ms` : `${i * 80}ms`,
                      "--blessing-glow": foil.glow,
                    } as CSSProperties
                  }
                  className={`tower-blessing-card tp-rise group relative block w-full rounded-2xl p-[2px] text-left transition duration-200 disabled:cursor-wait active:scale-[0.985] ${
                    inviting ? "tower-blessing-card--invite" : ""
                  } ${
                    dimmed ? "scale-[0.98] opacity-35" : "hover:-translate-y-0.5 hover:scale-[1.01] sm:hover:-translate-y-1 sm:hover:scale-[1.02]"
                  } ${isPicked ? "scale-[1.01] sm:scale-[1.02]" : ""}`}
                >
                  <span className="relative flex overflow-hidden rounded-[0.95rem] bg-[#0a0c12]">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{ background: foil.wash }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-35 blur-2xl transition group-hover:opacity-60"
                      style={{ background: visual.accent }}
                    />

                    {/* Mobile: fila un poco más generosa. Desktop: card vertical. */}
                    <span className="relative z-10 flex w-full items-center gap-3.5 px-3.5 py-3.5 sm:flex-col sm:items-center sm:gap-0 sm:px-3.5 sm:pb-3.5 sm:pt-3 sm:text-center">
                      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center sm:mt-2 sm:h-[4.5rem] sm:w-[4.5rem]">
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-[12%] rounded-full opacity-50 blur-md"
                          style={{ background: visual.accent }}
                        />
                        {/* overflow+rounded clips residual square corners; no CSS filter on the PNG (drop-shadow paints a box). */}
                        <span className="relative h-16 w-16 overflow-hidden rounded-full sm:h-[4.5rem] sm:w-[4.5rem]">
                          <Image
                            src={visual.src}
                            alt=""
                            width={72}
                            height={72}
                            unoptimized
                            className="h-full w-full object-contain"
                          />
                        </span>
                        {isPicked ? (
                          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
                            <span className="material-symbols-outlined animate-spin text-[22px]! text-white">
                              progress_activity
                            </span>
                          </span>
                        ) : null}
                      </span>

                      <span className="min-w-0 flex-1 sm:mt-2.5 sm:flex sm:w-full sm:flex-col sm:items-center">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:flex-col sm:gap-1">
                          <span
                            className={`inline-flex w-fit items-center rounded border px-1.5 py-px text-[8px] font-black uppercase tracking-[0.14em] sm:text-[9px] sm:tracking-[0.16em] ${foil.chip}`}
                          >
                            {t(`blessing.rarity.${b.rarity}`)}
                          </span>
                          {stat ? (
                            <span
                              className="font-mono text-[22px] font-black leading-none tracking-tight tabular-nums sm:text-[24px]"
                              style={{ color: visual.accent }}
                            >
                              {stat}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-[15px] font-bold leading-tight text-white sm:mt-2 sm:text-[15px]">
                          {t(b.nameKey)}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-white/55 sm:mt-1 sm:text-[11px]">
                          {t(b.descriptionKey)}
                        </span>
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {pending ? (
          <p className="mt-3 text-center text-[11px] text-on-surface-variant sm:mt-4 sm:text-label-sm">
            {t("actions.working")}
          </p>
        ) : (
          <p className="tower-blessing-pick-hint mt-3 text-center text-[11px] text-white/55 sm:mt-3 sm:text-[10px] sm:text-white/40">
            {t("blessing.pickTap")}
          </p>
        )}
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
 * Overlay fijo (como el draft de bendiciones): en mobile la elección vivía
 * enterrada al fondo del aside y no se veía. Curarse o sintonizar quedan
 * delante del camino, con el mismo peso visual que elegir un buff.
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
  const inviting = !pending;

  const choose = (choice: TowerRestChoice) => {
    setPicked(choice);
    start(async () => applyTowerRest(locale, choice));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/85 px-2 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.75rem)] pt-4 backdrop-blur-md sm:items-center sm:p-4 sm:pb-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_28%,rgba(253,224,71,0.14),transparent_55%)]"
      />

      <div className="tp-rise relative my-auto w-full max-w-lg">
        <div className="mb-3.5 text-center sm:mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-electric-yellow/90">
            {t("rest.title")}
          </p>
          <p className="mt-1 text-[11px] text-on-surface-variant/80 sm:mt-1.5 sm:text-label-sm">
            {t("rest.hint")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
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
            inviting={inviting}
            inviteDelay={0}
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
            inviting={inviting && canAttune}
            inviteDelay={280}
            onClick={() => choose("attune")}
          />
        </div>

        {lowHp ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2">
            <span className="material-symbols-outlined mt-0.5 text-[16px]! text-amber-300">
              warning
            </span>
            <p className="text-[11px] leading-snug text-amber-100/90">
              {t("rest.lowHpWarning")}
            </p>
          </div>
        ) : null}

        {pending ? (
          <p className="mt-3 text-center text-[11px] text-on-surface-variant sm:mt-4 sm:text-label-sm">
            {t("actions.working")}
          </p>
        ) : (
          <p className="tower-blessing-pick-hint mt-3 text-center text-[11px] text-white/55 sm:text-[10px] sm:text-white/40">
            {t("blessing.pickTap")}
          </p>
        )}
      </div>
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
  inviting,
  inviteDelay = 0,
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
  inviting?: boolean;
  inviteDelay?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={onClick}
      style={
        {
          background: foil,
          "--rest-glow": `${accent}66`,
          "--blessing-glow": `${accent}88`,
          animationDelay: inviting ? `${inviteDelay}ms` : undefined,
        } as CSSProperties
      }
      className={`tower-blessing-card group relative block w-full rounded-2xl p-[2px] text-left transition duration-200 disabled:cursor-not-allowed active:scale-[0.985] ${
        inviting ? "tower-blessing-card--invite" : ""
      } ${
        dimmed || disabled
          ? "opacity-40"
          : "hover:-translate-y-0.5 hover:scale-[1.015]"
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
 * Acción principal del hub de Torre.
 * En flujo (no fixed): scrollea con la pantalla; el CTA sigue siendo
 * game-cta rojo al estilo hub.
 */
export function TowerActionBar({
  action,
  locale,
  difficultyId = "normal",
  resetAtMs,
  canAbandon = false,
  canPark = false,
}: {
  action: TowerPrimaryAction;
  locale: string;
  difficultyId?: string;
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
    if (!resetAtMs || action.enabled) return;
    const tick = () => setNow(Date.now());
    const frame = window.requestAnimationFrame(tick);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(id);
    };
  }, [resetAtMs, action.enabled]);

  const run = () =>
    start(async () => {
      if (action.action === "start_run" || action.action === "restart_run") {
        await startTowerRun(locale, difficultyId);
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
    <div className="space-y-2">
      {timerLabel ? (
        // Timer integrado al propio CTA (no una línea aparte arriba): misma
        // carcasa `game-cta` que el botón de saltar cooldown de gimnasios.
        <button
          type="button"
          disabled
          aria-label={`${t(action.labelKey)} — ${t("reset.nextIn")} ${timerLabel}`}
          className="game-cta game-cta--red game-cta--disabled tower-cta min-w-0 w-full flex-wrap gap-x-2 gap-y-1 px-3 sm:gap-2.5"
        >
          <span className="game-cta__label max-w-full text-center leading-none">
            {t(action.labelKey)}
          </span>
          <span aria-hidden className="hidden h-4 w-px shrink-0 bg-white/30 sm:block" />
          <span className="inline-flex shrink-0 items-center gap-1 font-sans text-[12px] font-semibold tabular-nums tracking-normal text-white normal-case sm:text-[13px]">
            <span className="material-symbols-outlined text-[15px]! opacity-90">
              schedule
            </span>
            <span className="font-mono">{timerLabel}</span>
          </span>
        </button>
      ) : action.destination ? (
        <GameCtaButton href={action.destination} variant="red" className="tower-cta" disabled={!action.enabled}>
          {t(action.labelKey)}
        </GameCtaButton>
      ) : (
        <GameCtaButton
          type="button"
          variant="red"
          className="tower-cta"
          disabled={!action.enabled || pending}
          onClick={run}
        >
          {pending ? t("actions.working") : t(action.labelKey)}
        </GameCtaButton>
      )}
      {action.reasonKey && (
        <p className="hidden px-1 text-center text-[11px] leading-snug text-white/50 sm:block">
          {t(action.reasonKey)}
        </p>
      )}
      {canPark || canAbandon ? (
        <div className="flex items-center justify-center gap-5 pt-0.5">
          {canPark ? <TowerParkButton locale={locale} variant="bar" /> : null}
          {canAbandon ? <TowerAbandonButton locale={locale} variant="bar" /> : null}
        </div>
      ) : null}
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
