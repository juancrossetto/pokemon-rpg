import type { RewardBundle, RewardDef } from "@/lib/events/rewards";
import { getTowerFloor } from "./floors";

/**
 * Botín del ascenso (preview / reconstrucción).
 *
 * El ascenso activo acumula lo ganado en `TowerRun.pendingLoot` y se acredita
 * al reclamar. Estas helpers siguen sirviendo para previsualizar el pago del
 * próximo piso y reconstruir un total cuando el pendiente está vacío
 * (p. ej. intentos viejos).
 */

/**
 * Junta varios bundles en uno: monedas y gemas se suman, los objetos se
 * agrupan por nombre. Sin esto, un ascenso de 12 pisos mostraría "Poción ×1"
 * doce veces en lugar de "Poción ×12".
 */
export function mergeBundles(bundles: RewardBundle[]): RewardBundle {
  let coins = 0;
  let energy = 0;
  let gems = 0;
  const items = new Map<string, number>();

  for (const bundle of bundles) {
    for (const reward of bundle) {
      if (reward.kind === "coins") coins += reward.amount;
      else if (reward.kind === "energy") energy += reward.amount;
      else if (reward.kind === "gems") gems += reward.amount;
      else items.set(reward.itemName, (items.get(reward.itemName) ?? 0) + reward.quantity);
    }
  }

  const out: RewardBundle = [];
  if (coins > 0) out.push({ kind: "coins", amount: coins });
  if (gems > 0) out.push({ kind: "gems", amount: gems });
  if (energy > 0) out.push({ kind: "energy", amount: energy });
  // Orden estable por nombre: sin esto el mismo estado podría renderizar los
  // objetos en distinto orden entre servidor y cliente.
  for (const name of [...items.keys()].sort()) {
    out.push({ kind: "item", itemName: name, quantity: items.get(name)! });
  }
  return out;
}

/**
 * Lo cobrado en los pisos ya superados de este ascenso.
 *
 * Se cuentan sólo las recompensas repetibles: las de primera vez dependen de
 * `claimedFirstClears`, que es acumulativo entre intentos, así que no se puede
 * saber si una se cobró en ESTE ascenso o en uno anterior. Incluirlas inflaría
 * el número con premios de otra partida.
 */
export function climbLoot(currentFloor: number, towerId?: string): RewardBundle {
  const bundles: RewardBundle[] = [];
  for (let n = 1; n < currentFloor; n++) {
    const floor = getTowerFloor(n, towerId);
    if (!floor) continue;
    for (const reward of floor.rewards) bundles.push(reward.bundle);
  }
  return mergeBundles(bundles);
}

export type NextPayout = {
  bundle: RewardBundle;
  /** El piso todavía tiene su bonus de primera vez sin cobrar. */
  hasFirstClear: boolean;
};

/**
 * Lo que paga el piso actual si se supera.
 *
 * Es la mitad que faltaba de la tensión: la pantalla ya decía cuánto HP queda
 * y cuántos intentos, pero no qué se gana por seguir. El multiplicador de
 * monedas se aplica acá porque es exacto —son las bendiciones que el jugador
 * tiene AHORA—, a diferencia del acumulado, donde el multiplicador fue
 * cambiando a lo largo del ascenso.
 */
export function nextFloorPayout(
  floorNumber: number,
  coinMultiplier: number,
  claimedFirstClears: string[],
  towerId?: string,
): NextPayout {
  const floor = getTowerFloor(floorNumber, towerId);
  if (!floor) return { bundle: [], hasFirstClear: false };

  const repeatable = floor.rewards.map((r) => r.bundle);
  const pendingFirstClears = floor.firstClearRewards.filter(
    (fc) => !claimedFirstClears.includes(fc.id),
  );

  const merged = mergeBundles([
    ...repeatable,
    ...pendingFirstClears.map((fc) => fc.bundle),
  ]);

  const scaled: RewardBundle = merged.map((reward): RewardDef =>
    reward.kind === "coins"
      ? { kind: "coins", amount: Math.round(reward.amount * coinMultiplier) }
      : reward,
  );

  return { bundle: scaled, hasFirstClear: pendingFirstClears.length > 0 };
}
