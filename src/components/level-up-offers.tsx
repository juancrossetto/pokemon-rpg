"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useState, useTransition, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { confirmDeclineMove, confirmEvolve, confirmLearnMove } from "@/actions/level-up-offers";
import { typeColor } from "@/lib/type-colors";
import { TypeSymbol } from "@/components/type-symbol";
import { PokemonImage } from "@/components/pokemon-image";
import { showdownCategoryIconUrl } from "@/lib/type-icons";
import { formatMoveName } from "@/lib/format-move-name";
import { formatMoveEffectText } from "@/lib/format-move-effect";
import {
  knownFromLevelUp,
  type EvolveOffer,
  type KnownMoveInfo,
  type LevelUpMoveInfo,
  type MoveCategoryKind,
} from "@/lib/level-up-read";
import { spriteFor } from "@/lib/shiny";
import { EvolvePopup } from "@/components/evolve-popup";
import { MoveLearnedPopup } from "@/components/move-learned-popup";

export type LevelUpOfferEntry = {
  instanceId: string;
  name: string;
  leveledUpTo: number | null;
  fromSpriteUrl?: string | null;
  isShiny?: boolean;
  autoTaught: LevelUpMoveInfo[];
  pendingMoves: LevelUpMoveInfo[];
  evolveOffer: EvolveOffer | null;
  knownMoves: KnownMoveInfo[];
};

/**
 * Panel post level-up: un movimiento a la vez (aprender / reemplazar /
 * ignorar / rechazar) y luego confirmar evolución.
 */
export type EvolvedResult = {
  instanceId: string;
  toName: string;
  toSpriteUrl: string;
  level: number;
  currentHp: number;
  maxHp: number;
};

