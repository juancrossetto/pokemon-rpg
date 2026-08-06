/**
 * Piezas visuales del patrón "misión": barra por tramos y anillo de progreso.
 *
 * Viven acá y no dentro de una pantalla porque las usan tanto `/events` como el
 * panel de misiones del home, y la idea es que las dos superficies se lean como
 * el mismo sistema. Son presentacionales puras —sin hooks ni estado—, así que
 * las puede importar cualquier componente, servidor o cliente.
 *
 * Los estilos son las clases `.ev-*` de globals.css.
 */

/** Barra por tramos: degradé continuo de la 1ª a la última franja. */
export function SegmentedBar({
  pct,
  segments = 4,
}: {
  pct: number;
  segments?: number;
}) {
  const filled = (pct / 100) * segments;
  return (
    <span
      className="ev-seg"
      aria-hidden
      style={{ ["--ev-seg-n" as string]: segments }}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className="ev-seg__slot">
          <span
            className="ev-seg__fill"
            style={{
              width: `${Math.max(0, Math.min(1, filled - i)) * 100}%`,
              ["--ev-seg-i" as string]: i,
            }}
          />
        </span>
      ))}
    </span>
  );
}

/** Anillo con la fracción al centro. */
export function ProgressRing({
  current,
  target,
}: {
  current: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <span className="ev-ring">
      <svg viewBox="0 0 56 56" aria-hidden focusable="false">
        <circle className="ev-ring__track" cx="28" cy="28" r="23" pathLength={100} />
        <circle
          className="ev-ring__fill"
          cx="28"
          cy="28"
          r="23"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
        />
      </svg>
      <span className="ev-ring__label">
        {current}/{target}
      </span>
    </span>
  );
}
