import type { Prisma } from "@/generated/prisma/client";
import { parseTeamSnap, type PvpTeamSnap } from "@/lib/pvp/team";

/**
 * Restaura HP/PP del challenger a lo que tenía antes del combate PvP.
 *
 * Un findMany + updates en paralelo: el loop secuencial anterior (6 mons ×
 * findMany + N updates) reventaba el timeout default de 5s contra Supabase.
 */
export async function restoreChallengerTeam(
  tx: Prisma.TransactionClient,
  challengerTeamRaw: unknown,
) {
  const team = parseTeamSnap(challengerTeamRaw);
  if (team.length === 0) return;

  const instanceIds = team.map((m) => m.instanceId);
  const moveRows = await tx.pokemonMove.findMany({
    where: { pokemonInstanceId: { in: instanceIds } },
    select: { pokemonInstanceId: true, slot: true },
    orderBy: [{ pokemonInstanceId: "asc" }, { slot: "asc" }],
  });

  const slotsByInstance = new Map<string, number[]>();
  for (const row of moveRows) {
    const list = slotsByInstance.get(row.pokemonInstanceId) ?? [];
    list.push(row.slot);
    slotsByInstance.set(row.pokemonInstanceId, list);
  }

  await Promise.all([
    ...team.map((mon) =>
      tx.pokemonInstance.update({
        where: { id: mon.instanceId },
        data: { currentHp: mon.preBattleHp },
      }),
    ),
    ...team.flatMap((mon) => {
      const slots = slotsByInstance.get(mon.instanceId) ?? [];
      return slots.flatMap((slot, i) => {
        const pp = mon.preBattlePp[i];
        if (pp == null) return [];
        return [
          tx.pokemonMove.update({
            where: {
              pokemonInstanceId_slot: {
                pokemonInstanceId: mon.instanceId,
                slot,
              },
            },
            data: { currentPp: pp },
          }),
        ];
      });
    }),
  ]);
}

/** Pone el equipo del challenger a HP/PP max para pelear la foto. */
export async function primeChallengerTeamForBattle(
  tx: Prisma.TransactionClient,
  team: PvpTeamSnap,
) {
  if (team.length === 0) return;

  const instanceIds = team.map((m) => m.instanceId);
  const moveRows = await tx.pokemonMove.findMany({
    where: { pokemonInstanceId: { in: instanceIds } },
    include: { move: { select: { pp: true } } },
    orderBy: [{ pokemonInstanceId: "asc" }, { slot: "asc" }],
  });

  const movesByInstance = new Map<string, typeof moveRows>();
  for (const row of moveRows) {
    const list = movesByInstance.get(row.pokemonInstanceId) ?? [];
    list.push(row);
    movesByInstance.set(row.pokemonInstanceId, list);
  }

  await Promise.all([
    ...team.map((mon) =>
      tx.pokemonInstance.update({
        where: { id: mon.instanceId },
        data: { currentHp: mon.maxHp },
      }),
    ),
    ...team.flatMap((mon) => {
      const moves = movesByInstance.get(mon.instanceId) ?? [];
      return moves.map((row, i) => {
        const maxPp = mon.moves[i]?.maxPp ?? row.move.pp;
        return tx.pokemonMove.update({
          where: {
            pokemonInstanceId_slot: {
              pokemonInstanceId: mon.instanceId,
              slot: row.slot,
            },
          },
          data: { currentPp: maxPp },
        });
      });
    }),
  ]);
}
