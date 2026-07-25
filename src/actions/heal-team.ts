"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { getCombatLock } from "@/lib/battle-lock";
import { lockUsers } from "@/lib/db-locks";
import { healCooldownMsLeft, healRushCost } from "@/lib/healing";

/**
 * Cura el equipo. `rush = true` paga monedas para saltear el cooldown.
 * Devuelve un código de error en vez de tirar: la UI lo muestra en el botón.
 */
export async function healTeam(
  locale: string,
  rush = false,
): Promise<{ ok: true } | { ok: false; error: "cooldown" | "no_coins" | "unauthorized" }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  // No se puede curar el equipo en combate ni durante un desafío de gym.
  const lock = await getCombatLock(session.user.id);
  if (lock?.kind === "battle") {
    redirect({ href: "/battle", locale });
    return { ok: true };
  }
  if (lock?.kind === "gym") {
    redirect({ href: `/gyms/${lock.gymId}/run`, locale });
    return { ok: true };
  }

  let failure: "cooldown" | "no_coins" | null = null;

  await prisma.$transaction(
    async (tx) => {
      // Sin lock, dos clicks simultáneos pasan los dos el chequeo de cooldown
      // (o el de monedas) y se curan gratis dos veces.
      await lockUsers(tx, session.user.id);

      const user = await tx.user.findUniqueOrThrow({
        where: { id: session.user.id },
        select: { coins: true, lastHealAt: true },
      });

      const team = await tx.pokemonInstance.findMany({
        where: { ownerId: session.user.id, teamSlot: { not: null } },
        include: {
          species: true,
          moves: { include: { move: { select: { pp: true } } } },
        },
      });

      const hurt = team.filter(
        (i) =>
          i.currentHp <
          calculateMaxHp(i.species.baseHp, i.level, i.ptConstitution),
      ).length;

      const msLeft = healCooldownMsLeft(user.lastHealAt);
      if (msLeft > 0) {
        if (!rush) {
          failure = "cooldown";
          return;
        }
        const cost = healRushCost(hurt);
        if (user.coins < cost) {
          failure = "no_coins";
          return;
        }
        await tx.user.update({
          where: { id: session.user.id },
          data: { coins: { decrement: cost } },
        });
      }

      // Como un Centro Pokémon: restaura HP y PP. En paralelo para no
      // quemar el timeout de 5s con N×(1+moves) updates secuenciales.
      await Promise.all(
        team.map((instance) =>
          tx.pokemonInstance.update({
            where: { id: instance.id },
            data: {
              currentHp: calculateMaxHp(
                instance.species.baseHp,
                instance.level,
                instance.ptConstitution,
              ),
            },
          }),
        ),
      );

      await Promise.all(
        team.flatMap((instance) =>
          instance.moves.map((m) =>
            tx.pokemonMove.update({
              where: {
                pokemonInstanceId_slot: {
                  pokemonInstanceId: instance.id,
                  slot: m.slot,
                },
              },
              data: { currentPp: m.move.pp },
            }),
          ),
        ),
      );

      // El cooldown arranca recién ahora: pagar no lo saltea para la próxima.
      await tx.user.update({
        where: { id: session.user.id },
        data: { lastHealAt: new Date() },
      });
    },
    { timeout: 15_000 },
  );

  if (failure) return { ok: false, error: failure };

  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/battle`);
  revalidatePath(`/${locale}`);
  return { ok: true };
}
