"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  deleteAllNotifications,
  deleteNotifications,
  markNotificationsRead,
  syncEnergyFullNotification,
} from "@/lib/notifications";

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

export async function deleteNotificationAction(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const };
  await deleteNotifications(session.user.id, [id]);
  return { ok: true as const };
}

export async function deleteAllNotificationsAction() {
  const session = await auth();
  if (!session?.user) return { ok: false as const };
  await deleteAllNotifications(session.user.id);
  return { ok: true as const };
}

/** Disparado por el cliente cuando la barra llega a tope en vivo. */
export async function reportEnergyFullAction() {
  const session = await auth();
  if (!session?.user) return { ok: false as const };
  await syncEnergyFullNotification(session.user.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
