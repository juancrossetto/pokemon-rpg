"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CdnImage } from "@/components/cdn-image";
import { ParkDailyResetClock } from "@/components/park/park-daily-reset-clock";
import {
  CORNER_FREE_SPINS_PER_DAY,
  CORNER_REELS,
  cornerPaytable,
  type CornerSymbol,
} from "@/lib/park/corner";
import {
  playCornerReelStop,
  startCornerSpinMusic,
  stopCornerSpinMusic,
} from "@/lib/corner-sfx";

/** Niño Bien del Game Corner: el anfitrión de la máquina. */
const HOST_ART = "/park/corner/host.png";

/*
  Arte de los rodillos.

  Los PNG salen de una lámina 2×2 recortada a mano y **no** tienen fondo
  transparente: el de la lámina es casi negro, igual que la ventana del rodillo,
  así que el borde del cuadrado se disimula con una máscara radial en el CSS.
  Se probó recortarlos por transparencia y no sale: el contorno negro de la
  Poké Ball toca el fondo, el relleno se cuela por ahí y parte el dibujo al
  medio. Ver el comentario de `.corner-slot__cell img` en `globals.css`.
*/
const REEL_ART: Record<CornerSymbol, string> = {
  ball: "/park/corner/ball.png",
  berry: "/park/corner/berry.png",
  star: "/park/corner/star.png",
  seven: "/park/corner/seven.png",
};

/**
 * Tira que gira dentro de cada rodillo.
 *
 * Es `CORNER_REELS` repetido: al girar se traslada exactamente el alto de una
 * vuelta, así el final empalma con el principio y el bucle no tiene costura.
 * Los símbolos son los reales del juego —no una lista decorativa—, así que lo
 * que pasa borroso es lo mismo que puede salir.
 */
const STRIP = [...CORNER_REELS, ...CORNER_REELS, ...CORNER_REELS];

/** Cuánto tarda cada rodillo en frenar. Escalonado: para izquierda a derecha. */
const STOP_DELAYS_MS = [640, 1100, 1680];
const MARQUEE_LAMPS = 7;

type SpinResult =
  | {
      ok: true;
      reels: [CornerSymbol, CornerSymbol, CornerSymbol];
      payout: number;
      energySpent: number;
      freeLeft: number;
    }
  | { ok: false; error: string };

type CornerSlotLabels = {
  spin: string;
  jackpot: string;
  freeRemaining: (n: number) => string;
  spinsLeft: (left: number, total: number) => string;
  dailyHint: string;
  resetIn: (time: string) => string;
  idleNudge: string;
  /** Voz del Niño Bien en el globito. */
  ready: string;
  spinning: string;
  win: string;
  nothing: string;
  hostJackpot: string;
  /** "×3" / "×2": cuántos iguales pide la fila. */
  match: (count: number) => string;
};

/**
 * Game Corner: tres rodillos con giro real.
 *
 * El resultado lo decide el servidor (`spinCornerAction`) antes de que frene
 * cualquier rodillo — la animación no sortea nada, sólo muestra lo que ya se
 * resolvió. Es la única forma honesta de animarlo: si el cliente eligiera los
 * símbolos y después confirmara, habría una ventana para manipularlos.
 *
 * Mientras giran no se sabe el resultado, y eso es a propósito: los rodillos
 * frenan uno por uno de izquierda a derecha, así el tercero se ve venir. Es lo
 * que hace que una máquina se sienta máquina.
 */
