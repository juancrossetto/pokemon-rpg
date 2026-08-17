import { CdnImage as Image } from "@/components/cdn-image";
import type { CSSProperties } from "react";
import type { RankProgress } from "@/lib/trainer-profile";

/**
 * Piezas compartidas del perfil. Todas son presentacionales y sin estado, así
 * que viven en un componente de servidor: sólo la banda del equipo y la bóveda
 * necesitan interacción, y esas sí son de cliente.
 */

/**
 * Marco del avatar. No es un círculo con borde: es un hexágono recortado con
 * `clip-path`, con el metal del rango como fondo y el retrato incrustado un
 * poco más adentro. El relieve sale de tres capas —metal, luz superior interna
 * y sombra inferior interna—, no de un `box-shadow` suelto, porque `clip-path`
 * recorta las sombras exteriores y dejaría el borde plano.
 *
 * Los sprites de entrenador de Showdown son 80×80 con mucho padding
 * transparente: sin zoom quedan como un monigote en el centro del hexágono.
 * Escalamos ~1.9× y recortamos el aire vacío (piernas/márgenes).
 */
export function RankFrame({
  src,
  alt,
  rank,
  size = 132,
  breathe = true,
}: {
  src: string | null;
  alt: string;
  rank: RankProgress["tier"];
  size?: number;
  breathe?: boolean;
}) {
  const hex = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
  /* Antes 0.86: el bisel de metal comía demasiado el retrato. */
  const inner = Math.round(size * 0.9);

  return (
    <div
      className={`relative shrink-0 ${breathe ? "tp-breathe" : ""}`}
      style={{ width: size, height: size }}
    >
      {/* Halo exterior — vive fuera del recorte, por eso va en su propia capa */}
      <span
        aria-hidden
        className="tp-halo absolute -inset-3 rounded-full blur-xl"
        style={{ background: rank.glow }}
      />

      {/* Placa de metal */}
      <div
        className="absolute inset-0"
        style={{ clipPath: hex, background: rank.metal }}
      />
      {/* Bisel: luz arriba, sombra abajo */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: hex,
          background:
            "linear-gradient(160deg,rgba(255,255,255,0.55) 0%,transparent 38%,transparent 62%,rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Retrato */}
      <div
        className="absolute overflow-hidden bg-[#0b0d12]"
        style={{
          clipPath: hex,
          width: inner,
          height: inner,
          left: (size - inner) / 2,
          top: (size - inner) / 2,
        }}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            width={inner}
            height={inner}
            unoptimized
            className="trainer-sprite-fill h-full w-full"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/70">
            {alt.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Partículas ambientales del hero, teñidas con el color del Pokémon favorito.
 *
 * Deterministas: las posiciones salen de un índice, no de `Math.random()`, que
 * daría marcas distintas en servidor y cliente y rompería la hidratación.
 */
export function Ambience({ color, count = 14 }: { color: string; count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 37) % 100;
        const bottom = (i * 23) % 60;
        const size = 2 + (i % 3);
        return (
          <span
            key={i}
            className="tp-drift absolute rounded-full"
            style={
              {
                left: `${left}%`,
                bottom: `${bottom}%`,
                width: size,
                height: size,
                background: color,
                boxShadow: `0 0 ${4 + size}px ${color}`,
                "--tp-drift-dur": `${6 + (i % 5)}s`,
                "--tp-drift-x": `${((i % 5) - 2) * 7}px`,
                "--tp-drift-peak": 0.35 + (i % 4) * 0.12,
                animationDelay: `${-(i * 0.8)}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** Barra de progreso con relleno animado por CSS. */
export function ProgressRail({
  pct,
  color,
  toColor,
  height = 6,
  delayMs = 0,
}: {
  pct: number;
  color: string;
  /** Si viene, el relleno va de `color` → `toColor` (p. ej. naranja flúor → amarillo). */
  toColor?: string;
  height?: number;
  delayMs?: number;
}) {
  const fill = toColor
    ? `linear-gradient(90deg, ${color}, ${toColor})`
    : `linear-gradient(90deg,${color}99,${color})`;

  return (
    <div
      className="w-full overflow-hidden rounded-full bg-white/8"
      style={{ height }}
      role="presentation"
    >
      <div
        className="tp-fill h-full rounded-full"
        style={
          {
            "--tp-fill": `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`,
            background: fill,
            boxShadow: `0 0 10px ${color}88`,
            animationDelay: `${delayMs}ms`,
          } as CSSProperties
        }
      />
    </div>
  );
}

/**
 * Riel de progreso del hero.
 *
 * Más alto que `ProgressRail`, con degradé de tres paradas —del acento apagado
 * al acento pleno y remate casi blanco en la punta—, brillo propio y un
 * destello que recorre la parte llena. El degradé se pinta sobre el ancho total
 * del riel y no sobre el relleno, así el color en un punto dado no cambia
 * cuando el progreso avanza: la punta siempre es la parte clara.
 */
export function GradientRail({
  pct,
  color,
  delayMs = 0,
}: {
  pct: number;
  color: string;
  delayMs?: number;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <div className="tp-rail relative h-2 w-full overflow-hidden rounded-full">
      <div
        className="tp-rail__fill absolute inset-y-0 left-0 rounded-full"
        style={
          {
            "--tp-fill": `${Math.round(clamped * 100)}%`,
            "--tp-accent": color,
            animationDelay: `${delayMs}ms`,
          } as CSSProperties
        }
      />
    </div>
  );
}

/**
 * Widget de métrica legacy — preferí `@/components/metric-tile` en perfil.
 * Se mantiene por si algún bloque aún lo importa.
 */
export function MetricTile({
  icon,
  label,
  value,
  hint,
  accent = "var(--color-pokeball-red)",
  delayMs = 0,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  delayMs?: number;
}) {
  return (
    <div
      className="tp-rise relative flex h-[88px] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[15px]!" style={{ color: accent }}>
          {icon}
        </span>
        <p className="truncate text-[9px] uppercase tracking-[0.16em] text-on-surface-variant/70">
          {label}
        </p>
      </div>
      <p className="font-mono text-[22px] font-bold text-white tabular-nums">{value}</p>
      <p className="truncate text-[9px] text-on-surface-variant/55">{hint ?? "\u00a0"}</p>
    </div>
  );
}

/** Etiqueta pequeña de sección, con la línea de acento del juego. */
export function SectionLabel({
  children,
  color = "var(--color-pokeball-red)",
}: {
  children: React.ReactNode;
  /** Color del punto y del texto. Por defecto rojo Pokéball. */
  color?: string;
}) {
  return (
    <p
      className="mb-2.5 flex items-center gap-2 text-label-sm uppercase tracking-[0.2em]"
      style={{ color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </p>
  );
}