export function LevelUpOffersPanel({
  entries,
  onSettled,
  onEvolved,
}: {
  entries: LevelUpOfferEntry[];
  onSettled?: () => void;
  /** Se dispara al confirmar la evolución (antes del reveal), para UI optimista. */
  onEvolved?: (result: EvolvedResult) => void;
}) {
  const t = useTranslations("levelUp");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(entries);
  const [replacement, setReplacement] = useState<{
    instanceId: string;
    moveId: number;
    slot: number;
  } | null>(null);
  const [evolvingId, setEvolvingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{
    instanceId: string;
    toName: string;
    toSpriteUrl: string;
  } | null>(null);
  /*
    Evolución post-batalla: se muestra el mismo popup fullscreen que el árbol
    de evolución (silueta que muta + tema musical), no una card inline. Antes
    eran dos experiencias distintas para el mismo evento.
  */
  const [evolveShow, setEvolveShow] = useState<{
    instanceId: string;
    fromName: string;
    fromSpriteUrl: string | null;
    toName: string;
    toSpriteUrl: string;
    isShiny: boolean;
  } | null>(null);
  /*
    Celebración de poder aprendido. Es una cola porque un level-up puede dejar
    varios movimientos: los `autoTaught` (slot libre, el servidor ya los
    enseñó) se siembran acá en el primer render — si no, se aprendían en
    silencio y sólo quedaban listados. Los que el jugador elige se van
    encolando después. Inicializador lazy y no un efecto: `entries` ya está
    disponible en el primer render (igual que `local`).
  */
  const [learnQueue, setLearnQueue] = useState<
    { pokemonName: string; move: LevelUpMoveInfo }[]
  >(() =>
    entries.flatMap((e) =>
      e.leveledUpTo != null
        ? e.autoTaught.map((move) => ({ pokemonName: e.name, move }))
        : [],
    ),
  );
  const learnedShow = learnQueue[0] ?? null;
  const [error, setError] = useState<string | null>(null);

  const visible = local.filter(
    (e) =>
      e.leveledUpTo != null &&
      (e.autoTaught.length > 0 ||
        e.pendingMoves.length > 0 ||
        e.evolveOffer ||
        revealed?.instanceId === e.instanceId),
  );

  function notifySettled() {
    // onSettled actualiza el padre: no puede correr dentro de un setState updater
    // (React lo trata como setState durante render de este panel).
    queueMicrotask(() => onSettled?.());
  }

  if (visible.length === 0) return null;

  function dismissEntry(instanceId: string) {
    setRevealed((r) => (r?.instanceId === instanceId ? null : r));
    setLocal((prev) => {
      const next = prev.map((e) =>
        e.instanceId === instanceId
          ? { ...e, pendingMoves: [], evolveOffer: null, autoTaught: [] }
          : e,
      );
      const still = next.some(
        (e) =>
          e.leveledUpTo != null &&
          (e.autoTaught.length > 0 || e.pendingMoves.length > 0 || e.evolveOffer),
      );
      if (!still) notifySettled();
      return next;
    });
  }

  /** Diferir evolución; el próximo level-up vuelve a ofrecer. */
  function deferEvolve(instanceId: string) {
    setEvolvingId(null);
    setRevealed((r) => (r?.instanceId === instanceId ? null : r));
    setLocal((prev) => {
      const next = prev.map((e) =>
        e.instanceId === instanceId ? { ...e, evolveOffer: null } : e,
      );
      const still = next.some(
        (e) =>
          e.leveledUpTo != null &&
          (e.autoTaught.length > 0 || e.pendingMoves.length > 0 || e.evolveOffer),
      );
      if (!still) notifySettled();
      return next;
    });
  }

  function skipMove(instanceId: string, moveId: number) {
    setReplacement(null);
    setLocal((prev) => {
      const next = prev.map((e) =>
        e.instanceId === instanceId
          ? {
              ...e,
              pendingMoves: e.pendingMoves.filter((x) => x.moveId !== moveId),
            }
          : e,
      );
      const entry = next.find((e) => e.instanceId === instanceId);
      if (
        entry &&
        entry.pendingMoves.length === 0 &&
        !entry.evolveOffer &&
        entry.autoTaught.length === 0
      ) {
        notifySettled();
      }
      return next;
    });
  }

  /** Rechazo permanente: persiste y no se vuelve a ofrecer. */
  function rejectMove(instanceId: string, moveId: number) {
    setError(null);
    startTransition(async () => {
      const result = await confirmDeclineMove(instanceId, moveId, locale);
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      skipMove(instanceId, moveId);
      router.refresh();
    });
  }

  function learn(instanceId: string, moveId: number, replaceSlot: number | null) {
    setError(null);
    startTransition(async () => {
      const result = await confirmLearnMove(instanceId, moveId, replaceSlot, locale);
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      setReplacement(null);
      const entry = local.find((e) => e.instanceId === instanceId);
      const learnedMove = entry?.pendingMoves.find((m) => m.moveId === moveId);
      if (entry && learnedMove) {
        setLearnQueue((q) => [...q, { pokemonName: entry.name, move: learnedMove }]);
      }
      setLocal((prev) =>
        prev.map((e) => {
          if (e.instanceId !== instanceId) return e;
          const learned = e.pendingMoves.find((m) => m.moveId === moveId);
          const pendingMoves = e.pendingMoves.filter((m) => m.moveId !== moveId);
          let knownMoves = e.knownMoves;
          if (learned) {
            if (replaceSlot != null) {
              knownMoves = knownMoves.map((k) =>
                k.slot === replaceSlot ? knownFromLevelUp(replaceSlot, learned) : k,
              );
            } else {
              const used = new Set(knownMoves.map((k) => k.slot));
              const empty = [1, 2, 3, 4].find((s) => !used.has(s));
              if (empty != null) {
                knownMoves = [...knownMoves, knownFromLevelUp(empty, learned)];
              }
            }
          }
          return {
            ...e,
            pendingMoves,
            autoTaught: learned ? [...e.autoTaught, learned] : e.autoTaught,
            knownMoves,
          };
        }),
      );
      router.refresh();
    });
  }

  function evolve(instanceId: string) {
    setError(null);
    setEvolvingId(instanceId);
    const evolving = local.find((e) => e.instanceId === instanceId);
    startTransition(async () => {
      const result = await confirmEvolve(instanceId, locale);
      if (!result.ok) {
        setEvolvingId(null);
        setError(t(`errors.${result.error}`));
        return;
      }
      setRevealed({
        instanceId,
        toName: result.toName,
        toSpriteUrl: result.toSpriteUrl,
      });
      setEvolveShow({
        instanceId,
        fromName: evolving?.name ?? "",
        fromSpriteUrl: evolving?.fromSpriteUrl ?? null,
        toName: result.toName,
        toSpriteUrl: result.toSpriteUrl,
        isShiny: evolving?.isShiny ?? false,
      });
      setLocal((prev) =>
        prev.map((e) =>
          e.instanceId === instanceId
            ? { ...e, evolveOffer: null, name: result.toName }
            : e,
        ),
      );
      onEvolved?.({
        instanceId,
        toName: result.toName,
        toSpriteUrl: result.toSpriteUrl,
        level: result.level,
        currentHp: result.currentHp,
        maxHp: result.maxHp,
      });
      setEvolvingId(null);
    });
  }

  return (
    <section className="space-y-3" aria-live="polite">
      {learnedShow && (
        <MoveLearnedPopup
          key={`${learnedShow.pokemonName}-${learnedShow.move.moveId}`}
          pokemonName={learnedShow.pokemonName}
          moveName={learnedShow.move.name}
          moveType={learnedShow.move.type}
          category={learnedShow.move.category}
          power={learnedShow.move.power}
          accuracy={learnedShow.move.accuracy}
          pp={learnedShow.move.pp}
          onFinished={() => setLearnQueue((q) => q.slice(1))}
        />
      )}
      {evolveShow && (
        <EvolvePopup
          fromName={evolveShow.fromName}
          fromSpriteUrl={evolveShow.fromSpriteUrl}
          toName={evolveShow.toName}
          toSpriteUrl={evolveShow.toSpriteUrl}
          isShiny={evolveShow.isShiny}
          labels={{
            evolving: t("evolvingCry", { name: evolveShow.fromName }),
            into: t("evolvedInto", { name: evolveShow.toName }),
            continue: t("dismiss"),
          }}
          onContinue={() => {
            const { instanceId } = evolveShow;
            setEvolveShow(null);
            dismissEntry(instanceId);
            router.refresh();
          }}
        />
      )}
      {visible.map((entry) => {
        const offer = entry.evolveOffer;
        const isEvolving = evolvingId === entry.instanceId;
        const reveal = revealed?.instanceId === entry.instanceId ? revealed : null;
        const current = entry.pendingMoves[0] ?? null;
        const hasEmptySlot = entry.knownMoves.length < 4;
        const remaining = Math.max(0, entry.pendingMoves.length - 1);
        const evolveOnly =
          !current &&
          entry.autoTaught.length === 0 &&
          (offer != null || reveal != null);
        const learnedOnly =
          !current &&
          entry.autoTaught.length > 0 &&
          !offer &&
          !reveal;

        if (learnedOnly) {
          return (
            <LearnedAckPanel
              key={entry.instanceId}
              pokemonName={entry.name}
              level={entry.leveledUpTo ?? 0}
              moves={entry.autoTaught}
              locale={locale}
              labels={{
                newMove: t("newMove"),
                title: t("title", {
                  name: entry.name,
                  level: entry.leveledUpTo ?? 0,
                }),
                learned: (move) => t("learned", { move }),
                dismiss: t("dismiss"),
                power: t("power"),
                accuracy: t("accuracy"),
                pp: t("pp"),
                neverMisses: t("neverMisses"),
                category: (c) => t(`category.${c}`),
              }}
              onDismiss={() => dismissEntry(entry.instanceId)}
            />
          );
        }

        return (
          <div
            key={entry.instanceId}
            className={
              evolveOnly || current
                ? undefined
                : "relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#121212] shadow-[0_20px_48px_rgba(0,0,0,0.45)]"
            }
          >
            {!evolveOnly && !current && (
              <div className="relative px-4 pb-1 pt-4">
                <div
                  className="pointer-events-none absolute inset-0 opacity-80"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(255,255,255,0.08), transparent 55%)",
                  }}
                />
                <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                  {t("title", { name: entry.name, level: entry.leveledUpTo ?? 0 })}
                </p>
              </div>
            )}

            {entry.autoTaught.length > 0 && !current && (
              <ul className="relative space-y-2 px-4 pt-2">
                {entry.autoTaught.map((m) => (
                  <li key={`auto-${m.moveId}`}>
                    <LearnedMoveRow
                      move={m}
                      locale={locale}
                      headline={t("learned", {
                        move: formatMoveName(m.name, locale),
                      })}
                      labels={{
                        power: t("power"),
                        accuracy: t("accuracy"),
                        pp: t("pp"),
                        neverMisses: t("neverMisses"),
                        category: (c) => t(`category.${c}`),
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}

            {current && (
              <div className="relative">
                <LearnMoveCard
                  move={current}
                  remaining={remaining}
                  knownMoves={entry.knownMoves}
                  hasEmptySlot={hasEmptySlot}
                  ownerLabel={t("title", {
                    name: entry.name,
                    level: entry.leveledUpTo ?? 0,
                  })}
                  selectedSlot={
                    replacement?.instanceId === entry.instanceId &&
                    replacement.moveId === current.moveId
                      ? replacement.slot
                      : null
                  }
                  pending={pending}
                  labels={{
                    newMove: t("newMove"),
                    wantsToLearn: t("wantsToLearn", {
                      move: formatMoveName(current.name, locale),
                    }),
                    morePending: t("morePending", { count: remaining }),
                    forgetWhich: t("forgetWhich"),
                    learn: t("learn"),
                    replace: t("replace"),
                    skipMove: t("skipMove"),
                    skipMoveHint: t("skipMoveHint"),
                    rejectMove: t("rejectMove"),
                    rejectMoveHint: t("rejectMoveHint"),
                    cancel: t("cancel"),
                    yourMoves: t("yourMoves"),
                    power: t("power"),
                    accuracy: t("accuracy"),
                    pp: t("pp"),
                    learnAt: t("learnAt", { level: current.learnLevel }),
                    neverMisses: t("neverMisses"),
                    category: (c) => t(`category.${c}`),
                  }}
                  onLearnEmpty={() => learn(entry.instanceId, current.moveId, null)}
                  onSelectSlot={(slot) =>
                    setReplacement((selected) =>
                      selected?.instanceId === entry.instanceId &&
                      selected.moveId === current.moveId &&
                      selected.slot === slot
                        ? null
                        : { instanceId: entry.instanceId, moveId: current.moveId, slot },
                    )
                  }
                  onConfirmReplace={() => {
                    if (
                      replacement?.instanceId === entry.instanceId &&
                      replacement.moveId === current.moveId
                    ) {
                      learn(entry.instanceId, current.moveId, replacement.slot);
                    }
                  }}
                  onSkip={() => skipMove(entry.instanceId, current.moveId)}
                  onReject={() => rejectMove(entry.instanceId, current.moveId)}
                />
              </div>
            )}

            {reveal && (
              <EvolveReveal
                name={reveal.toName}
                spriteUrl={reveal.toSpriteUrl}
                isShiny={entry.isShiny ?? false}
                label={t("evolvedInto", { name: reveal.toName })}
              />
            )}

            {offer && entry.pendingMoves.length === 0 && !reveal && (
              <div className={evolveOnly ? undefined : "px-4 pb-4"}>
                <EvolveOfferCard
                  fromName={entry.name}
                  fromSpriteUrl={entry.fromSpriteUrl}
                  isShiny={entry.isShiny ?? false}
                  offer={offer}
                  level={entry.leveledUpTo ?? offer.evolveLevel}
                  isEvolving={isEvolving}
                  pending={pending}
                  labels={{
                    ready: t("evolveReady"),
                    into: t("evolveInto", {
                      from: entry.name,
                      to: offer.toName,
                    }),
                    evolve: t("evolve"),
                    later: t("evolveLater"),
                    laterHint: t("evolveLaterHint"),
                    level: t("title", {
                      name: entry.name,
                      level: entry.leveledUpTo ?? offer.evolveLevel,
                    }),
                  }}
                  onEvolve={() => evolve(entry.instanceId)}
                  onLater={() => deferEvolve(entry.instanceId)}
                />
              </div>
            )}

            {!offer && !reveal && entry.pendingMoves.length === 0 && (
              <div className="px-4 pb-4">
                <button
                  type="button"
                  onClick={() => dismissEntry(entry.instanceId)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[12px] font-medium text-white/55 transition hover:border-white/20 hover:text-white"
                >
                  {t("dismiss")}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="text-label-sm text-error">{error}</p>}
    </section>
  );
}

type LearnMoveLabels = {
  newMove: string;
  wantsToLearn: string;
  morePending: string;
  forgetWhich: string;
  learn: string;
  replace: string;
  skipMove: string;
  skipMoveHint: string;
  rejectMove: string;
  rejectMoveHint: string;
  cancel: string;
  yourMoves: string;
  power: string;
  accuracy: string;
  pp: string;
  learnAt: string;
  neverMisses: string;
  category: (c: MoveCategoryKind) => string;
};

function accuracyText(accuracy: number | null, neverMisses: string): string {
  return accuracy == null ? neverMisses : `${accuracy}%`;
}

type LearnedRowLabels = {
  power: string;
  accuracy: string;
  pp: string;
  neverMisses: string;
  category: (c: MoveCategoryKind) => string;
};

/** Fila de poder aprendido — mismo idioma visual que la celebración full-screen. */
function LearnedMoveRow({
  move,
  locale,
  headline,
  labels,
}: {
  move: LevelUpMoveInfo;
  locale: string;
  headline: string;
  labels: LearnedRowLabels;
}) {
  const accent = typeColor(move.type);
  return (
    <div
      className="learned-ack-row"
      style={{ "--learned-accent": accent } as CSSProperties}
    >
      <div className="learned-ack-row__glow" aria-hidden />
      <TypeOrb type={move.type} size="md" title={move.type} />
      <div className="min-w-0 flex-1">
        <p className="learned-ack-row__headline">{headline}</p>
        <p className="learned-ack-row__name">{formatMoveName(move.name, locale)}</p>
        <div className="learned-ack-row__meta">
          <span className="learned-ack-chip">
            <Image
              src={showdownCategoryIconUrl(move.category)}
              alt=""
              width={22}
              height={14}
              className="h-3.5 w-[22px] object-contain"
              unoptimized
            />
            {labels.category(move.category)}
          </span>
          <span className="learned-ack-stat">
            <em>{labels.power}</em> {move.power ?? "—"}
          </span>
          <span className="learned-ack-stat">
            <em>{labels.accuracy}</em>{" "}
            {accuracyText(move.accuracy, labels.neverMisses)}
          </span>
          <span className="learned-ack-stat">
            <em>{labels.pp}</em> {move.pp}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Aviso post-celebración: sin card gris opaca. Acento del tipo, tipografía
 * expresiva y CTA limpio — continúa el feel del slam de `MoveLearnedPopup`.
 */
function LearnedAckPanel({
  pokemonName,
  level,
  moves,
  locale,
  labels,
  onDismiss,
}: {
  pokemonName: string;
  level: number;
  moves: LevelUpMoveInfo[];
  locale: string;
  labels: {
    newMove: string;
    title: string;
    learned: (move: string) => string;
    dismiss: string;
  } & LearnedRowLabels;
  onDismiss: () => void;
}) {
  const accent = typeColor(moves[0]?.type ?? "normal");
  return (
    <div
      className="learned-ack"
      style={{ "--learned-accent": accent } as CSSProperties}
      role="status"
    >
      <div className="learned-ack__aura" aria-hidden />
      <p className="learned-ack__kicker">{labels.newMove}</p>
      <p className="learned-ack__owner">{labels.title}</p>

      <ul className="learned-ack__list">
        {moves.map((m) => (
          <li key={m.moveId}>
            <LearnedMoveRow
              move={m}
              locale={locale}
              headline={labels.learned(formatMoveName(m.name, locale))}
              labels={labels}
            />
          </li>
        ))}
      </ul>

      <button type="button" onClick={onDismiss} className="learned-ack__cta">
        {labels.dismiss}
      </button>
      <span className="sr-only">{pokemonName} · {level}</span>
    </div>
  );
}

function powerDelta(candidate: number | null, known: number | null): number | null {
  if (candidate == null || known == null) return null;
  return candidate - known;
}

/** Ícono de tipo Showdown en órbita de color — mismo patrón que el mapa del home. */
function TypeOrb({
  type,
  size = "md",
  title,
}: {
  type: string;
  size?: "sm" | "md" | "lg";
  title?: string;
}) {
  const color = typeColor(type);
  // Ícono ~65% del círculo: el símbolo Showdown es fino y con padding
  // interno; si queda al 40% se lee como un puntito.
  const box =
    size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon =
    size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const px = size === "lg" ? 28 : size === "sm" ? 16 : 20;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${box}`}
      style={{
        background: `radial-gradient(circle at 35% 30%, ${color}ee, ${color}88)`,
        borderColor: `${color}aa`,
      }}
      title={title ?? type}
    >
      <TypeSymbol type={type} size={px} className={icon} />
    </span>
  );
}

function LearnMoveCard({
  move,
  remaining,
  knownMoves,
  hasEmptySlot,
  ownerLabel,
  selectedSlot,
  pending,
  labels,
  onLearnEmpty,
  onSelectSlot,
  onConfirmReplace,
  onSkip,
  onReject,
}: {
  move: LevelUpMoveInfo;
  remaining: number;
  knownMoves: KnownMoveInfo[];
  hasEmptySlot: boolean;
  /** "Chikorita · Nv. 12" — va dentro de esta card, no en otra envolvente. */
  ownerLabel: string;
  selectedSlot: number | null;
  pending: boolean;
  labels: LearnMoveLabels;
  onLearnEmpty: () => void;
  onSelectSlot: (slot: number) => void;
  onConfirmReplace: () => void;
  onSkip: () => void;
  onReject: () => void;
}) {
  const color = typeColor(move.type);
  const locale = useLocale();
  const formatted = formatMoveName(move.name, locale);
  const effect = formatMoveEffectText(move.effectText, {
    locale,
    moveName: move.name,
  });

  return (
    <div
      className="relative overflow-hidden rounded-[1.35rem] border bg-[#101112] shadow-[0_20px_48px_rgba(0,0,0,0.45)]"
      style={{
        borderColor: `${color}38`,
        boxShadow: `0 20px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}cc 28%, ${color}55 72%, transparent)`,
        }}
      />
      {/*
        Una sola card: el poder nuevo es el protagonista. El dueño va como
        kicker, no como panel envolvente (eso anidaba cards en la victoria).
      */}
      <div
        className="relative px-3 pb-3 pt-3 sm:px-4 sm:pb-3.5 sm:pt-4"
        style={{
          background: `radial-gradient(85% 105% at 0% 0%, ${color}2f 0%, transparent 68%)`,
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
          {ownerLabel}
        </p>
        <div className="mt-2.5 flex items-center gap-2.5 sm:gap-3">
          <TypeOrb type={move.type} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
              {labels.newMove}
            </p>
            <p className="mt-0.5 truncate text-[19px] font-bold tracking-tight text-white sm:text-[21px]">
              {formatted}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/35 px-1.5 py-0.5 text-[10px] font-medium text-white/75">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={showdownCategoryIconUrl(move.category)}
                  alt=""
                  width={12}
                  height={12}
                  className="h-3 w-3 object-contain"
                  decoding="async"
                />
                {labels.category(move.category)}
              </span>
              <span className="rounded-md border border-white/10 bg-black/35 px-1.5 py-0.5 font-mono text-[10px] text-white/55">
                {labels.learnAt}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/8 bg-black/20">
          <MoveStat
            label={labels.power}
            value={move.power == null ? "—" : String(move.power)}
          />
          <MoveStat
            label={labels.accuracy}
            value={accuracyText(move.accuracy, labels.neverMisses)}
          />
          <MoveStat label={labels.pp} value={String(move.pp)} />
        </div>

        {effect ? (
          <p className="mt-3 line-clamp-3 text-[12px] leading-snug text-white/65 sm:line-clamp-4 sm:text-[13px] sm:leading-relaxed">
            {effect}
          </p>
        ) : null}

        <p className="sr-only">{labels.wantsToLearn}</p>
        {remaining > 0 && (
          <p className="mt-0.5 text-[10px] text-white/40">{labels.morePending}</p>
        )}
      </div>

      {knownMoves.length > 0 ? (
        <div className="border-t border-white/8 px-3 py-3 sm:px-4 sm:py-3.5">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
            {hasEmptySlot ? labels.yourMoves : labels.forgetWhich}
          </p>
          <ul className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.015] divide-y divide-white/8">
            {knownMoves.map((k) => {
              const delta = powerDelta(move.power, k.power);
              const selected = !hasEmptySlot && selectedSlot === k.slot;
              return (
                <li key={k.slot} className="min-w-0">
                  {!hasEmptySlot ? (
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={selected}
                      onClick={() => onSelectSlot(k.slot)}
                      className={`w-full px-2.5 py-2.5 text-left transition disabled:opacity-50 ${
                        selected
                          ? "move-replace-selected bg-pokeball-red/12 shadow-[inset_3px_0_0_var(--color-pokeball-red)]"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <KnownMoveRow
                        move={k}
                        labels={labels}
                        powerDelta={delta}
                        interactive={!selected}
                        compact
                      />
                    </button>
                  ) : (
                    <div className="px-2.5 py-2.5">
                      <KnownMoveRow
                        move={k}
                        labels={labels}
                        powerDelta={delta}
                        compact
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-white/8 bg-black/10 px-3 py-3 sm:px-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.35fr_1fr_auto]">
            {hasEmptySlot ? (
              <button
                type="button"
                disabled={pending}
                onClick={onLearnEmpty}
                className="ui-btn-primary rounded-xl px-4 py-2.5 text-[13px] font-bold tracking-wide shadow-[0_8px_22px_color-mix(in_srgb,var(--theme-primary)_20%,transparent)]"
              >
                {labels.learn}
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || selectedSlot == null}
                onClick={onConfirmReplace}
                title={selectedSlot == null ? labels.forgetWhich : undefined}
                className="ui-btn-primary rounded-xl px-4 py-2.5 text-[13px] font-bold tracking-wide shadow-[0_8px_22px_color-mix(in_srgb,var(--theme-primary)_20%,transparent)]"
              >
                {labels.replace}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={onSkip}
              title={labels.skipMoveHint}
              className="rounded-xl border border-white/12 bg-transparent px-4 py-2.5 text-[13px] font-medium text-white/60 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
            >
              {labels.skipMove}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onReject}
              title={labels.rejectMoveHint}
              className="rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/40 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-50"
            >
              {labels.rejectMove}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] leading-snug text-white/30">
            {labels.skipMoveHint}
            <span className="mx-1.5 text-white/20">·</span>
            {labels.rejectMoveHint}
          </p>
        </div>
    </div>
  );
}

function MoveStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="px-2 py-2 text-center sm:py-2.5">
      <p className="font-mono text-[15px] font-bold tabular-nums text-white sm:text-[16px]">
        {value}
      </p>
      <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>
    </div>
  );
}

function KnownMoveRow({
  move,
  labels,
  powerDelta: delta,
  interactive = false,
  compact = false,
}: {
  move: KnownMoveInfo;
  labels: LearnMoveLabels;
  powerDelta: number | null;
  interactive?: boolean;
  /** Sin descripción: filas cortas para la lista de movimientos actuales. */
  compact?: boolean;
}) {
  const locale = useLocale();
  const effect = compact
    ? null
    : formatMoveEffectText(move.effectText, { locale, moveName: move.name });

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <TypeOrb type={move.type} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-white">
            {formatMoveName(move.name, locale)}
          </span>
          {delta != null && delta !== 0 && (
            <span
              className={`shrink-0 font-mono text-[10px] font-bold tabular-nums ${
                delta > 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
          {interactive && (
            <span className="ml-auto shrink-0 font-mono text-[10px] text-white/35">
              #{move.slot}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-x-2 overflow-hidden font-mono text-[10px] tabular-nums text-white/50">
          <span className="shrink-0 text-white/45">
            {labels.category(move.category)}
          </span>
          <span className="shrink-0">
            <span className="text-white/30">{labels.power} </span>
            {move.power ?? "—"}
          </span>
          <span className="shrink-0">
            <span className="text-white/30">{labels.accuracy} </span>
            {accuracyText(move.accuracy, labels.neverMisses)}
          </span>
          <span className="shrink-0">
            <span className="text-white/30">{labels.pp} </span>
            {move.pp}
          </span>
        </div>
        {effect ? (
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/40">
            {effect}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EvolveOfferCard({
  fromName,
  fromSpriteUrl,
  isShiny = false,
  offer,
  level,
  isEvolving,
  pending,
  labels,
  onEvolve,
  onLater,
}: {
  fromName: string;
  fromSpriteUrl?: string | null;
  isShiny?: boolean;
  offer: EvolveOffer;
  level: number;
  isEvolving: boolean;
  pending: boolean;
  labels: {
    ready: string;
    into: string;
    evolve: string;
    later: string;
    laterHint: string;
    level: string;
  };
  onEvolve: () => void;
  onLater: () => void;
}) {
  const fromSrc = fromSpriteUrl ? spriteFor(fromSpriteUrl, isShiny) : null;
  const toSrc = spriteFor(offer.toSpriteUrl, isShiny);

  return (
    <div
      className={`evolve-card-in relative overflow-hidden rounded-2xl border border-tertiary/40 bg-[#0c1018] p-4 sm:p-5 ${
        isEvolving ? "evolve-flash" : ""
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 35%, rgba(242,192,0,0.22), transparent 70%), linear-gradient(180deg, rgba(242,192,0,0.06), transparent 55%)",
        }}
      />
      <div
        className="evolve-ray pointer-events-none absolute left-1/2 top-[38%] h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-30"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.14) 18deg, transparent 36deg, transparent 180deg, rgba(242,192,0,0.12) 198deg, transparent 216deg)",
        }}
      />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span
          key={i}
          className="evolve-spark pointer-events-none absolute h-1 w-1 rounded-full bg-tertiary"
          style={{
            left: `${10 + i * 12}%`,
            bottom: `${22 + (i % 4) * 8}%`,
            animationDelay: `${0.15 * i}s`,
          }}
        />
      ))}

      <div className="relative">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-tertiary">
          {labels.ready}
        </p>
        <p className="mt-1 text-center text-[11px] text-on-surface-variant/80">
          {labels.level}
        </p>

        <div className="mt-5 flex items-end justify-center gap-2 sm:gap-4">
          <EvolveSpriteSlot
            name={fromName}
            src={fromSrc}
            size="md"
            dimmed={isEvolving}
          />
          <span
            className="evolve-arrow mb-10 material-symbols-outlined text-[28px]! text-tertiary"
            aria-hidden
          >
            arrow_forward
          </span>
          <EvolveSpriteSlot
            name={offer.toName}
            src={toSrc}
            size="lg"
            highlight
            dimmed={false}
          />
        </div>

        <p className="mt-4 text-center text-[13px] leading-snug text-on-surface">
          {labels.into}
        </p>
        <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          Nv. {level} → {offer.toName}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={pending || isEvolving}
            onClick={onEvolve}
            className="flex-1 rounded-xl bg-tertiary px-4 py-3 text-[13px] font-bold tracking-wide text-on-tertiary shadow-[0_0_24px_rgba(242,192,0,0.25)] transition hover:brightness-110 disabled:opacity-60"
          >
            {labels.evolve}
          </button>
          <button
            type="button"
            disabled={pending || isEvolving}
            onClick={onLater}
            className="rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-[13px] text-on-surface-variant transition hover:border-white/25 hover:text-white disabled:opacity-60 sm:min-w-32"
          >
            {labels.later}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] leading-snug text-on-surface-variant/80">
          {labels.laterHint}
        </p>
      </div>
    </div>
  );
}

