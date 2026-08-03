import type { RewardBundle } from "./rewards";

/**
 * Desafío semanal.
 *
 * A diferencia del regalo diario —que solo pide entrar—, la recompensa semanal
 * se gana jugando. El progreso de los objetivos se **deriva de datos que el
 * juego ya guarda**, no de contadores nuevos:
 *
 * | Objetivo   | Fuente                                    |
 * |------------|-------------------------------------------|
 * | `logins`   | `DailyRewardClaim.claimedAt`              |
 * | `battles`  | `BattleLog` con `userWon`                 |
 * | `catches`  | `PokemonInstance.caughtAt`                |
 * | `zones`    | `ZoneObjectiveClaim.claimedAt`            |
 * | `shinies`  | `PokemonInstance` shiny + `caughtAt`      |
 * | `gyms`     | `GymAttempt` ganados                      |
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

export type WeeklyObjectiveId =
  | "logins"
  | "battles"
  | "catches"
  | "zones"
  | "shinies"
  | "gyms";

export type WeeklyObjective = {
  id: WeeklyObjectiveId;
  target: number;
  /** Ruta a la que lleva el CTA, o `null` si no hay una pantalla concreta. */
  href: string | null;
};

export type WeeklyMilestone = {
  /** Porcentaje del progreso total que lo desbloquea. */
  percent: number;
  rewards: RewardBundle;
};

export type WeeklyChallenge = {
  id: string;
  objectives: WeeklyObjective[];
  milestones: WeeklyMilestone[];
};

/**
 * Calibrado para una semana de juego moderado: hay que tocar varios sistemas,
 * pero ninguno pide farmear hasta el límite de energía.
 */
export const WEEKLY_CHALLENGE: WeeklyChallenge = {
  id: "weekly-v2",
  objectives: [
    { id: "logins", target: 5, href: null },
    { id: "battles", target: 30, href: "/battle" },
    { id: "catches", target: 15, href: "/battle" },
    { id: "zones", target: 4, href: "/campaign" },
    { id: "shinies", target: 1, href: "/battle" },
    { id: "gyms", target: 2, href: "/gyms" },
  ],
  milestones: [
    { percent: 20, rewards: [{ kind: "item", itemName: "Poke Ball", quantity: 8 }] },
    {
      percent: 40,
      rewards: [
        { kind: "coins", amount: 500 },
        { kind: "item", itemName: "Potion", quantity: 5 },
      ],
    },
    {
      percent: 60,
      rewards: [
        { kind: "coins", amount: 800 },
        { kind: "item", itemName: "Great Ball", quantity: 5 },
      ],
    },
    { percent: 80, rewards: [{ kind: "energy", amount: 20 }] },
    {
      percent: 100,
      rewards: [
        { kind: "item", itemName: "Rare Candy", quantity: 1 },
        { kind: "coins", amount: 1200 },
        { kind: "gems", amount: 3 },
      ],
    },
  ],
};

/**
 * Porcentaje completado de la semana.
 *
 * Cada objetivo aporta lo mismo y se recorta a su meta, así que llenar uno de
 * más no compensa tener otro en cero: hay que tocar varios sistemas al menos
 * un poco, que es justamente lo que el desafío quiere premiar.
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
