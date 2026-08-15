import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { wildCombatantStats } from "@/lib/combatant";
import {
  FACTORY_LEVEL,
  type FactoryRental,
  type FactoryRunView,
  parseBattleHistory,
  parseRentals,
} from "@/lib/factory";

// Finales y evoluciones intermedias con roles bien distintos. El filtro de DB
// hace que un seed parcial no rompa el modo: sólo entran especies disponibles.
const FACTORY_SPECIES_IDS = [
  3, 6, 9, 18, 24, 26, 31, 34, 36, 38, 40, 45, 49, 55, 57, 59, 62, 65, 68,
  71, 73, 76, 78, 80, 82, 85, 89, 91, 94, 97, 99, 101, 103, 105, 110, 112,
  115, 121, 123, 127, 128, 130, 131, 134, 135, 136, 139, 141, 142, 143, 149,
];

export async function getFactoryCatalog(): Promise<FactoryRental[]> {
  const rows = await prisma.species.findMany({
    where: { id: { in: FACTORY_SPECIES_IDS } },
    orderBy: { id: "asc" },
    include: {
      learnableMoves: {
        where: { method: "LEVEL_UP", learnLevel: { lte: FACTORY_LEVEL } },
        include: { move: true },
        orderBy: [{ learnLevel: "desc" }, { moveId: "desc" }],
      },
    },
  });

  return rows
    .map((species): FactoryRental | null => {
      // La simulación headless todavía no elige movimientos de estado con
      // intención; alquilar sólo ataques evita turnos muertos artificiales.
      const damaging = species.learnableMoves.filter(
        ({ move }) => move.category !== "STATUS" && move.power != null,
      );
      const chosen = (damaging.length > 0 ? damaging : species.learnableMoves).slice(0, 4);
      if (chosen.length === 0) return null;
      const stats = wildCombatantStats(species, FACTORY_LEVEL);
      return {
        speciesId: species.id,
        name: species.name,
        spriteUrl: species.spriteUrl,
        types: species.types,
        level: FACTORY_LEVEL,
        maxHp: calculateMaxHp(species.baseHp, FACTORY_LEVEL),
        stats,
        moves: chosen.map(({ move }) => ({
          id: move.id,
          name: move.name,
          type: move.type,
          category: move.category,
          power: move.power,
          accuracy: move.accuracy,
          priority: move.priority,
        })),
      };
    })
    .filter((rental): rental is FactoryRental => rental !== null);
}

export function toFactoryRunView(run: {
  id: string;
  dayKey: string;
  status: FactoryRunView["status"];
  round: number;
  draftPool: unknown;
  team: unknown;
  lastOpponent: unknown;
  battleHistory: unknown;
  totalTurns: number;
  pointsAwarded: number;
  rewardClaimedAt: Date | null;
}): FactoryRunView {
  return {
    id: run.id,
    dayKey: run.dayKey,
    status: run.status,
    round: run.round,
    draftPool: parseRentals(run.draftPool),
    team: parseRentals(run.team),
    lastOpponent: parseRentals(run.lastOpponent),
    battleHistory: parseBattleHistory(run.battleHistory),
    totalTurns: run.totalTurns,
    pointsAwarded: run.pointsAwarded,
    rewardClaimed: run.rewardClaimedAt !== null,
  };
}
