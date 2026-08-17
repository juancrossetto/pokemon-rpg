"use client";

/**
 * Intro pre-combate estilo Clash Royale: banners del rival (izq →) y del
 * jugador (← der) se cruzan mientras el campo se arma detrás; VS en el centro;
 * luego salen por donde entraron y ceden al send-out de la ball.
 *
 * Cada card muestra identidad de entrenador (nombre, nivel, insignia PvP) y
 * la fila del equipo — sin nombres de especies.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { playBattleSfx } from "@/lib/battle-sfx";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { PokemonImage } from "@/components/pokemon-image";
import { PvpRankBadge } from "@/components/pvp/pvp-rank-badge";
import { isNpcTrainerPixelPortraitUrl } from "@/lib/avatars";
import type { PvpDivision, PvpTier } from "@/lib/pvp/tiers";

export type BattleVsMode = "wild" | "gym" | "pvp" | "tower";

export type BattleVsTeamMon = {
  spriteUrl: string;
  fainted?: boolean;
};

export type BattleVsSide = {
  name: string;
  portraitUrl: string | null;
  /** Nivel de entrenador (tope del equipo) o del salvaje. */
  level: number;
  team: BattleVsTeamMon[];
  pvpTier: PvpTier | null;
  pvpDivision: PvpDivision | null;
};

type Phase = "enter" | "hold" | "exit" | "gone";

/*
  Tiempos en reloj real — NO pasar por scaledDelay. La velocidad de batalla
  acelera el combate, no esta cinemática; si no, a 2×/3× desaparece.
*/
const ENTER_MS = 900;
const HOLD_MS = 1800;
const EXIT_MS = 750;
/** Pop del VS cuando los banners ya están casi en sitio. */
const VS_POP_AT_MS = 620;

/** Cadena de farm: intro más corta (~1.5s) sin perder el gesto. */
const SHORT_ENTER_MS = 480;
const SHORT_HOLD_MS = 700;
const SHORT_EXIT_MS = 420;
const SHORT_VS_POP_AT_MS = 320;