export function CornerSlot({
  disabled,
  cost,
  coinIcon,
  energyIcon,
  freeLeft,
  resetAt,
  resetMs,
  labels,
  spin,
  onResult,
  onResetExpired,
}: {
  disabled?: boolean;
  /** Energía que cobra un giro después de gastar las tiradas gratis. */
  cost: number;
  /** PNG de la moneda: los premios siguen pagando ●. */
  coinIcon: string;
  energyIcon: string;
  /** Tiradas gratis que quedan hoy. */
  freeLeft: number;
  resetAt: string;
  resetMs: number;
  labels: CornerSlotLabels;
  spin: () => Promise<SpinResult>;
  onResult: (result: SpinResult) => void;
  onResetExpired: () => void;
}) {
  const [reels, setReels] = useState<[CornerSymbol, CornerSymbol, CornerSymbol]>([
    "ball",
    "berry",
    "star",
  ]);
  /** Cuántos rodillos siguen girando. 0 = quietos. */
  const [spinning, setSpinning] = useState(0);
  const [outcome, setOutcome] = useState<"idle" | "win" | "jackpot" | "lose">("idle");
  const [payout, setPayout] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      // Si se desmonta a mitad de giro (cambio de pestaña del parque) hay que
      // limpiar los timers o intentan un `setState` sobre algo que ya no existe.
      for (const id of timers.current) clearTimeout(id);
      stopCornerSpinMusic("abort");
    },
    [],
  );

  const busy = spinning > 0;
  const spent = CORNER_FREE_SPINS_PER_DAY - freeLeft;
  const bubble = busy
    ? labels.spinning
    : outcome === "jackpot"
      ? labels.hostJackpot
      : outcome === "win"
        ? labels.win
        : outcome === "lose"
          ? labels.nothing
          : labels.ready;

  async function handleSpin() {
    if (busy || disabled) return;
    setOutcome("idle");
    setSpinning(3);
    startCornerSpinMusic();

    const result = await spin();

    if (!result.ok) {
      // Sin cobro no hay tirada: los rodillos vuelven a su sitio sin frenar en
      // falso, que se leería como una jugada perdida.
      setSpinning(0);
      stopCornerSpinMusic("abort");
      onResult(result);
      return;
    }

    setReels(result.reels);
    // Cada rodillo frena en su momento; el resultado se anuncia recién cuando
    // frenó el último, para no espoilear el giro con el texto.
    timers.current = STOP_DELAYS_MS.map((delay, i) =>
      setTimeout(() => {
        playCornerReelStop();
        setSpinning(2 - i);
        if (i === STOP_DELAYS_MS.length - 1) {
          const jackpot = result.reels.every((symbol) => symbol === "seven");
          setPayout(result.payout);
          const next = jackpot ? "jackpot" : result.payout > 0 ? "win" : "lose";
          setOutcome(next);
          stopCornerSpinMusic(next);
          onResult(result);
        }
      }, delay),
    );
  }

  return (
    <section className={`corner-slot is-${outcome}${busy ? " is-spinning" : ""}`}>
      <div className="corner-slot__stage">
        <header className="corner-slot__hud">
          <span
            className="corner-slot__spins"
            aria-label={labels.spinsLeft(freeLeft, CORNER_FREE_SPINS_PER_DAY)}
          >
            {Array.from({ length: CORNER_FREE_SPINS_PER_DAY }, (_, i) => (
              <i key={i} className={i < spent ? "is-spent" : undefined} aria-hidden>
                <span className="material-symbols-outlined">casino</span>
              </i>
            ))}
          </span>
          <b>{labels.spinsLeft(freeLeft, CORNER_FREE_SPINS_PER_DAY)}</b>
          {freeLeft > 0 ? <span className="corner-slot__nudge">{labels.idleNudge}</span> : null}
          <ParkDailyResetClock
            resetAt={resetAt}
            resetMs={resetMs}
            visible={freeLeft <= 0}
            label={labels.resetIn}
            onExpired={onResetExpired}
          />
        </header>
        <p className="corner-slot__hint">{labels.dailyHint}</p>

        <div className="corner-slot__floor">
          <div className="corner-slot__machine">
            <div className="corner-slot__cabinet">
              <div className="corner-slot__marquee" aria-hidden>
                {Array.from({ length: MARQUEE_LAMPS }, (_, i) => (
                  <span key={i} className="corner-slot__lamp" style={{ animationDelay: `${i * 0.11}s` }} />
                ))}
              </div>
              <div className="corner-slot__frame">
                {reels.map((symbol, i) => {
                  const reelSpinning = spinning > i;
                  return (
                    <div key={i} className="corner-slot__reel">
                      {reelSpinning ? (
                        <div className="corner-slot__strip" style={{ animationDelay: `${i * -0.12}s` }}>
                          {STRIP.map((stripSymbol, index) => (
                            <span key={index} className="corner-slot__cell" aria-hidden>
                              <Image src={REEL_ART[stripSymbol]} alt="" width={96} height={96} />
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="corner-slot__cell corner-slot__cell--landed">
                          <Image src={REEL_ART[symbol]} alt="" width={96} height={96} priority />
                        </span>
                      )}
                    </div>
                  );
                })}

                {outcome === "jackpot" ? <span className="corner-slot__jackpot">{labels.jackpot}</span> : null}
              </div>
            </div>

            {payout > 0 && !busy ? (
              <p className="corner-slot__result" aria-live="polite">
                <b>
                  +{payout}
                  <Image src={coinIcon} alt="" width={24} height={24} />
                </b>
                {outcome === "jackpot" ? <em>{labels.jackpot}</em> : null}
              </p>
            ) : (
              <p className="corner-slot__result is-idle" aria-hidden />
            )}
          </div>

          {/*
            El Niño Bien tiene su propia columna: si se lo posiciona absoluto
            queda pegado al borde y la máquina se encoje al centro. Acá comparte
            el piso con los rodillos, con aire entre los dos.
          */}
          <aside className="corner-slot__crew">
            <p key={bubble} className="corner-slot__bubble" aria-live="polite">
              {bubble}
            </p>
            <CdnImage
              src={HOST_ART}
              alt=""
              width={150}
              height={249}
              className="corner-slot__host"
              priority
            />
          </aside>
        </div>
      </div>

      {/*
        Tira de premios: los símbolos con su pago debajo, sin caja ni una
        pastilla por fila. La versión anterior era una card con seis subcards
        adentro —tres niveles de recuadro para seis números— y se leía como una
        tabla de precios, no como parte de la máquina.
      */}
      <ul className="corner-slot__odds">
        {cornerPaytable().map((row) => (
          <li key={`${row.symbol}-${row.count}`} className={row.jackpot ? "is-jackpot" : undefined}>
            <Image src={REEL_ART[row.symbol]} alt="" width={64} height={64} />
            <span>{labels.match(row.count)}</span>
            <b>
              <Image src={coinIcon} alt="" width={20} height={20} />
              {row.payout}
            </b>
          </li>
        ))}
      </ul>

      <div className="corner-slot__controls">
        <button
          type="button"
          className="corner-slot__lever"
          disabled={disabled || busy}
          onClick={() => void handleSpin()}
        >
          {freeLeft > 0 || busy ? (
            <span className="material-symbols-outlined" aria-hidden>
              {busy ? "autorenew" : "casino"}
            </span>
          ) : (
            <Image
              src={energyIcon}
              alt=""
              width={22}
              height={22}
              className="corner-slot__lever-energy"
            />
          )}
          <span className="corner-slot__lever-label">{labels.spin}</span>
          <span className="corner-slot__lever-meta">
            {freeLeft > 0 ? labels.freeRemaining(freeLeft) : `−${cost}`}
          </span>
        </button>
      </div>

      {/* La animación no comunica nada a un lector de pantalla: el resultado
          se anuncia por texto cuando los tres rodillos frenaron. */}
      <p className="sr-only" role="status">
        {busy ? "" : reels.join(" · ")}
      </p>
    </section>
  );
}
