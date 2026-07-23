"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function fleeBattle(sessionId: string) {
  const session = await auth();
  if (!session?.user) return;

  await prisma.battleSession.updateMany({
    where: { id: sessionId, userId: session.user.id, status: "ACTIVE" },
    data: { status: "FLED" },
  });
}
