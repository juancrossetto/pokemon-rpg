import { FlagIcon } from "@/components/flag-icon";
import type { RankingEntry } from "@/lib/ranking";

/** Banda compacta de “tu posición” — no es una card grande. */
export function CurrentPlayerRanking({
  entry,
  youLabel,
  title,
  metricsLine,
}: {
  entry: RankingEntry;
  category?: "combat_power" | "pvp";
  youLabel: string;
  title: string;
  metricsLine: string;
  compact?: boolean;
}) {
  return (
    <div className="lb-you-strip">
      <span className="lb-you-strip__label">{title}</span>
      <span className="lb-you-strip__rank">#{entry.position}</span>
      <span className="lb-you-strip__name truncate">{entry.playerName}</span>
      {entry.countryCode ? (
        <FlagIcon
          code={entry.countryCode}
          className="h-2.5 w-auto shrink-0 rounded-[1px] opacity-80"
        />
      ) : null}
      <span className="lb-you-strip__tag">{youLabel}</span>
      <span className="lb-you-strip__metric">{metricsLine}</span>
    </div>
  );
}
