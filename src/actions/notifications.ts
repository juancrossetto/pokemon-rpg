"use server";

import { auth } from "@/auth";
import { markNotificationsRead } from "@/lib/notifications";

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user) return { ok: false as const };
  await markNotificationsRead(session.user.id);
  return { ok: true as const };
}

export async function markNotificationReadAction(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const };
  await markNotificationsRead(session.user.id, [id]);
  return { ok: true as const };
}
