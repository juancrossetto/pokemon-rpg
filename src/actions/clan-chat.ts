"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowAction } from "@/lib/rate-limit";

const MESSAGE_MAX = 300;
const HISTORY_LIMIT = 50;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;

export type ClanChatMessage = {
  id: string;
  body: string;
  userId: string;
  userName: string;
  createdAt: string;
};

/** Solo miembros del clan pueden leer o escribir en su chat. */
async function requireMembership(userId: string, clanId: string): Promise<boolean> {
  const member = await prisma.clanMember.findFirst({
    where: { userId, clanId },
    select: { userId: true },
  });
  return member !== null;
}

export async function listClanMessages(clanId: string): Promise<ClanChatMessage[]> {
  const session = await auth();
  if (!session?.user) return [];
  if (!(await requireMembership(session.user.id, clanId))) return [];

  const rows = await prisma.clanMessage.findMany({
    where: { clanId },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });

  return rows.reverse().map((m) => ({
    id: m.id,
    body: m.body,
    userId: m.user.id,
    userName: m.user.username,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function sendClanMessage(
  locale: string,
  clanId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: "unauthorized" | "empty" | "too_long" | "rate_limited" }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (!(await requireMembership(userId, clanId))) return { ok: false, error: "unauthorized" };

  const text = body.trim();
  if (!text) return { ok: false, error: "empty" };
  if (text.length > MESSAGE_MAX) return { ok: false, error: "too_long" };

  if (!allowAction(`clan:chat:${userId}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return { ok: false, error: "rate_limited" };
  }

  await prisma.clanMessage.create({ data: { clanId, userId, body: text } });
  revalidatePath(`/${locale}/clans/${clanId}`);
  return { ok: true };
}
