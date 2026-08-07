"use client";

import { isStatusCondition } from "@/lib/status";

/**
 * Capa de efecto sobre el sprite según el estado no volátil. El badge de la
 * placa dice *qué* estado es; esto lo hace legible de un vistazo sin leer.
 *
 * Todo es transform/opacity en bucle: nada de `filter` animado, que obliga a
 * re-rasterizar el GIF del Pokémon en cada frame (ver `.sprite-materialize`).
 * Las piezas se miden en % de la caja del sprite para escalar con él.
 */
export function SpriteStatusFx({ status }: { status?: string | null }) {
  if (!status || !isStatusCondition(status)) return null;

  return (
    <span className={`status-fx status-fx--${status.toLowerCase()}`} aria-hidden>
      {status === "SLEEP" &&
        SLEEP_ZS.map((z, i) => (
          <span
            key={i}
            className="status-fx__z"
            style={{ "--z-delay": `${z.delay}s`, "--z-size": `${z.size}em` } as React.CSSProperties}
          >
            Z
          </span>
        ))}

      {status === "PARALYSIS" && (
        <>
          <span className="status-fx__bolt status-fx__bolt--a" />
          <span className="status-fx__bolt status-fx__bolt--b" />
          <span className="status-fx__bolt status-fx__bolt--c" />
          <span className="status-fx__zap" />
        </>
      )}

      {status === "POISON" &&
        POISON_BUBBLES.map((b, i) => (
          <span
            key={i}
            className="status-fx__bubble"
            style={
              {
                "--b-x": `${b.x}%`,
                "--b-delay": `${b.delay}s`,
                "--b-dur": `${b.dur}s`,
                "--b-size": `${b.size}px`,
                "--b-drift": `${b.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}

      {status === "BURN" && (
        <>
          <span className="status-fx__flame status-fx__flame--a" />
          <span className="status-fx__flame status-fx__flame--b" />
          <span className="status-fx__flame status-fx__flame--c" />
          {EMBERS.map((e, i) => (
            <span
              key={i}
              className="status-fx__ember"
              style={
                {
                  "--e-x": `${e.x}%`,
                  "--e-delay": `${e.delay}s`,
                  "--e-dur": `${e.dur}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </>
      )}

      {status === "FREEZE" && (
        <>
          <span className="status-fx__frost" />
          {CRYSTALS.map((c, i) => (
            <span
              key={i}
              className="status-fx__crystal"
              style={
                {
                  "--c-x": `${c.x}%`,
                  "--c-y": `${c.y}%`,
                  "--c-delay": `${c.delay}s`,
                  "--c-size": `${c.size}px`,
                } as React.CSSProperties
              }
            />
          ))}
          <span className="status-fx__shimmer" />
        </>
      )}
    </span>
  );
}

/* Tablas fijas y no aleatorias: con Math.random() el markup del server y el
   del cliente no coinciden y React tira mismatch de hidratación. */
const SLEEP_ZS = [
  { delay: 0, size: 1 },
  { delay: 1.1, size: 0.78 },
  { delay: 2.2, size: 0.6 },
] as const;

const POISON_BUBBLES = [
  { x: 34, delay: 0, dur: 2.6, size: 7, drift: 10 },
  { x: 52, delay: 0.7, dur: 3.1, size: 5, drift: -8 },
  { x: 66, delay: 1.4, dur: 2.4, size: 8, drift: 6 },
  { x: 44, delay: 2.0, dur: 2.9, size: 4, drift: -5 },
] as const;

const EMBERS = [
  { x: 38, delay: 0, dur: 1.6 },
  { x: 52, delay: 0.5, dur: 1.9 },
  { x: 62, delay: 1.0, dur: 1.4 },
  { x: 46, delay: 1.4, dur: 1.75 },
] as const;

const CRYSTALS = [
  { x: 30, y: 38, delay: 0, size: 9 },
  { x: 66, y: 30, delay: 0.6, size: 7 },
  { x: 50, y: 62, delay: 1.2, size: 11 },
  { x: 72, y: 58, delay: 1.8, size: 6 },
] as const;
