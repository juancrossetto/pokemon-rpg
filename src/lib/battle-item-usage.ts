/** Resumen de un objeto consumido durante la batalla actual. */
export interface BattleItemUsage {
  itemName: string;
  targetInstanceId: string;
  targetName: string;
  targetSpriteUrl: string;
  kind: "heal" | "revive";
  quantity: number;
  totalAmount: number;
  automatic: boolean;
}

export type BattleItemUse = Omit<BattleItemUsage, "quantity" | "totalAmount"> & {
  amount: number;
};

/** Agrupa usos iguales sin mezclar decisiones manuales y automaticas. */
export function appendBattleItemUsage(
  current: readonly BattleItemUsage[],
  next: BattleItemUse,
): BattleItemUsage[] {
  const index = current.findIndex(
    (entry) =>
      entry.itemName === next.itemName &&
      entry.targetInstanceId === next.targetInstanceId &&
      entry.kind === next.kind &&
      entry.automatic === next.automatic,
  );

  if (index < 0) {
    return [
      ...current,
      {
        ...next,
        quantity: 1,
        totalAmount: Math.max(0, next.amount),
      },
    ];
  }

  return current.map((entry, entryIndex) =>
    entryIndex === index
      ? {
          ...entry,
          quantity: entry.quantity + 1,
          totalAmount: entry.totalAmount + Math.max(0, next.amount),
        }
      : entry,
  );
}
