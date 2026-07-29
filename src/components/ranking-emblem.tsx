import Image from "next/image";
import { spriteFor } from "@/lib/shiny";

export type RankingEmblemPokemon = {
  name: string;
  spriteUrl: string;
  isShiny?: boolean;
} | null;

export type RankingInsigniaTier = "gold" | "silver" | "bronze" | "common";

const SIZES = {
  sm: { box: 40, art: 24, label: false },
  md: { box: 72, art: 44, label: true },
  lg: { box: 96, art: 58, label: true },
} as const;

export type RankingEmblemSize = keyof typeof SIZES;

const FRAME_SRC: Record<RankingInsigniaTier, string> = {
  gold: "/ranking/insignia-gold.png",
  silver: "/ranking/insignia-silver.png",
  bronze: "/ranking/insignia-bronze.png",
  common: "/ranking/insignia-common.png",
};

const GLOW_FILTER: Record<RankingInsigniaTier, string> = {
  gold: "drop-shadow(0 0 10px rgba(245,197,66,0.45))",
  silver: "drop-shadow(0 0 6px rgba(200,210,230,0.28))",
  bronze: "drop-shadow(0 0 6px rgba(196,138,74,0.3))",
  common: "drop-shadow(0 0 4px rgba(140,160,190,0.18))",
};

/** Hexágono flat-top alineado al hueco interior de las insignias. */
const HEX_CLIP =
  "polygon(25% 8%, 75% 8%, 96% 50%, 75% 92%, 25% 92%, 4% 50%)";

/**
 * Emblema de ranking: insignia gold/silver/bronze/common +
 * Pokémon principal centrado en el hexágono.
 */
export function RankingEmblem({
  pokemon,
  size = "md",
  tier = "common",
  showLabel,
  className = "",
}: {
  pokemon: RankingEmblemPokemon;
  size?: RankingEmblemSize;
  tier?: RankingInsigniaTier;
  showLabel?: boolean;
  className?: string;
}) {
  const cfg = SIZES[size];
  const label = showLabel ?? cfg.label;
  const src = pokemon ? spriteFor(pokemon.spriteUrl, !!pokemon.isShiny) : null;
  const speciesName = pokemon?.name ?? "—";

  return (
    <div className={`flex flex-col items-center ${className}`} style={{ width: cfg.box }}>
      <div
        className="relative"
        style={{
          width: cfg.box,
          height: cfg.box,
          filter: GLOW_FILTER[tier],
        }}
      >
        <Image
          src={FRAME_SRC[tier]}
          alt=""
          width={cfg.box}
          height={cfg.box}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          sizes={`${cfg.box}px`}
          priority={size === "lg"}
          unoptimized
          aria-hidden
        />

        <div
          className="absolute inset-[18%] z-10 flex items-center justify-center overflow-hidden"
          style={{ clipPath: HEX_CLIP }}
        >
          {src ? (
            <Image
              src={src}
              alt={speciesName}
              width={cfg.art}
              height={cfg.art}
              className="object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
              unoptimized
            />
          ) : (
            <span
              className="font-mono font-bold text-white/50"
              style={{ fontSize: Math.max(11, cfg.art * 0.38) }}
            >
              ?
            </span>
          )}
        </div>
      </div>

      {label && (
        <div
          className="-mt-1 max-w-full truncate rounded-sm border border-black/10 bg-white px-2.5 py-1 text-center shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
          style={{ minWidth: cfg.box * 0.65 }}
          title={speciesName}
        >
          <span className="block truncate text-[9px] font-bold uppercase tracking-[0.08em] text-slate-900 sm:text-[10px]">
            {speciesName}
          </span>
        </div>
      )}
    </div>
  );
}

export function tierForRank(rank: number): RankingInsigniaTier {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "common";
}
