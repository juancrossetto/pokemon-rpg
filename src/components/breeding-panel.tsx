"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { breedPair, hatchEgg } from "@/actions/breeding";
import { BREEDING_COST, BREEDING_MIN_LEVEL } from "@/lib/breeding";

export type BreedCandidate = {
  id: string;
  name: string;
  level: number;
  spriteUrl: string;
};

export type EggView = {
  id: string;
  speciesName: string;
  spriteUrl: string;
  isShiny: boolean;
  /** Calculado en el servidor: el render no puede leer el reloj. */
  ready: boolean;
  minutesLeft: number;
};

/** Cría: dos Pokémon de la PC producen un huevo que hereda parte de sus puntos. */
export function BreedingPanel({
  locale,
  candidates,
  eggs,
}: {
  locale: string;
  candidates: BreedCandidate[];
  eggs: EggView[];
}) {
  const t = useTranslations("breeding");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setError(null);
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2),
    );
  }

  function breed() {
    if (picked.length !== 2) return;
    startTransition(async () => {
      const result = await breedPair(locale, picked[0], picked[1]);
      if (result.ok) setPicked([]);
      else setError(result.error);
    });
  }

  function hatch(eggId: string) {
    startTransition(async () => {
      const result = await hatchEgg(locale, eggId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="glass-panel mt-8 rounded-xl border border-white/10 p-4">
      <h2 className="mb-1 flex items-center gap-2 text-headline-md text-on-surface">
        <span className="material-symbols-outlined text-[20px]! text-tertiary">egg</span>
        {t("title")}
      </h2>
      <p className="mb-3 text-label-sm text-on-surface-variant">
        {t("hint", { level: BREEDING_MIN_LEVEL, cost: BREEDING_COST })}
      </p>

      {eggs.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {eggs.map((egg) => {
            return (
              <div
                key={egg.id}
                className="flex items-center gap-2.5 rounded-lg border border-tertiary/30 bg-tertiary/[0.06] px-3 py-2"
              >
                <span className="material-symbols-outlined text-[22px]! text-tertiary">egg</span>
                <div className="min-w-0">
                  <p className="text-label-md capitalize text-on-surface">
                    {egg.speciesName}
                    {egg.isShiny && <span className="ml-1 text-tertiary">★</span>}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">
                    {egg.ready ? t("ready") : t("hatchingIn", { minutes: egg.minutesLeft })}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!egg.ready || pending}
                  onClick={() => hatch(egg.id)}
                  className="rounded-lg bg-tertiary px-3 py-1.5 text-label-sm font-semibold text-surface transition hover:bg-tertiary/85 disabled:opacity-40"
                >
                  {t("hatch")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {candidates.length < 2 ? (
        <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-label-sm text-on-surface-variant">
          {t("needTwo", { level: BREEDING_MIN_LEVEL })}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {candidates.map((mon) => {
              const selected = picked.includes(mon.id);
              return (
                <button
                  key={mon.id}
                  type="button"
                  onClick={() => toggle(mon.id)}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
                    selected
                      ? "border-tertiary bg-tertiary/15"
                      : "border-white/10 bg-black/20 hover:bg-white/5"
                  }`}
                >
                  <Image
                    src={mon.spriteUrl}
                    alt={mon.name}
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                  <span className="text-label-sm capitalize text-on-surface">{mon.name}</span>
                  <span className="text-[10px] text-on-surface-variant">Nv. {mon.level}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={picked.length !== 2 || pending}
            onClick={breed}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-pokeball-red px-4 py-2 text-label-sm font-semibold text-white transition hover:bg-pokeball-red/85 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]!">egg_alt</span>
            {t("breed")}
            <span className="inline-flex items-center gap-0.5 font-mono">
              <span className="material-symbols-outlined text-[14px]!">paid</span>
              {BREEDING_COST}
            </span>
          </button>
        </>
      )}

      {error && <p className="mt-2 text-label-sm text-error">{t(`errors.${error}`)}</p>}
    </section>
  );
}
