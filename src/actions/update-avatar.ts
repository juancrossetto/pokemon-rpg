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
 * El id se valida contra el catálogo local (`/avatars/{slug}1|2.png`) y se
 * normaliza al id canónico (slug). No se acepta un path arbitrario.
 */
export async function updateAvatar(
  avatarId: string,
  locale: string,
): Promise<UpdateAvatarResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const option = avatarById(avatarId);
  if (!option) return { ok: false, error: "invalid" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarId: option.id },
  });

  // El avatar vive en el header (server component), así que revalidar sólo
  // `/profile` dejaría el de arriba desactualizado hasta la próxima navegación.
  revalidatePath(`/${locale}`, "layout");

  return { ok: true, avatarId: option.id };
}
