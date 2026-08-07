"use client";

// Sub-vistas del panel de comandos: elegir poder, mochila y cambio de Pokémon.
// Son puramente de presentación — los handlers (que disparan el timeline de
// animaciones) siguen viviendo en battle-arena.tsx y entran por props.

import Image from "next/image";
import { useTranslations } from "next-intl";
import { typeColor } from "@/lib/type-colors";
import { formatMoveName } from "@/lib/format-move-name";
import { formatMoveEffectText } from "@/lib/format-move-effect";
import { itemSpriteUrl } from "@/lib/item-sprites";
import type {
  BattleMoveOption,
  MoveCategory,
  PokeballStack,
  PotionStack,
  RosterMember,
} from "@/components/battle/arena-types";
import type { DamageForecast } from "@/lib/damage-forecast";
import { isSpreadMove } from "@/lib/move-target";

type MatchupInfo = { label: string; className: string };

/** Ícono por categoría, como el indicador físico/especial de Gen IV+. */
const CATEGORY_ICON: Record<MoveCategory, string> = {
  PHYSICAL: "sports_mma",
  SPECIAL: "auto_awesome",
  STATUS: "tune",
};

const CATEGORY_TONE: Record<MoveCategory, string> = {
  PHYSICAL: "text-orange-300",
  SPECIAL: "text-sky-300",
  STATUS: "text-white/60",
};

/**
 * Quién pega primero por velocidad. Vive en el panel de comandos y no sobre la
 * arena: ahí se pisaba con la placa de HP del rival en pantallas angostas, y
 * además este es el momento en que la info sirve.
 */
