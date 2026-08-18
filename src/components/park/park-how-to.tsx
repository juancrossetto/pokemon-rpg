"use client";

import { useState } from "react";

/**
 * Botón "i" con las reglas del modo.
 *
 * Cada pantalla del Parque tenía una línea de texto corrida que mezclaba costo,
 * premio y mecánica: "Cavar cuesta 1 de energía. Hoy te quedan 5 picas.
 * Monedas: 80. Revive fósiles por 500." Se lee entero o no se entiende nada, y
 * la pregunta que quedaba sin responder era la más básica: qué gano y cómo lo
 * cobro. Acá son pasos numerados, plegados hasta que hagan falta.
 */
export function ParkHowTo({
  title,
  steps,
  openLabel,
}: {
  title: string;
  steps: string[];
  openLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`park-howto${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="park-howto__toggle"
        aria-expanded={open}
        aria-label={openLabel}
        onClick={() => setOpen(!open)}
      >
        <span className="material-symbols-outlined" aria-hidden>
          {open ? "close" : "help"}
        </span>
      </button>

      {open ? (
        <div className="park-howto__panel">
          <p className="park-howto__title">{title}</p>
          <ol>
            {steps.map((step, i) => (
              <li key={i}>
                <b>{i + 1}</b>
                {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
