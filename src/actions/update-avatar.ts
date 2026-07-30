"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { avatarById } from "@/lib/avatars";

export type UpdateAvatarResult =
  | { ok: true; avatarId: string }
  | { ok: false; error: "unauthorized" | "invalid" };

/**
 * Cambia el retrato del entrenador.
 *
 * Hasta ahora el avatar sólo se podía elegir al registrarse: `avatarId` se
 * escribía una vez en `register` y no había forma de tocarlo después.
 *
 * El id se valida contra `AVATAR_OPTIONS` y no se guarda lo que llegue: el
 * campo alimenta una URL del CDN de Showdown, así que aceptar un valor
 * arbitrario dejaría al jugador apuntar el retrato a cualquier recurso.
 */
export async function updateAvatar(
  avatarId: string,
  locale: string,
): Promise<UpdateAvatarResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  if (!avatarById(avatarId)) return { ok: false, error: "invalid" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarId },
  });

  // El avatar vive en el header (server component), así que revalidar sólo
  // `/profile` dejaría el de arriba desactualizado hasta la próxima navegación.
  revalidatePath(`/${locale}`, "layout");

  return { ok: true, avatarId };
}
