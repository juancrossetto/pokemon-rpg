"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateCombatUi } from "@/lib/battle-lock";

// Salida voluntaria de una corrida en curso — resetea el progreso contra los
// entrenadores subordinados. Solo válida entre batallas (Huir ya está
// deshabilitado dentro de un combate de gimnasio).
export async function abandonGymRun(gymRunId: string, locale: string) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  const run = await prisma.gymRun.findFirst({ where: { id: gymRunId, userId, status: "ACTIVE" } });
  if (!run) {
    revalidateCombatUi(locale);
    redirect({ href: "/gyms", locale });
    return;
  }

  const activeBattle = await prisma.battleSession.findFirst({
    where: { gymRunId, status: "ACTIVE" },
  });
  if (activeBattle) return; // no se puede abandonar a mitad de un combate

  await prisma.gymRun.update({ where: { id: gymRunId }, data: { status: "ABANDONED" } });

  revalidateCombatUi(locale);
  revalidatePath(`/${locale}/gyms`);
  revalidatePath(`/${locale}/gyms/${run.gymId}`);
  revalidatePath(`/${locale}/gyms/${run.gymId}/run`);

  redirect({ href: `/gyms/${run.gymId}`, locale });
}