export function TurnOrderChip({ playerFirst }: { playerFirst: boolean }) {
  const t = useTranslations("battle");
  return (
    <span
      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide lg:px-2.5 lg:py-1.5 lg:text-[13px] ${
        playerFirst
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
          : "border-amber-400/40 bg-amber-500/15 text-amber-200"
      }`}
      title={t("turnOrderHint")}
    >
      {playerFirst ? t("youMoveFirst") : t("foeMovesFirst")}
    </span>
  );
}

/** Estado de turno unificado: "Tu turno" + orden por velocidad. */
export function YourTurnStatus({
  playerFirst,
  showOrder = true,
}: {
  playerFirst: boolean;
  showOrder?: boolean;
}) {
  const t = useTranslations("battle");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/90">
        {t("yourTurn")}
      </span>
      {showOrder ? <TurnOrderChip playerFirst={playerFirst} /> : null}
    </div>
  );
}

function BackButton({
  disabled,
  onBack,
  label,
  small,
}: {
  disabled: boolean;
  onBack: () => void;
  label: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onBack}
      className={`flex items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 hover:bg-black/60 disabled:opacity-40 shrink-0 ${
        small ? "h-7 w-7 md:h-7 md:w-7" : "h-7 w-7 md:h-8 md:w-8"
      }`}
      aria-label={label}
    >
      <span className={`material-symbols-outlined ${small ? "text-[16px]!" : "text-[16px]! md:text-[18px]!"}`}>
        arrow_back
      </span>
    </button>
  );
}

export function MovesView({
  activePlayerName,
  moves,
  choiceLockMoveId,
  isAnimating,
  effectivenessInfo,
  playerFirst,
  forecast,
  onSelect,
  onBack,
}: {
  activePlayerName: string;
  moves: BattleMoveOption[];
  choiceLockMoveId: number | null;
  isAnimating: boolean;
  effectivenessInfo: (moveType: string) => MatchupInfo;
  playerFirst: boolean;
  /** Daño estimado vs el rival actual. null en movimientos de estado. */
  forecast: (move: BattleMoveOption) => DamageForecast | null;
  onSelect: (moveId: number) => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-1 md:gap-1.5 lg:gap-2"
      aria-label={`${activePlayerName} — ${t("selectCommand")}`}
    >
      {/* Header mínimo: iniciativa + volver (el prompt va en aria-label). */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-0.5">
        <TurnOrderChip playerFirst={playerFirst} />
        <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} small />
      </div>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 grid-rows-2 content-stretch gap-1.5 overflow-hidden md:gap-2 lg:gap-2.5">
        {moves.every((m) => m.pp <= 0) && (
          <button
            type="button"
            disabled={isAnimating}
            onClick={() => onSelect(moves[0]?.moveId ?? 0)}
            className="col-span-2 battle-move-card border-error/40"
          >
            <p className="text-base font-bold text-error">{t("struggleName")}</p>
            <p className="mt-1 text-label-sm text-on-surface-variant">{t("struggleHint")}</p>
          </button>
        )}
        {moves.map((m) => {
          const eff = effectivenessInfo(m.type);
          const color = typeColor(m.type);
          const lockedOut = choiceLockMoveId != null && choiceLockMoveId !== m.moveId;
          const category = m.category;
          const isStatus = category === "STATUS";
          // Sin accuracy = nunca falla (Swift). Se dice, no se deja vacío.
          const accuracyLabel = m.accuracy == null ? "—" : `${m.accuracy}%`;
          const damage = isStatus ? null : forecast(m);
          const effect = formatMoveEffectText(m.effectText);
          return (
            <button
              key={m.moveId}
              type="button"
              disabled={isAnimating || m.pp <= 0 || lockedOut}
              onClick={() => onSelect(m.moveId)}
              className="battle-move-card battle-move-card-compact text-left disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: `${color}55` }}
              title={effect ?? undefined}
            >
              <div className="flex min-w-0 shrink-0 items-start justify-between gap-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`battle-move-card__icon material-symbols-outlined text-[12px]! shrink-0 md:text-[13px]! lg:text-[18px]! ${CATEGORY_TONE[category]}`}
                    title={t(`category.${category}`)}
                    aria-label={t(`category.${category}`)}
                  >
                    {CATEGORY_ICON[category]}
                  </span>
                  <span className="battle-move-card__name truncate text-xs font-bold leading-tight text-white md:text-sm lg:text-base">
                    {formatMoveName(m.name)}
                    {isSpreadMove(m.target, m.name) ? (
                      <span className="ml-1 text-[8px] font-bold uppercase text-amber-200/90 md:text-[9px] lg:text-[10px]">
                        {t("spreadMoveTag")}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span
                  className="battle-move-card__type shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide md:text-[10px] lg:px-2 lg:py-0.5 lg:text-[11px]"
                  style={{ backgroundColor: `${color}33`, color, borderColor: `${color}66` }}
                >
                  {m.type}
                </span>
              </div>
              <div className="battle-move-card__stats flex shrink-0 items-baseline justify-between gap-1 text-[10px] tabular-nums md:text-[11px] lg:text-[13px] lg:gap-1.5">
                <span className="text-white/90">
                  <span className="battle-move-card__stats-label mr-0.5 uppercase tracking-wider text-white/45">
                    {t("powerLabel")}
                  </span>
                  <span className="font-bold text-white">{m.power ?? "—"}</span>
                </span>
                <span className="text-white/90">
                  <span className="battle-move-card__stats-label mr-0.5 uppercase tracking-wider text-white/45">
                    {t("accuracyLabel")}
                  </span>
                  <span className="font-bold">{accuracyLabel}</span>
                </span>
                <span className="flex items-center gap-0.5 text-white/90">
                  {lockedOut && (
                    <span className="material-symbols-outlined text-[11px]! text-amber-300 lg:text-[14px]!">
                      lock
                    </span>
                  )}
                  <span className="battle-move-card__stats-label mr-0.5 uppercase tracking-wider text-white/45">
                    {t("ppLabel")}
                  </span>
                  <span className="font-bold">
                    {m.pp}/{m.maxPp ?? m.pp}
                  </span>
                </span>
              </div>
              {effect ? (
                <p className="battle-move-card__meta min-h-0 shrink line-clamp-2 text-[9px] leading-snug text-white/55 md:text-[10px] lg:text-[12px] lg:line-clamp-2">
                  {effect}
                </p>
              ) : null}
              {damage?.guaranteedKo ? (
                <p className="battle-move-card__meta mt-auto shrink-0 truncate text-[9px] font-bold leading-snug text-tertiary md:text-[10px] lg:text-[12px]">
                  {t("forecastKo")}
                </p>
              ) : !isStatus ? (
                <p
                  className={`battle-move-card__meta mt-auto shrink-0 truncate text-[9px] leading-snug md:text-[10px] lg:text-[12px] ${eff.className}`}
                >
                  {eff.label}
                  {damage && (
                    <span className="text-white/55">
                      {" · "}
                      {t("forecastRange", { min: damage.minPct, max: damage.maxPct })}
                      {damage.hits &&
                        ` ${
                          damage.hits.min === damage.hits.max
                            ? t("forecastHitsFixed", { hits: damage.hits.max })
                            : t("forecastHitsRange", {
                                min: damage.hits.min,
                                max: damage.hits.max,
                              })
                        }`}
                    </span>
                  )}
                  {damage?.twoTurn && (
                    <span className="text-amber-300/80">{` · ${t("forecastTwoTurn")}`}</span>
                  )}
                </p>
              ) : (
                <span className="mt-auto" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BagView({
  isAnimating,
  showBalls,
  ballStacks,
  potionStacks,
  potionsDisabled,
  revivesDisabled,
  onThrowBall,
  onUsePotion,
  onUseRevive,
  onBack,
}: {
  isAnimating: boolean;
  /** Las balls se ocultan contra entrenadores/gym/pvp aunque haya stock. */
  showBalls: boolean;
  ballStacks: PokeballStack[];
  potionStacks: PotionStack[];
  /** True cuando el activo está a HP lleno. */
  potionsDisabled: boolean;
  /** True cuando no hay nadie debilitado en el equipo (salvo el activo). */
  revivesDisabled: boolean;
  onThrowBall: (itemId: string, name: string) => void;
  onUsePotion: (itemId: string) => void;
  onUseRevive: (itemId: string) => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");
  const hasBalls = showBalls && ballStacks.length > 0;
  const healStacks = potionStacks.filter((p) => p.kind === "heal");
  const reviveStacks = potionStacks.filter((p) => p.kind === "revive");
  const hasPotions = healStacks.length > 0;
  const hasRevives = reviveStacks.length > 0;

  return (
    <div className="flex flex-col gap-1 md:gap-2 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
        <div>
          <p className="text-xs md:text-sm font-bold text-primary">{t("bagTitle")}</p>
          <p className="text-[10px] md:text-label-sm uppercase text-on-surface-variant tracking-wider">
            {t("selectCommand")}
          </p>
        </div>
        <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} />
      </div>
      <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
        {!hasBalls && !hasPotions && !hasRevives && (
          <p className="text-label-md text-on-surface-variant text-center py-6">{t("bagEmpty")}</p>
        )}
        {hasBalls && (
          <div className="flex flex-col gap-2">
            <span className="text-label-sm uppercase text-on-surface-variant">{t("pokeballsLabel")}</span>
            {ballStacks.map((b) => (
              <button
                key={b.itemId}
                type="button"
                disabled={isAnimating}
                onClick={() => onThrowBall(b.itemId, b.name)}
                className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Image
                  src={itemSpriteUrl(b.name)}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="w-8 h-8 object-contain [image-rendering:pixelated] shrink-0"
                />
                <span className="flex-1 text-left text-label-md text-on-surface font-bold">{b.name}</span>
                <span className="text-label-sm text-on-surface-variant tabular-nums">×{b.quantity}</span>
              </button>
            ))}
          </div>
        )}
        {hasPotions && (
          <div className="flex flex-col gap-2">
            <span className="text-label-sm uppercase text-on-surface-variant">{t("potionsLabel")}</span>
            {healStacks.map((p) => (
              <button
                key={p.itemId}
                type="button"
                disabled={isAnimating || potionsDisabled}
                onClick={() => onUsePotion(p.itemId)}
                className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Image
                  src={itemSpriteUrl(p.name)}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="w-8 h-8 object-contain [image-rendering:pixelated] shrink-0"
                />
                <div className="flex-1 text-left">
                  <p className="text-label-md text-on-surface font-bold">{p.name}</p>
                  <p className="text-label-sm text-on-surface-variant">+{p.healAmount} HP</p>
                </div>
                <span className="text-label-sm text-on-surface-variant tabular-nums">×{p.quantity}</span>
              </button>
            ))}
          </div>
        )}
        {hasRevives && (
          <div className="flex flex-col gap-2">
            <span className="text-label-sm uppercase text-on-surface-variant">{t("revivesLabel")}</span>
            {reviveStacks.map((p) => (
              <button
                key={p.itemId}
                type="button"
                disabled={isAnimating || revivesDisabled}
                onClick={() => onUseRevive(p.itemId)}
                className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Image
                  src={itemSpriteUrl(p.name)}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="w-8 h-8 object-contain [image-rendering:pixelated] shrink-0"
                />
                <div className="flex-1 text-left">
                  <p className="text-label-md text-on-surface font-bold">{p.name}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {p.name === "Max Revive" ? t("reviveFullHint") : t("reviveHalfHint")}
                  </p>
                </div>
                <span className="text-label-sm text-on-surface-variant tabular-nums">×{p.quantity}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SwitchFoeChips({
  foeName,
  foeTypes,
}: {
  foeName: string;
  foeTypes: string[];
}) {
  const t = useTranslations("battle");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium tracking-wide text-white/50">
        {t("switchAgainst", { name: foeName })}
      </span>
      {foeTypes.map((type) => {
        const color = typeColor(type);
        return (
          <span
            key={type}
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ backgroundColor: `${color}28`, color }}
          >
            {type}
          </span>
        );
      })}
    </div>
  );
}

function SwitchPickGrid({
  roster,
  isAnimating,
  highlightReady,
  matchupInfo,
  onSwitch,
  dense = false,
}: {
  roster: RosterMember[];
  isAnimating: boolean;
  highlightReady: boolean;
  matchupInfo: (types: string[]) => MatchupInfo;
  onSwitch: (member: RosterMember) => void;
  /** Panel chico de comandos (cambio voluntario). */
  dense?: boolean;
}) {
  const t = useTranslations("battle");
  return (
    <div className={`battle-switch-grid ${dense ? "battle-switch-grid--dense" : ""}`}>
      {roster.map((m) => {
        const fainted = m.currentHp <= 0;
        const hpPct = Math.max(0, Math.min(100, (m.currentHp / m.maxHp) * 100));
        const matchup = matchupInfo(m.types);
        return (
          <button
            key={m.instanceId}
            type="button"
            disabled={isAnimating || fainted}
            onClick={() => onSwitch(m)}
            className={`battle-switch-pick ${
              !fainted && highlightReady ? "battle-switch-pick--ready" : ""
            } ${fainted ? "battle-switch-pick--faint" : ""}`}
          >
            <span className="battle-switch-pick__art">
              {m.spriteUrl ? (
                <Image
                  src={m.spriteUrl}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-contain"
                />
              ) : null}
              {fainted ? (
                <span className="battle-switch-pick__ko" aria-hidden>
                  <span className="material-symbols-outlined">skull</span>
                </span>
              ) : null}
            </span>
            <span className="battle-switch-pick__name">{m.name}</span>
            <span className="battle-switch-pick__meta">
              {t("level", { level: m.level })}
              {!fainted ? ` · ${Math.round(hpPct)}%` : ""}
            </span>
            <span className="battle-switch-pick__hp" aria-hidden>
              <span
                className={`health-bar-fill ${
                  fainted ? "red" : hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red"
                }`}
                style={{ width: `${fainted ? 0 : hpPct}%` }}
              />
            </span>
            <span
              className={`battle-switch-pick__tag ${
                fainted ? "battle-switch-pick__tag--ko" : matchup.className
              }`}
            >
              {fainted ? t("fainted") : matchup.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Sheet a pantalla completa del combate cuando hay que elegir reemplazo sí o sí. */
export function MustSwitchSheet({
  isAnimating,
  roster,
  foeName,
  foeTypes,
  matchupInfo,
  onSwitch,
}: {
  isAnimating: boolean;
  roster: RosterMember[];
  foeName: string;
  foeTypes: string[];
  matchupInfo: (types: string[]) => MatchupInfo;
  onSwitch: (member: RosterMember) => void;
}) {
  const t = useTranslations("battle");
  return (
    <div
      className="battle-switch-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="battle-switch-title"
    >
      <div className="battle-switch-sheet__scrim" aria-hidden />
      <div className="battle-switch-sheet__panel">
        <header className="battle-switch-sheet__head">
          <p id="battle-switch-title" className="battle-switch-sheet__title">
            {t("mustSwitchTitle")}
          </p>
          <p className="battle-switch-sheet__sub">{t("mustSwitchPrompt")}</p>
          <SwitchFoeChips foeName={foeName} foeTypes={foeTypes} />
        </header>
        <SwitchPickGrid
          roster={roster}
          isAnimating={isAnimating}
          highlightReady
          matchupInfo={matchupInfo}
          onSwitch={onSwitch}
        />
      </div>
    </div>
  );
}

export function TeamView({
  isAnimating,
  mustSwitch,
  roster,
  foeName,
  foeTypes,
  matchupInfo,
  onSwitch,
  onBack,
}: {
  isAnimating: boolean;
  mustSwitch: boolean;
  roster: RosterMember[];
  foeName: string;
  foeTypes: string[];
  matchupInfo: (types: string[]) => MatchupInfo;
  onSwitch: (member: RosterMember) => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");

  // El cambio forzado vive en MustSwitchSheet (montado en el shell).
  if (mustSwitch) return null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 md:gap-1.5">
      <div className="flex shrink-0 items-center justify-between gap-2 px-0.5">
        <p className="text-xs font-bold text-primary md:text-sm">{t("pokemonMenu")}</p>
        <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} small />
      </div>
      <div className="shrink-0 px-0.5">
        <SwitchFoeChips foeName={foeName} foeTypes={foeTypes} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SwitchPickGrid
          roster={roster}
          isAnimating={isAnimating}
          highlightReady={false}
          matchupInfo={matchupInfo}
          onSwitch={onSwitch}
          dense
        />
      </div>
    </div>
  );
}

/** Elegir a quién reanimar con Revive / Max Revive (banca debilitada). */
export function ReviveTargetView({
  isAnimating,
  itemName,
  roster,
  onRevive,
  onBack,
}: {
  isAnimating: boolean;
  itemName: string;
  roster: RosterMember[];
  onRevive: (member: RosterMember) => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");
  const targets = roster.filter((m) => m.currentHp <= 0);

  return (
    <div className="flex flex-col gap-1 md:gap-2 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
        <div>
          <p className="text-xs md:text-sm font-bold text-primary">{itemName}</p>
          <p className="text-[10px] md:text-label-sm text-on-surface-variant">
            {t("reviveSelectPrompt")}
          </p>
        </div>
        <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} />
      </div>
      <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
        {targets.length === 0 ? (
          <p className="text-label-md text-on-surface-variant text-center py-6">
            {t("reviveNoTargets")}
          </p>
        ) : (
          targets.map((m) => (
            <button
              key={m.instanceId}
              type="button"
              disabled={isAnimating}
              onClick={() => onRevive(m)}
              className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {m.spriteUrl && (
                <Image
                  src={m.spriteUrl}
                  alt={m.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 object-contain"
                />
              )}
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-label-md text-on-surface font-bold capitalize truncate">
                    {m.name}
                  </span>
                  <span className="text-label-sm text-on-surface-variant shrink-0">
                    {t("level", { level: m.level })}
                  </span>
                </div>
                <span className="mt-1 inline-block rounded bg-error/25 px-1 text-label-sm font-bold uppercase text-error">
                  {t("fainted")}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function TargetView({
  moveName,
  moveType,
  foes,
  isAnimating,
  onSelect,
  onBack,
}: {
  moveName: string;
  /** Tipo del move (para el chip del encabezado). */
  moveType?: string | null;
  foes: {
    lane: "A" | "B";
    name: string;
    spriteUrl: string;
    currentHp: number;
    maxHp: number;
    fainted: boolean;
    types: string[];
    matchup: MatchupInfo;
    forecast: DamageForecast | null;
    isStatus: boolean;
  }[];
  isAnimating: boolean;
  onSelect: (lane: "A" | "B") => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");
  const typeChipColor = moveType ? typeColor(moveType) : null;
  return (
    <div className="flex flex-col gap-1 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
        <div className="min-w-0 flex items-center gap-1.5">
          <p className="text-xs md:text-sm font-bold text-primary truncate">
            {t("chooseTarget", { move: formatMoveName(moveName) })}
          </p>
          {moveType && typeChipColor && (
            <span
              className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide border"
              style={{
                backgroundColor: `${typeChipColor}33`,
                color: typeChipColor,
                borderColor: `${typeChipColor}66`,
              }}
            >
              {moveType}
            </span>
          )}
        </div>
        <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} small />
      </div>
      <p className="text-[10px] uppercase text-on-surface-variant tracking-wider px-0.5 shrink-0">
        {t("selectTarget")}
      </p>
      <div className="grid grid-cols-2 gap-1 md:gap-1.5 flex-1 min-h-0">
        {foes.map((f) => {
          const hpPct = f.maxHp > 0 ? Math.max(0, (f.currentHp / f.maxHp) * 100) : 0;
          return (
            <button
              key={f.lane}
              type="button"
              disabled={isAnimating || f.fainted}
              onClick={() => onSelect(f.lane)}
              className="battle-move-card text-left disabled:opacity-40 disabled:cursor-not-allowed flex flex-col gap-1 p-2 min-h-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.spriteUrl}
                  alt=""
                  className={`w-11 h-11 object-contain shrink-0 ${f.fainted ? "grayscale opacity-50" : ""}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{f.name}</p>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {f.types.map((ty) => {
                      const c = typeColor(ty);
                      return (
                        <span
                          key={ty}
                          className="px-1 py-px rounded text-[8px] uppercase font-bold tracking-wide border"
                          style={{
                            backgroundColor: `${c}33`,
                            color: c,
                            borderColor: `${c}66`,
                          }}
                        >
                          {ty}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div
                  className={`h-full ${hpPct > 50 ? "bg-emerald-400" : hpPct > 20 ? "bg-amber-400" : "bg-error"}`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between gap-1 text-[10px] tabular-nums">
                <span className="text-on-surface-variant">
                  {f.fainted ? t("fainted") : `${f.currentHp}/${f.maxHp}`}
                </span>
              </div>
              {!f.fainted &&
                (f.forecast?.guaranteedKo ? (
                  <p className="text-[9px] md:text-[10px] leading-snug truncate font-bold text-tertiary">
                    {t("forecastKo")}
                  </p>
                ) : (
                  <p
                    className={`text-[9px] md:text-[10px] leading-snug truncate ${
                      f.isStatus ? "text-white/45" : f.matchup.className
                    }`}
                  >
                    {f.isStatus ? t("category.STATUS") : f.matchup.label}
                    {f.forecast && (
                      <span className="text-white/55">
                        {" · "}
                        {t("forecastRange", {
                          min: f.forecast.minPct,
                          max: f.forecast.maxPct,
                        })}
                      </span>
                    )}
                  </p>
                ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