export function BattleVsIntro({
  mode,
  player,
  foe,
  placeLabel,
  variant = "full",
  onComplete,
}: {
  mode: BattleVsMode;
  player: BattleVsSide;
  foe: BattleVsSide;
  /** Ruta / gimnasio / piso — opcional bajo el VS. */
  placeLabel?: string | null;
  /** `short` = farm/rematch en la misma zona. */
  variant?: "full" | "short";
  onComplete: () => void;
}) {
  const t = useTranslations("battle");
  const tPvpTiers = useTranslations("pvp.tiers");
  const [phase, setPhase] = useState<Phase>("enter");
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setPhase("gone");
      onCompleteRef.current();
    };

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      const id = window.setTimeout(finish, 400);
      return () => clearTimeout(id);
    }

    const enter = variant === "short" ? SHORT_ENTER_MS : ENTER_MS;
    const hold = variant === "short" ? SHORT_HOLD_MS : HOLD_MS;
    const exit = variant === "short" ? SHORT_EXIT_MS : EXIT_MS;
    const vsPop = variant === "short" ? SHORT_VS_POP_AT_MS : VS_POP_AT_MS;

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    at(vsPop, () => playBattleSfx("badge"));
    at(enter, () => setPhase("hold"));
    at(enter + hold, () => setPhase("exit"));
    at(enter + hold + exit, finish);

    return () => {
      for (const id of timers) clearTimeout(id);
    };
  }, [variant]);

  if (phase === "gone") return null;

  const modeLabel =
    mode === "pvp"
      ? t("vsModePvp")
      : mode === "gym"
        ? t("vsModeGym")
        : mode === "tower"
          ? t("vsModeTower")
          : t("vsModeWild");

  const phaseClass =
    phase === "enter"
      ? "is-enter"
      : phase === "hold"
        ? "is-hold"
        : "is-exit";

  const tierLabel = (tier: PvpTier | null) =>
    tier && tPvpTiers.has(tier) ? tPvpTiers(tier) : tier ?? "";

  return (
    <div
      className={`battle-vs-intro ${phaseClass}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("vsAria", { foe: foe.name, player: player.name })}
    >
      <div className="battle-vs-intro__veil" aria-hidden />

      <VsBanner
        side="foe"
        name={foe.name}
        portraitUrl={foe.portraitUrl}
        levelLabel={t("level", { level: foe.level })}
        team={foe.team}
        pvpTier={foe.pvpTier}
        pvpDivision={foe.pvpDivision}
        pvpLabel={tierLabel(foe.pvpTier)}
      />

      <div className="battle-vs-intro__center">
        <div className="battle-vs-intro__vs" aria-hidden>
          <span className="battle-vs-intro__vs-text">{t("vsLabel")}</span>
        </div>
        <p className="battle-vs-intro__mode">{modeLabel}</p>
        {placeLabel ? (
          <p className="battle-vs-intro__place">{placeLabel}</p>
        ) : null}
      </div>

      <VsBanner
        side="player"
        name={player.name}
        portraitUrl={player.portraitUrl}
        levelLabel={t("level", { level: player.level })}
        team={player.team}
        pvpTier={player.pvpTier}
        pvpDivision={player.pvpDivision}
        pvpLabel={tierLabel(player.pvpTier)}
      />
    </div>
  );
}

function VsBanner({
  side,
  name,
  portraitUrl,
  levelLabel,
  team,
  pvpTier,
  pvpDivision,
  pvpLabel,
}: {
  side: "foe" | "player";
  name: string;
  portraitUrl: string | null;
  levelLabel: string;
  team: BattleVsTeamMon[];
  pvpTier: PvpTier | null;
  pvpDivision: PvpDivision | null;
  pvpLabel: string;
}) {
  const showAvatar = Boolean(portraitUrl) || side === "player";
  const isVsArt = Boolean(portraitUrl?.includes("/trainers/vs/"));
  const isPixelTrainer = isNpcTrainerPixelPortraitUrl(portraitUrl);

  return (
    <div
      className={`battle-vs-banner battle-vs-banner--${side}`}
      data-side={side}
    >
      <div className="battle-vs-banner__inner">
        {showAvatar ? (
          <div
            className={`battle-vs-banner__avatar${isVsArt ? " battle-vs-banner__avatar--vs" : ""}`}
          >
            <TrainerAvatar
              name={name}
              src={portraitUrl}
              size="2xl"
              framed
              contain={side === "foe" || isVsArt}
              pixel={isPixelTrainer}
            />
          </div>
        ) : null}

        <div className="battle-vs-banner__content">
          <div className="battle-vs-banner__id">
            <p className="battle-vs-banner__name truncate">{name}</p>
            <div className="battle-vs-banner__meta">
              {pvpTier ? (
                <span className="battle-vs-banner__rank" title={pvpLabel}>
                  <PvpRankBadge
                    tier={pvpTier}
                    division={pvpDivision ?? undefined}
                    label={pvpLabel}
                    size="sm"
                    showLabel={false}
                    className="battle-vs-banner__rank-badge"
                  />
                </span>
              ) : null}
              <span className="battle-vs-banner__level">{levelLabel}</span>
            </div>
          </div>

          {team.length > 0 ? (
            <ul className="battle-vs-banner__team" aria-hidden>
              {team.map((mon, i) => (
                <li
                  key={`${side}-mon-${i}`}
                  className={`battle-vs-banner__slot${mon.fainted ? " is-fainted" : ""}`}
                >
                  <PokemonImage src={mon.spriteUrl} alt="" width={40} height={40} draggable={false} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** ¿El log todavía es sólo el boot de inicio? Si no, es una batalla a medio. */
export function isFreshBattleBoot(log: string[]): boolean {
  return log.every(
    (line) =>
      line === "alpha" ||
      line === "shiny" ||
      line.startsWith("appear:") ||
      line.startsWith("challenge") ||
      line.startsWith("sendOut:") ||
      line.startsWith("stage:") ||
      line.startsWith("trainer:"),
  );
}
