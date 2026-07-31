import type { RankingEntry } from "@/lib/ranking";

/** Marca mínima de tu posición: sólo el rótulo y el número, al margen. */
export function CurrentPlayerRanking({
  entry,
  title,
}: {
  entry: RankingEntry;
  category?: "combat_power" | "pvp";
  youLabel?: string;
  title: string;
  metricsLine?: string;
  compact?: boolean;
}) {
  return (
    <p className="lb-you-mark">
      <span className="lb-you-mark__label">{title}</span>
      <span className="lb-you-mark__rank">#{entry.position}</span>
    </p>
  );
}
