import Image from "next/image";

/**
 * Iconografía de la campaña.
 *
 * Los nodos del camino usan PNG a color. Objetivos y resumen siguen en SVG
 * inline sobre 24×24 con `currentColor`, para convivir con Material Symbols.
 *
 * Convención SVG: trazo de 1.4–1.7 y esquinas redondeadas.
 */
export type ZoneIconProps = { className?: string };

/** Sprites del camino: reemplazan los SVG monocromo en la lista de zonas. */
const PATH_ICON_SRC: Record<"town" | "route" | "forest" | "dungeon" | "gym", string> = {
  town: "/campaign/path-icons/town.png",
  route: "/campaign/path-icons/route.png",
  forest: "/campaign/path-icons/forest.png",
  dungeon: "/campaign/path-icons/dungeon.png",
  gym: "/campaign/path-icons/gym.png",
};

/** Ciudad: edificios con el techo del Centro Pokémon marcado. */
export function CityIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 21V11l4-2.5L11 11v10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M13 21V7l4-3 4 3v14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14.8 10.5h4.4" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5" y="13" width="2" height="2" fill="currentColor" opacity="0.7" />
      <rect x="5" y="17" width="2" height="2" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/** Ruta: el cartel de dos tablas que marca la bifurcación. */
export function RouteIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M8 4.5V21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M8 5.6h9.8l2.4 2.4-2.4 2.4H8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 12.7H4.2L1.8 15.1l2.4 2.4H8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Bosque: dos coníferas, la de atrás más chica para dar profundidad. */
export function ForestIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M15.5 4.5 19 10h-1.8l2.6 4.2h-6.6L15.5 10h-1.8z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        opacity="0.65"
      />
      <path d="M15.5 14.2V18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.65" />
      <path
        d="M8 6.5 12.2 13H9.9l3.1 5H3L6.1 13H3.8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 18v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Cueva: la boca de la montaña. */
export function CaveIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M2 19 9 6.5 13 13l2.4-3.6L22 19z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.2 19v-3.4a3.6 3.6 0 0 1 7.2 0V19"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  );
}

/** Gimnasio: la silueta de medalla, no una pesa de gimnasio de barrio. */
export function GymIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2.6l2.6 1.9 3.2.2 1 3 2 2.5-2 2.5-1 3-3.2.2L12 17.8 9.4 15.9l-3.2-.2-1-3-2-2.5 2-2.5 1-3 3.2-.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.2" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.4 17.6 7 22l5-2.2L17 22l-1.4-4.4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Íconos de progreso y contenido ──────────────────────────────────── */

/** Pokébola. Silueta para lo que todavía no viste, llena para lo capturado. */
export function PokeballIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h5.6M15.4 12H21" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Pokédex: la tapa abierta con la lente. */
export function PokedexIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="3"
        y="3.5"
        width="18"
        height="17"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M10.5 3.5v17" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.7" cy="7.6" r="1.9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.6 8h4.2M13.6 12h4.2M13.6 16h2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Entrenador: la gorra. Más reconocible que un monigote. */
export function TrainerIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3.4 15.4a8.6 8.6 0 0 1 17.2 0z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 6.8V4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 15.4h8.8l1.4 2.4H12z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="10.6" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Huella: los stages explorados de una zona. */
export function FootprintIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <ellipse cx="12" cy="15.5" rx="4.6" ry="4" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="6.2" cy="8.4" rx="2.2" ry="2.7" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="11.4" cy="6.2" rx="2.1" ry="2.6" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="16.8" cy="8" rx="2.1" ry="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Estrella de maestría. */
export function MasteryIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.7l6.1-.9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mapa plegado: zonas abiertas. */
export function MapIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9 4.4 3 6.6v13l6-2.2 6 2.2 6-2.2v-13L15 6.6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 4.4v13M15 6.6v13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Destello: shinies. */
export function SparkleIcon({ className = "" }: ZoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2.8c.7 4.6 1.8 5.7 6.4 6.4-4.6.7-5.7 1.8-6.4 6.4-.7-4.6-1.8-5.7-6.4-6.4 4.6-.7 5.7-1.8 6.4-6.4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M18.4 15.2c.35 2.3.9 2.85 3.2 3.2-2.3.35-2.85.9-3.2 3.2-.35-2.3-.9-2.85-3.2-3.2 2.3-.35 2.85-.9 3.2-3.2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS = {
  town: CityIcon,
  route: RouteIcon,
  forest: ForestIcon,
  dungeon: CaveIcon,
  gym: GymIcon,
} as const;

export type ZoneIconKind = keyof typeof ICONS;

export function ZoneIcon({ kind, className }: { kind: ZoneIconKind; className?: string }) {
  const src = PATH_ICON_SRC[kind];
  if (src) {
    // La plaza isométrica tiene más aire transparente que los otros sprites;
    // un poco más grande equilibra el peso visual en el nodo.
    const scale = kind === "town" ? "scale-[1.35]" : "";
    // Sin `unoptimized`: el arte de origen es de ~584×610 y acá se pinta a
    // 28px, así que el navegador bajaba y decodificaba la imagen entera
    // (medido en campaña: 114× los píxeles necesarios). Son PNG estáticos
    // locales, no hay animación que el optimizador pueda romper.
    return (
      <Image
        src={src}
        alt=""
        width={64}
        height={64}
        className={`object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${scale} ${className ?? ""}`}
        aria-hidden
      />
    );
  }
  const Icon = ICONS[kind] ?? RouteIcon;
  return <Icon className={className} />;
}
