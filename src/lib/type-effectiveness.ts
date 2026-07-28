import typeChart from "@/data/type-chart.json";

type TypeChart = Record<string, Record<string, number>>;

const chart = typeChart as TypeChart;

// Un Pokémon defensor puede tener 1 o 2 tipos — el multiplicador final
// es el producto de la efectividad contra cada uno.
export function getTypeEffectiveness(
  attackingType: string,
  defendingTypes: string[],
): number {
  const atk = attackingType.toLowerCase();
  return defendingTypes.reduce((multiplier, defendingType) => {
    const def = defendingType.toLowerCase();
    return multiplier * (chart[atk]?.[def] ?? 1);
  }, 1);
}

/** Tipos que hacen daño super efectivo contra un tipo defensor. */
export function getWeaknesses(defendingType: string): string[] {
  const key = defendingType.toLowerCase();
  return Object.keys(chart)
    .filter((attacking) => (chart[attacking]?.[key] ?? 1) > 1)
    .sort();
}
