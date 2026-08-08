import type { RewardBundle } from "./rewards";

/**
 * Ciclo de regalos diarios.
 *
 * **Política de días perdidos: acumulativa.** Cada día de juego en el que el
 * jugador reclama avanza una posición del ciclo; faltar no reinicia nada ni
 * hace perder recompensas. Es lo que corresponde a un idle —donde la sesión
 * puede ser de dos minutos— y evita el patrón de castigar con 28 días de
 * progreso por un día sin entrar. La consecuencia es que el ciclo no está
 * atado al calendario: el "día 12" es el duodécimo reclamo, no el 12 del mes.
 *
 * **Balance.** Un jugador activo hace ~58 combates diarios (30 de energía,
 * +1 cada 30 min) a ~50 monedas cada uno: unas 2.900 monedas por día. El
 * promedio del ciclo queda alrededor del 10% de ese ingreso, así que el
 * regalo motiva volver sin competir con jugar. El ciclo completo entrega
 * ~9.500 monedas más objetos a lo largo de 28 días: menos de cuatro días de
 * juego activo, repartidos en un mes.
 *
 * Los precios de referencia salen de la tienda real: Poké Ball 200,
 * Great Ball 600, Ultra Ball 1.200, Poción 300, Súper Poción 700,
 * Full Restore 3.000, Caramelo Raro 4.800, piedras 2.100.
 */

export type DailyRewardVariant = "normal" | "special" | "final";

export type DailyRewardSlot = {
  /** Posición en el ciclo, 1-based. */
  day: number;
  rewards: RewardBundle;
  variant: DailyRewardVariant;
};

export type DailyCycle = {
  id: string;
  length: number;
  slots: DailyRewardSlot[];
};

const coins = (amount: number): RewardBundle => [{ kind: "coins", amount }];
const energy = (amount: number): RewardBundle => [{ kind: "energy", amount }];
const item = (itemName: string, quantity: number): RewardBundle => [
  { kind: "item", itemName, quantity },
];

/**
 * Las cuatro semanas suben de valor, alternando monedas, energía y consumibles
 * para que ningún día se sienta igual al anterior. El día 7 de cada semana es
 * un objeto destacado y el 28 cierra el ciclo.
 *
 * El `id` versiona la configuración: al cambiar las recompensas conviene subir
 * el número, porque los reclamos guardados apuntan a `cycleId` y así el
 * progreso viejo no se mezcla con el nuevo calendario.
 */
export const DAILY_CYCLE: DailyCycle = {
  id: "cycle-28-v1",
  length: 28,
  slots: [
    // ── Semana 1: arranque suave, cubre lo básico de captura y curación ──
    { day: 1, rewards: coins(150), variant: "normal" },
    { day: 2, rewards: item("Poke Ball", 3), variant: "normal" },
    { day: 3, rewards: energy(5), variant: "normal" },
    { day: 4, rewards: item("Potion", 2), variant: "normal" },
    { day: 5, rewards: coins(250), variant: "normal" },
    { day: 6, rewards: item("Poke Ball", 3), variant: "normal" },
    { day: 7, rewards: item("Ultra Ball", 1), variant: "special" },

    // ── Semana 2 ──
    { day: 8, rewards: coins(200), variant: "normal" },
    { day: 9, rewards: item("Great Ball", 3), variant: "normal" },
    { day: 10, rewards: energy(8), variant: "normal" },
    { day: 11, rewards: item("Super Potion", 2), variant: "normal" },
    { day: 12, rewards: coins(350), variant: "normal" },
    { day: 13, rewards: item("Great Ball", 4), variant: "normal" },
    // Piedra de evolución: el flujo de usarlas todavía no existe, pero ya se
    // compran y venden, así que tiene valor real en el mercado.
    { day: 14, rewards: item("Fire Stone", 1), variant: "special" },

    // ── Semana 3 ──
    { day: 15, rewards: coins(300), variant: "normal" },
    { day: 16, rewards: item("Great Ball", 4), variant: "normal" },
    { day: 17, rewards: energy(10), variant: "normal" },
    { day: 18, rewards: item("Full Restore", 1), variant: "normal" },
    { day: 19, rewards: coins(500), variant: "normal" },
    { day: 20, rewards: item("Ultra Ball", 2), variant: "normal" },
    { day: 21, rewards: item("Rare Candy", 1), variant: "special" },

    // ── Semana 4: cierre ──
    { day: 22, rewards: coins(400), variant: "normal" },
    { day: 23, rewards: item("Ultra Ball", 3), variant: "normal" },
    { day: 24, rewards: energy(12), variant: "normal" },
    { day: 25, rewards: item("Full Restore", 2), variant: "normal" },
    { day: 26, rewards: coins(700), variant: "normal" },
    { day: 27, rewards: item("Ultra Ball", 4), variant: "normal" },
    {
      day: 28,
      rewards: [
        { kind: "item", itemName: "Rare Candy", quantity: 1 },
        { kind: "coins", amount: 1500 },
        // Cierre del ciclo: la entrega grande de gemas del mes.
        { kind: "gems", amount: 5 },
      ],
      variant: "final",
    },
  ],
};

export function slotForDay(cycle: DailyCycle, day: number): DailyRewardSlot | null {
  return cycle.slots.find((slot) => slot.day === day) ?? null;
}

/**
 * Posición que le toca reclamar a continuación.
 *
 * Al completar el ciclo vuelve al día 1: el calendario se reinicia y se puede
 * recorrer de nuevo, que es lo esperable en un juego sin final.
 */
export function nextDay(cycle: DailyCycle, claimedCount: number): number {
  return (claimedCount % cycle.length) + 1;
}
