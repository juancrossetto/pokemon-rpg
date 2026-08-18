"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useEffect, useRef, useState } from "react";
import { PokemonImage } from "@/components/pokemon-image";
import { SpeciesFragmentArt } from "@/components/species-fragment-art";
import { ParkDailyResetClock } from "@/components/park/park-daily-reset-clock";
import { FISHING_FREE_CASTS_PER_DAY } from "@/lib/park/fishing";
import type { DexRarity } from "@/lib/pokedex";

const FISHER_ART = "/park/fisher.png";

/** Cuánto flota el corcho antes de que se sepa si picó. */
const CAST_MS = 1400;

export type CastResult =
  | {
      ok: true;
      speciesName: string;
      speciesId: number;
      level: number;
      rarity: "common" | "uncommon" | "rare";
      dexRarity: DexRarity;
      caught: boolean;
      shiny: boolean;
      gained: number;
      have: number;
      need: number;
      assembled: boolean;
      energySpent: number;
      freeLeft: number;
    }
  | { ok: false; error: string };

export type FishingLabels = {
  cast: string;
  casting: string;
  idle: string;
  catchText: (name: string) => string;
  fragmentText: (name: string, have: number, need: number) => string;
  assembledText: (name: string) => string;
  shinyText: (name: string) => string;
  missText: (name: string) => string;
  castsLeft: (left: number, total: number) => string;
  dailyHint: string;
  resetIn: (time: string) => string;
  freeRemaining: (n: number) => string;
  idleNudge: string;
  /** Ficha de la captura. */
  level: (n: number) => string;
  rarity: (rarity: "common" | "uncommon" | "rare") => string;
  sentToPc: string;
  fragmentProgress: (have: number, need: number) => string;
  fragmentTag: string;
  shinyTag: string;
  escaped: string;
  fragmentsTitle: string;
};

export type FishingProgress = {
  speciesId: number;
  speciesName: string;
  spriteUrl: string;
  quantity: number;
  dexRarity: DexRarity;
};

/**
 * Pesca: el estanque, el pescador y la caña.
 *
 * La versión anterior era un párrafo y un botón: no había estanque, ni espera,
 * ni nada que mirar entre que tocabas y aparecía el texto del resultado. Acá el
 * lance dura, el corcho flota, y lo que picó sale del agua.
 *
 * El resultado lo decide el servidor antes de que empiece la espera; la espera
 * es puesta en escena, no un sorteo. Se muestra recién al final para que el
 * texto no adelante lo que el agua todavía no mostró.
 */
