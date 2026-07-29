import {
  RankingEmblem,
  tierForRank,
  type RankingEmblemPokemon,
} from "@/components/ranking-emblem";

/** Presentación compacta del emblema (glow reducido fuera del podio). */
export function RankingBadge({
  pokemon,
  rank,
  size,
  highlight,
}: {
  pokemon: RankingEmblemPokemon;
  rank: number;
  size: "sm" | "md" | "lg";
  highlight?: boolean;
}) {
  const tier = tierForRank(rank);
  const muted = size === "sm" && !highlight;

  return (
    <div className={muted ? "ranking-badge ranking-badge--muted" : "ranking-badge"}>
      <RankingEmblem
        pokemon={pokemon}
        size={size}
        tier={tier}
        showLabel={size !== "sm"}
      />
    </div>
  );
}

export function toEmblemPokemon(
  creature: { name: string; image: string; isShiny?: boolean } | null | undefined,
): RankingEmblemPokemon {
  if (!creature) return null;
  return {
    name: creature.name,
    spriteUrl: creature.image,
    isShiny: creature.isShiny,
  };
}