function EvolveReveal({
  name,
  spriteUrl,
  isShiny = false,
  label,
}: {
  name: string;
  spriteUrl: string;
  isShiny?: boolean;
  label: string;
}) {
  return (
    <div className="evolve-card-in relative overflow-hidden rounded-2xl border border-tertiary/40 bg-[#0c1018] px-4 py-8 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(circle at 50% 50%, rgba(242,192,0,0.2), transparent 70%)",
        }}
      />
      <div className="evolve-reveal-pop relative mx-auto flex flex-col items-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span className="absolute inset-2 rounded-full bg-tertiary/25 blur-xl" />
          <PokemonImage
            src={spriteFor(spriteUrl, isShiny)}
            speciesName={name}
            isShiny={isShiny}
            alt={name}
            width={112}
            height={112}
            className="relative h-28 w-28 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
          />
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary">
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold capitalize text-white">{name}</p>
      </div>
    </div>
  );
}

function EvolveSpriteSlot({
  name,
  src,
  size,
  highlight,
  dimmed,
}: {
  name: string;
  src: string | null;
  size: "md" | "lg";
  highlight?: boolean;
  dimmed?: boolean;
}) {
  const box = size === "lg" ? "h-24 w-24 sm:h-28 sm:w-28" : "h-20 w-20 sm:h-24 sm:w-24";
  const img = size === "lg" ? "h-24 w-24 sm:h-28 sm:w-28" : "h-20 w-20 sm:h-24 sm:w-24";
  const px = size === "lg" ? 112 : 96;

  return (
    <div
      className={`flex flex-col items-center gap-2 transition duration-500 ${
        dimmed ? "scale-95 opacity-40 blur-[1px]" : ""
      }`}
    >
      <div className={`relative flex ${box} items-center justify-center`}>
        {highlight && (
          <span className="absolute inset-0 rounded-full bg-tertiary/20 blur-md" />
        )}
        {src ? (
          <PokemonImage
            src={src}
            speciesName={name}
            alt={name}
            width={px}
            height={px}
            className={`relative ${img} object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]`}
          />
        ) : (
          <span className="relative text-label-sm capitalize text-on-surface">{name}</span>
        )}
        <span
          className={`evolve-pad absolute -bottom-1 left-1/2 h-2 w-[70%] -translate-x-1/2 rounded-[100%] ${
            highlight ? "bg-tertiary/55" : "bg-white/20"
          } blur-[2px]`}
        />
      </div>
      <span
        className={`text-[12px] font-medium capitalize ${
          highlight ? "text-white" : "text-on-surface"
        }`}
      >
        {name}
      </span>
    </div>
  );
}