export function ParkFishing({
  labels,
  busy,
  progress,
  need,
  freeLeft,
  energy,
  energyCost,
  energyIcon,
  resetAt,
  resetMs,
  onResetExpired,
  onCast,
}: {
  labels: FishingLabels;
  busy: boolean;
  progress: FishingProgress[];
  need: number;
  freeLeft: number;
  energy: number;
  energyCost: number;
  energyIcon: string;
  resetAt: string;
  resetMs: number;
  onResetExpired: () => void;
  onCast: () => Promise<CastResult>;
}) {
  const [casting, setCasting] = useState(false);
  const [result, setResult] = useState<CastResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function handleCast() {
    if (casting || busy || blocked) return;
    setCasting(true);
    setResult(null);

    const [outcome] = await Promise.all([
      onCast(),
      // La espera corre en paralelo al pedido: si el servidor tarda más que la
      // animación, manda el servidor; si tarda menos, igual se ve el lance.
      new Promise((resolve) => {
        timer.current = setTimeout(resolve, CAST_MS);
      }),
    ]);

    setCasting(false);
    setResult(outcome);
  }

  const caught = result?.ok && result.caught ? result : null;
  const bubble = !result
    ? casting
      ? labels.casting
      : labels.idle
    : !result.ok
      ? labels.idle
      : result.caught
        ? result.shiny
          ? labels.shinyText(result.speciesName)
          : result.assembled
            ? labels.assembledText(result.speciesName)
            : labels.fragmentText(result.speciesName, result.have, result.need)
        : labels.missText(result.speciesName);

  const spent = FISHING_FREE_CASTS_PER_DAY - freeLeft;
  const blocked = freeLeft <= 0 && energy < energyCost;

  return (
    <section className="fishing">
      <header className="fishing__hud">
        <span className="fishing__casts" aria-label={labels.castsLeft(freeLeft, FISHING_FREE_CASTS_PER_DAY)}>
          {Array.from({ length: FISHING_FREE_CASTS_PER_DAY }, (_, i) => (
            <i key={i} className={i < spent ? "is-spent" : undefined} aria-hidden>
              <span className="material-symbols-outlined">phishing</span>
            </i>
          ))}
        </span>
        <b>{labels.castsLeft(freeLeft, FISHING_FREE_CASTS_PER_DAY)}</b>
        {freeLeft > 0 ? <span className="fishing__nudge">{labels.idleNudge}</span> : null}
        <ParkDailyResetClock
          resetAt={resetAt}
          resetMs={resetMs}
          visible
          label={labels.resetIn}
          onExpired={onResetExpired}
        />
      </header>
      <p className="fishing__hint">{labels.dailyHint}</p>
      <div className={`fishing__pond${casting ? " is-casting" : ""}`}>
        {/* Agua: tres bandas de onda a distinta velocidad. El movimiento lento
            es lo que hace que el estanque no se lea como un rectángulo azul. */}
        <span className="fishing__water" aria-hidden />
        <span className="fishing__ripples" aria-hidden />

        {/* Corcho: cae al lanzar, flota mientras se espera y se hunde al picar. */}
        <span className={`fishing__bobber${casting ? " is-floating" : ""}`} aria-hidden>
          <i />
        </span>

        {/* Lo que salió del agua. */}
        {caught ? (
          /*
            Ficha de la captura, no sólo el sprite.

            Con la imagen sola había que adivinar qué entró: el nombre estaba en
            el globito del pescador y no se decía a dónde iba. Acá van juntos
            quién picó, si es fragmento o Pokémon armado, y dónde quedó.
          */
          <span key={`${caught.speciesId}-${caught.have}-${caught.assembled}-${caught.shiny}`} className="fishing__catch">
            {caught.shiny || caught.assembled ? (
              <PokemonImage
                speciesId={caught.speciesId}
                speciesName={caught.speciesName}
                isShiny={caught.shiny}
                alt={caught.speciesName}
                width={128}
                height={128}
              />
            ) : (
              <SpeciesFragmentArt
                speciesId={caught.speciesId}
                speciesName={caught.speciesName}
                size={128}
                rarity={caught.dexRarity}
                alt={caught.speciesName}
              />
            )}
            <span className="fishing__card">
              <b>{caught.speciesName}</b>
              <span className="fishing__tags">
                {caught.shiny || caught.assembled ? (
                  <i>{labels.level(caught.level)}</i>
                ) : (
                  <i className="is-fragment">{labels.fragmentTag}</i>
                )}
                <i className={`is-${caught.rarity}`}>{labels.rarity(caught.rarity)}</i>
                {caught.shiny ? <i className="is-shiny">{labels.shinyTag}</i> : null}
              </span>
              <em>
                {caught.shiny || caught.assembled
                  ? labels.sentToPc
                  : labels.fragmentProgress(caught.have, caught.need)}
              </em>
            </span>
          </span>
        ) : null}

        {/* La que se escapó deja su rastro: sin esto, fallar y no tirar se
            veían igual. */}
        {result?.ok && !result.caught ? (
          <span key={`miss-${result.speciesName}`} className="fishing__escape">
            <PokemonImage
              speciesId={result.speciesId}
              speciesName={result.speciesName}
              alt=""
              width={96}
              height={96}
            />
            <i>{labels.escaped}</i>
          </span>
        ) : null}

        {/* Pescador en la orilla, con su globito — igual que el minero. */}
        <aside className="fishing__crew">
          <p key={bubble} className="fishing__bubble" aria-live="polite">
            {bubble}
          </p>
          <Image src={FISHER_ART} alt="" width={250} height={359} className="fishing__fisher" priority fadeIn />
        </aside>
      </div>

      <div className="fishing__controls">
        <button
          type="button"
          className="fishing__cast"
          disabled={busy || casting || blocked}
          onClick={() => void handleCast()}
        >
          {freeLeft > 0 || casting ? (
            <span className="material-symbols-outlined" aria-hidden>
              {casting ? "waves" : "phishing"}
            </span>
          ) : (
            <Image
              src={energyIcon}
              alt=""
              width={22}
              height={22}
              className="fishing__cast-energy"
            />
          )}
          <span className="fishing__cast-label">{casting ? labels.casting : labels.cast}</span>
          <span className="fishing__cast-meta">
            {freeLeft > 0 ? labels.freeRemaining(freeLeft) : `−${energyCost}`}
          </span>
        </button>
      </div>
      {progress.length > 0 ? (
        <ul className="fishing__frags">
          <li className="fishing__frags-label">{labels.fragmentsTitle}</li>
          {progress.map((row) => (
            <li key={row.speciesId}>
              <SpeciesFragmentArt
                speciesId={row.speciesId}
                speciesName={row.speciesName}
                size={40}
                rarity={row.dexRarity}
                alt=""
              />
              <b>{row.speciesName}</b>
              <em>{labels.fragmentProgress(row.quantity, need)}</em>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
