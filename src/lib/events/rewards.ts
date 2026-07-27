/**
 * Definición genérica de recompensa.
 *
 * Es el único vocabulario con el que el catálogo describe lo que entrega:
 * el regalo diario, los hitos semanales y las misiones de evento se declaran
 * todos con estas tres formas, y un solo resolvedor las aplica dentro de la
 * transacción. Agregar una fuente de recompensas nueva no necesita tocar la
 * lógica de entrega.
 *
 * `item` referencia al ítem por **nombre**, que es la clave única de `Item` y
 * la que ya usan los objetivos de zona y los sprites. Si el ítem no está en el
 * catálogo sembrado, la entrega no rompe: se registra y se omite (ver
 * `grantRewards`).
 */
export type RewardDef =
  | { kind: "coins"; amount: number }
  | { kind: "energy"; amount: number }
  | { kind: "gems"; amount: number }
  | { kind: "item"; itemName: string; quantity: number };

export type RewardBundle = RewardDef[];

/** Clave i18n del nombre de una recompensa, para lectores de pantalla y listas. */
export function rewardLabelKey(reward: RewardDef): string {
  return reward.kind === "item" ? "rewards.item" : `rewards.${reward.kind}`;
}

/**
 * Peso aproximado en monedas, solo para ordenar y destacar visualmente.
 * No se usa para entregar: la entrega aplica la definición tal cual.
 */
export function rewardWeight(reward: RewardDef): number {
  if (reward.kind === "coins") return reward.amount;
  // 1 punto de energía tarda 30 min en regenerar; ~un combate, ~50 monedas.
  if (reward.kind === "energy") return reward.amount * 50;
  // Una gema equivale a ~1/8 de un Cordón Unión, el objeto premium de
  // referencia. Solo se usa para ordenar visualmente, no para cobrar.
  if (reward.kind === "gems") return reward.amount * 1200;
  return reward.quantity * 400;
}

export function bundleWeight(bundle: RewardBundle): number {
  return bundle.reduce((total, reward) => total + rewardWeight(reward), 0);
}
