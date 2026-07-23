import typeChart from "@/data/type-chart.json";

type TypeChart = Record<string, Record<string, number>>;

const chart = typeChart as TypeChart;

// Un Pokémon defensor puede tener 1 o 2 tipos — el multiplicador final
// es el producto de la efectividad contra cada uno.
export function getTypeEffectiveness(
  attackingType: string,
  defendingTypes: string[],
): number {
  return defendingTypes.reduce(
    (multiplier, defendingType) =>
      multiplier * (chart[attackingType]?.[defendingType] ?? 1),
    1,
  );
}
