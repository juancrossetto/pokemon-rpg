import type { RewardBundle } from "./rewards";

/**
 * Desafío semanal.
 *
 * A diferencia del regalo diario —que solo pide entrar—, la recompensa semanal
 * se gana jugando. El progreso de los cuatro objetivos se **deriva de datos que
 * el juego ya guarda**, no de contadores nuevos:
 *
 * | Objetivo   | Fuente                                    |
 * |------------|-------------------------------------------|
 * | `logins`   | `DailyRewardClaim.claimedAt`              |
 * | `battles`  | `BattleLog` con `userWon`                 |
 * | `catches`  | `PokemonInstance.caughtAt`                |
 * | `zones`    | `ZoneObjectiveClaim.claimedAt`            |
 *
 * Esa decisión evita agregar contadores que habría que incrementar desde cinco
 * actions distintas y que se desincronizan en cuanto una falla a mitad de
 * camino. El costo es que los objetivos solo pueden medir lo que ya se
 * persiste; por eso **no hay un objetivo de "gastá energía"**: el gasto de
 * energía no se guarda en ningún lado, y un objetivo que no se puede medir con
 * honestidad es peor que no tenerlo.
 *
 * Ninguno exige PvP ni gastar dinero: un jugador nuevo puede completar la
 * semana entera jugando la campaña.
 */

export type WeeklyObjectiveId = "logins" | "battles" | "catches" | "zones";

export type WeeklyObjective = {
  id: WeeklyObjectiveId;
  target: number;
  /** Ruta a la que lleva el CTA, o `null` si no hay una pantalla concreta. */
  href: string | null;
};

export type WeeklyMilestone = {
  /** Porcentaje del progreso total que lo desbloquea. */
  percent: 25 | 50 | 75 | 100;
  rewards: RewardBundle;
};

export type WeeklyChallenge = {
  id: string;
  objectives: WeeklyObjective[];
  milestones: WeeklyMilestone[];
};

/**
 * Los objetivos están calibrados para una semana de juego moderado, no
 * intensivo: 25 combates son unos 4 por día, muy por debajo de los ~48
 * diarios que permite la energía. La idea es que entrar seguido alcance.
 */
export const WEEKLY_CHALLENGE: WeeklyChallenge = {
  id: "weekly-v1",
  objectives: [
    { id: "logins", target: 5, href: null },
    { id: "battles", target: 25, href: "/battle" },
    { id: "catches", target: 10, href: "/battle" },
    { id: "zones", target: 3, href: "/campaign" },
  ],
  milestones: [
    { percent: 25, rewards: [{ kind: "item", itemName: "Poke Ball", quantity: 5 }] },
    {
      percent: 50,
      rewards: [
        { kind: "coins", amount: 600 },
        { kind: "item", itemName: "Super Potion", quantity: 2 },
      ],
    },
    { percent: 75, rewards: [{ kind: "energy", amount: 15 }] },
    {
      percent: 100,
      rewards: [
        { kind: "item", itemName: "Rare Candy", quantity: 1 },
        { kind: "coins", amount: 1000 },
        // Goteo semanal de gemas: es la vía principal para juntarlas.
        { kind: "gems", amount: 2 },
      ],
    },
  ],
};

/**
 * Porcentaje completado de la semana.
 *
 * Cada objetivo aporta lo mismo y se recorta a su meta, así que llenar uno de
 * más no compensa tener otro en cero: hay que tocar los cuatro sistemas al
 * menos un poco, que es justamente lo que el desafío quiere premiar.
 */
export function weeklyPercent(
  challenge: WeeklyChallenge,
  progress: Record<WeeklyObjectiveId, number>,
): number {
  const total = challenge.objectives.reduce((sum, objective) => {
    const value = Math.min(progress[objective.id] ?? 0, objective.target);
    return sum + value / objective.target;
  }, 0);
  return Math.floor((total / challenge.objectives.length) * 100);
}

export function milestoneUnlocked(percent: number, milestone: WeeklyMilestone): boolean {
  return percent >= milestone.percent;
}
