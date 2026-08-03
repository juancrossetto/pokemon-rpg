import Image from "next/image";
import {
  divisionRoman,
  tierBadgeSrc,
  type PvpDivision,
  type PvpTier,
} from "@/lib/pvp/tiers";

type Props = {
  tier: PvpTier;
  label: string;
  division?: PvpDivision;
  /** Visual size of the badge art. */
  size?: "sm" | "md" | "lg";
  /** Show the text chip next to / under the badge. */
  showLabel?: boolean;
  className?: string;
};

const SIZES = {
  sm: { px: 40, className: "h-10 w-10", roman: "text-[9px]" },
  md: { px: 64, className: "h-16 w-16", roman: "text-[11px]" },
  lg: { px: 88, className: "h-[5.5rem] w-[5.5rem]", roman: "text-[13px]" },
} as const;

export function PvpRankBadge({
  tier,
  label,
  division,
  size = "md",
  showLabel = false,
  className = "",
}: Props) {
  const dim = SIZES[size];
  const fullLabel =
    division != null ? `${label} ${divisionRoman(division)}` : label;

  return (
    <span className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <span className="relative inline-flex">
        <Image
          src={tierBadgeSrc(tier)}
          alt={fullLabel}
          width={dim.px}
          height={dim.px}
          className={`${dim.className} object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]`}
          unoptimized
        />
        {division != null ? (
          <span
            className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-md border border-white/20 bg-black/75 px-1 py-px font-black leading-none tracking-wide text-white ${dim.roman}`}
          >
            {divisionRoman(division)}
          </span>
        ) : null}
      </span>
      {showLabel ? (
        <span className="max-w-[7rem] truncate text-center text-[9px] font-bold uppercase tracking-wider text-white/70">
          {fullLabel}
        </span>
      ) : null}
    </span>
  );
}
