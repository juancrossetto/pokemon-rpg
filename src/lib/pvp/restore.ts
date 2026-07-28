import type { Prisma } from "@/generated/prisma/client";
import { parseTeamSnap, type PvpTeamSnap } from "@/lib/pvp/team";

/** Restaura HP/PP del challenger a lo que tenía antes del combate PvP. */
export async function restoreChallengerTeam(
  tx: Prisma.TransactionClient,
  challengerTeamRaw: unknown,
) {
  const team = parseTeamSnap(challengerTeamRaw);
  for (const mon of team) {
    await tx.pokemonInstance.update({
      where: { id: mon.instanceId },
      data: { currentHp: mon.preBattleHp },
    });
    const moves = await tx.pokemonMove.findMany({
      where: { pokemonInstanceId: mon.instanceId },
      orderBy: { slot: "asc" },
    });
    for (let i = 0; i < moves.length; i++) {
      const pp = mon.preBattlePp[i];
      if (pp == null) continue;
      await tx.pokemonMove.update({
        where: {
          pokemonInstanceId_slot: {
            pokemonInstanceId: mon.instanceId,
            slot: moves[i].slot,
          },
        },
        data: { currentPp: pp },
      });
    }
  }
}

/** Pone el equipo del challenger a HP/PP max para pelear la foto. */
export async function primeChallengerTeamForBattle(
  tx: Prisma.TransactionClient,
  team: PvpTeamSnap,
) {
  for (const mon of team) {
    await tx.pokemonInstance.update({
      where: { id: mon.instanceId },
      data: { currentHp: mon.maxHp },
    });
    const moves = await tx.pokemonMove.findMany({
      where: { pokemonInstanceId: mon.instanceId },
      include: { move: { select: { pp: true } } },
      orderBy: { slot: "asc" },
    });
    for (let i = 0; i < moves.length; i++) {
      const maxPp = mon.moves[i]?.maxPp ?? moves[i].move.pp;
      await tx.pokemonMove.update({
        where: {
          pokemonInstanceId_slot: {
            pokemonInstanceId: mon.instanceId,
            slot: moves[i].slot,
          },
        },
        data: { currentPp: maxPp },
      });
    }
  }
}
