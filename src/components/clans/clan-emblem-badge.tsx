import { CdnImage as Image } from "@/components/cdn-image";
import type {
  ClanEmblem,
  ClanEmblemProcedural,
  ClanEmblemShape,
  ClanEmblemSymbol,
} from "@/lib/clan-emblem";
import {
  clanEmblemPresetSrc,
  isPresetEmblem,
  parseClanEmblem,
} from "@/lib/clan-emblem";

const SHAPE_PATHS: Record<ClanEmblemShape, string> = {
  shield: "M32 4 L56 12 V34 C56 48 44 58 32 62 C20 58 8 48 8 34 V12 Z",
  hexagon: "M32 4 L54 16 V40 L32 52 L10 40 V16 Z",
  circle: "M32 6 A26 26 0 1 1 31.9 6 Z",
  diamond: "M32 4 L58 32 L32 60 L6 32 Z",
  banner: "M10 6 H54 V42 L32 54 L10 42 Z",
  medallion: "M32 6 A26 26 0 1 1 31.9 6 Z",
};

function SymbolGlyph({
  symbol,
  color,
}: {
  symbol: ClanEmblemSymbol;
  color: string;
}) {
  const common = { fill: color, stroke: "none" } as const;
  switch (symbol) {
    case "bolt":
      return <path {...common} d="M34 14 L22 34 H31 L28 50 L46 28 H36 Z" />;
    case "flame":
      return (
        <path
          {...common}
          d="M32 14 C28 24 20 28 20 38 C20 46 25 52 32 52 C39 52 44 46 44 38 C44 30 38 26 36 20 C35 24 33 26 32 14 Z"
        />
      );
    case "wave":
      return (
        <path
          {...common}
          d="M14 36 C18 28 24 28 28 34 C32 40 38 40 42 34 C46 28 50 30 52 36 L52 44 C48 38 42 38 38 42 C34 46 28 46 24 42 C20 38 16 40 14 44 Z"
        />
      );
    case "leaf":
      return <path {...common} d="M32 12 C44 20 48 34 32 52 C16 34 20 20 32 12 Z M32 24 V44" />;
    case "mountain":
      return <path {...common} d="M12 46 L26 22 L34 34 L42 18 L52 46 Z" />;
    case "wing":
      return (
        <path
          {...common}
          d="M18 40 C22 28 30 22 40 18 C36 26 36 34 40 42 C32 40 24 42 18 40 Z M44 40 C48 34 50 28 52 22 C46 28 42 34 40 42 Z"
        />
      );
    case "claw":
      return (
        <path
          {...common}
          d="M20 18 L24 46 L28 24 Z M30 16 L32 48 L36 22 Z M40 18 L42 46 L48 24 Z"
        />
      );
    case "star":
      return (
        <path
          {...common}
          d="M32 12 L36 26 H50 L38 34 L42 48 L32 40 L22 48 L26 34 L14 26 H28 Z"
        />
      );
    case "crown":
      return <path {...common} d="M14 40 L18 22 L28 32 L32 16 L36 32 L46 22 L50 40 Z" />;
    case "moon":
      return <path {...common} d="M40 16 A18 18 0 1 0 40 48 A14 14 0 1 1 40 16 Z" />;
    case "sun":
      return (
        <g {...common}>
          <circle cx="32" cy="32" r="10" />
          <path
            d="M32 12 V18 M32 46 V52 M12 32 H18 M46 32 H52 M18 18 L22 22 M42 42 L46 46 M46 18 L42 22 M18 46 L22 42"
            stroke={color}
            strokeWidth="3"
            fill="none"
          />
        </g>
      );
    case "ball":
      return (
        <g>
          <circle cx="32" cy="32" r="14" fill={color} />
          <path d="M18 32 H46" stroke="rgba(0,0,0,0.45)" strokeWidth="3" />
          <circle cx="32" cy="32" r="4.5" fill="rgba(0,0,0,0.45)" />
          <circle cx="32" cy="32" r="2.5" fill="#f5f5f5" />
        </g>
      );
    default:
      return null;
  }
}

function ProceduralEmblem({
  data,
  size,
  title,
  className,
}: {
  data: ClanEmblemProcedural;
  size: number;
  title?: string;
  className: string;
}) {
  const path = SHAPE_PATHS[data.shape];
  const strokeW = data.border === "double" ? 3.5 : data.border === "ornate" ? 4 : 2.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={title ?? "Clan emblem"}
    >
      <defs>
        {data.background === "rays" && (
          <radialGradient id={`rays-${data.primaryColor}`} cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor={data.primaryColor} stopOpacity="0.95" />
            <stop offset="100%" stopColor={data.secondaryColor} stopOpacity="1" />
          </radialGradient>
        )}
      </defs>
      <path
        d={path}
        fill={
          data.background === "rays"
            ? `url(#rays-${data.primaryColor})`
            : data.secondaryColor
        }
        stroke={data.primaryColor}
        strokeWidth={strokeW}
      />
      <SymbolGlyph symbol={data.symbol} color={data.primaryColor} />
    </svg>
  );
}

export function ClanEmblemBadge({
  emblem,
  size = 48,
  className = "",
  title,
  fill = false,
}: {
  emblem: unknown;
  size?: number;
  className?: string;
  title?: string;
  /** Si true, ocupa el contenedor (ignora size en CSS; size sigue para el attr img). */
  fill?: boolean;
}) {
  const data: ClanEmblem = parseClanEmblem(emblem);
  const boxStyle = fill ? undefined : { width: size, height: size };
  const boxClass = fill
    ? `relative inline-flex h-full w-full shrink-0 items-center justify-center bg-transparent ${className}`
    : `relative inline-flex shrink-0 items-center justify-center bg-transparent ${className}`;

  if (isPresetEmblem(data)) {
    return (
      <span
        className={boxClass}
        style={boxStyle}
        role="img"
        aria-label={title ?? "Clan emblem"}
      >
        {/*
          Los presets son PNG de 512×512 y acá se muestran desde 16px. Con
          <img> crudo el navegador bajaba y decodificaba los 512² completos
          para pintar 16² — medido en el home, 1266× los píxeles necesarios.
          `next/image` sirve la resolución que corresponde al `size`.
        */}
        <Image
          src={clanEmblemPresetSrc(data.presetId)}
          alt={title ?? "Clan emblem"}
          width={size}
          height={size}
          className="h-full w-full bg-transparent object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          draggable={false}
        />
      </span>
    );
  }

  return (
    <ProceduralEmblem
      data={data}
      size={size}
      title={title}
      className={`${fill ? "h-full w-full" : ""} ${className}`.trim()}
    />
  );
}
