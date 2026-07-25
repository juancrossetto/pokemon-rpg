"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { confirmEvolve, confirmLearnMove } from "@/actions/level-up-offers";
import { playBattleSfx } from "@/lib/battle-sfx";
import { typeColor } from "@/lib/type-colors";
import type { EvolveOffer, LevelUpMoveInfo } from "@/lib/level-up";
import { spriteFor } from "@/lib/shiny";

export type LevelUpOfferEntry = {
  instanceId: string;
  name: string;
  leveledUpTo: number | null;
  fromSpriteUrl?: string | null;
  autoTaught: LevelUpMoveInfo[];
  pendingMoves: LevelUpMoveInfo[];
  evolveOffer: EvolveOffer | null;
  knownMoves: { slot: number; name: string }[];
};

/**
 * Panel post level-up: un movimiento a la vez (aprender / reemplazar / ignorar)
 * y luego confirmar evolución.
 */
export function LevelUpOffersPanel({
  entries,
  onSettled,
}: {
  entries: LevelUpOfferEntry[];
  onSettled?: () => void;
}) {
  const t = useTranslations("levelUp");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(entries);
  const [picking, setPicking] = useState<{
    instanceId: string;
    move: LevelUpMoveInfo;
  } | null>(null);
  const [evolvingId, setEvolvingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{
    instanceId: string;
    toName: string;
    toSpriteUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = local.filter(
    (e) =>
      e.leveledUpTo != null &&
      (e.autoTaught.length > 0 ||
        e.pendingMoves.length > 0 ||
        e.evolveOffer ||
        revealed?.instanceId === e.instanceId),
  );

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
      if (!still) onSettled?.();
      return next;
    });
  }

  /** Diferir: no evoluciona; el próximo level-up vuelve a ofrecer. */
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
      if (!still) onSettled?.();
      return next;
    });
  }

  function skipMove(instanceId: string, moveId: number) {
    setPicking(null);
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
        onSettled?.();
      }
      return next;
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
      setPicking(null);
      setLocal((prev) =>
        prev.map((e) => {
          if (e.instanceId !== instanceId) return e;
          const learned = e.pendingMoves.find((m) => m.moveId === moveId);
          const pendingMoves = e.pendingMoves.filter((m) => m.moveId !== moveId);
          let knownMoves = e.knownMoves;
          if (learned) {
            if (replaceSlot != null) {
              knownMoves = knownMoves.map((k) =>
                k.slot === replaceSlot ? { slot: replaceSlot, name: learned.name } : k,
              );
            } else {
              const used = new Set(knownMoves.map((k) => k.slot));
              const empty = [1, 2, 3, 4].find((s) => !used.has(s));
              if (empty != null) {
                knownMoves = [...knownMoves, { slot: empty, name: learned.name }];
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

  function evolve(instanceId: string, offer: EvolveOffer) {
    setError(null);
    setEvolvingId(instanceId);
    playBattleSfx("evolve");
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
      setLocal((prev) =>
        prev.map((e) =>
          e.instanceId === instanceId
            ? { ...e, evolveOffer: null, name: result.toName }
            : e,
        ),
      );
      window.setTimeout(() => {
        setEvolvingId(null);
        window.setTimeout(() => {
          dismissEntry(instanceId);
          router.refresh();
        }, 1600);
      }, 900);
    });
  }

  return (
    <section className="space-y-3" aria-live="polite">
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

        return (
          <div
            key={entry.instanceId}
            className={
              evolveOnly
                ? undefined
                : "relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#121212] shadow-[0_20px_48px_rgba(0,0,0,0.45)]"
            }
          >
            {!evolveOnly && (
              <div className="relative px-4 pb-1 pt-4">
                <div
                  className="pointer-events-none absolute inset-0 opacity-80"
                  style={{
                    background: current
                      ? `radial-gradient(ellipse 90% 70% at 0% 0%, ${typeColor(current.type)}40 0%, transparent 55%)`
                      : "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(255,255,255,0.08), transparent 55%)",
                  }}
                />
                <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                  {t("title", { name: entry.name, level: entry.leveledUpTo ?? 0 })}
                </p>
              </div>
            )}

            {entry.autoTaught.length > 0 && (
              <ul className="relative space-y-1.5 px-4 pt-2">
                {entry.autoTaught.map((m) => (
                  <li
                    key={`auto-${m.moveId}`}
                    className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[12px] text-emerald-100"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: typeColor(m.type), boxShadow: `0 0 8px ${typeColor(m.type)}88` }}
                    />
                    <span className="capitalize">{t("learned", { move: m.name })}</span>
                  </li>
                ))}
              </ul>
            )}

            {current && (
              <div className="relative px-4 pb-4 pt-2">
                <div
                  className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${typeColor(current.type)}22`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                      style={{
                        background: `linear-gradient(145deg, ${typeColor(current.type)}55, ${typeColor(current.type)}18)`,
                      }}
                    >
                      <span
                        className="material-symbols-outlined text-[26px]! text-white"
                        style={{ filter: `drop-shadow(0 0 8px ${typeColor(current.type)})` }}
                      >
                        bolt
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        {t("newMove")}
                      </p>
                      <p className="mt-0.5 truncate text-[17px] font-bold capitalize tracking-tight text-white">
                        {current.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                          style={{ color: typeColor(current.type) }}
                        >
                          {current.type}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[9px] text-white/55">
                          PP {current.pp}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[9px] text-white/55">
                          Nv. {current.learnLevel}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-snug text-white/65">
                        {t("wantsToLearn", { move: current.name })}
                      </p>
                      {remaining > 0 && (
                        <p className="mt-1 text-[10px] text-white/40">
                          {t("morePending", { count: remaining })}
                        </p>
                      )}
                    </div>
                  </div>

                  {picking?.instanceId === entry.instanceId &&
                  picking.move.moveId === current.moveId ? (
                    <div className="mt-4 space-y-1.5 border-t border-white/8 pt-3">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
                        {t("forgetWhich")}
                      </p>
                      {entry.knownMoves.map((k) => (
                        <button
                          key={k.slot}
                          type="button"
                          disabled={pending}
                          onClick={() => learn(entry.instanceId, current.moveId, k.slot)}
                          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-[13px] text-white transition hover:border-pokeball-red/45 hover:bg-pokeball-red/10 disabled:opacity-50"
                        >
                          <span className="capitalize">{k.name}</span>
                          <span className="font-mono text-[10px] text-white/40">#{k.slot}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setPicking(null)}
                        className="mt-1 w-full rounded-xl px-3 py-2 text-[12px] text-white/50 transition hover:bg-white/5 hover:text-white"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      {hasEmptySlot ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => learn(entry.instanceId, current.moveId, null)}
                          className="flex-1 rounded-xl bg-pokeball-red px-4 py-3 text-[13px] font-bold tracking-wide text-white shadow-[0_8px_24px_rgba(238,21,21,0.28)] transition hover:brightness-110 disabled:opacity-50"
                        >
                          {t("learn")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            setPicking({ instanceId: entry.instanceId, move: current })
                          }
                          className="flex-1 rounded-xl bg-pokeball-red px-4 py-3 text-[13px] font-bold tracking-wide text-white shadow-[0_8px_24px_rgba(238,21,21,0.28)] transition hover:brightness-110 disabled:opacity-50"
                        >
                          {t("replace")}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => skipMove(entry.instanceId, current.moveId)}
                        className="rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-[13px] font-medium text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-50 sm:min-w-28"
                      >
                        {t("skipMove")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {reveal && (
              <EvolveReveal
                name={reveal.toName}
                spriteUrl={reveal.toSpriteUrl}
                label={t("evolvedInto", { name: reveal.toName })}
              />
            )}

            {offer && entry.pendingMoves.length === 0 && !reveal && (
              <div className={evolveOnly ? undefined : "px-4 pb-4"}>
                <EvolveOfferCard
                  fromName={entry.name}
                  fromSpriteUrl={entry.fromSpriteUrl}
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
                  onEvolve={() => evolve(entry.instanceId, offer)}
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

function EvolveOfferCard({
  fromName,
  fromSpriteUrl,
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
  const fromSrc = fromSpriteUrl ? spriteFor(fromSpriteUrl, false) : null;
  const toSrc = spriteFor(offer.toSpriteUrl, false);

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
  label,
}: {
  name: string;
  spriteUrl: string;
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
          <Image
            src={spriteFor(spriteUrl, false)}
            alt={name}
            width={112}
            height={112}
            className="relative h-28 w-28 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
            unoptimized
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
          <Image
            src={src}
            alt={name}
            width={px}
            height={px}
            className={`relative ${img} object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]`}
            unoptimized
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
