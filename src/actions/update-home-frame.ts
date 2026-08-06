"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { homeFrameById, HOME_FRAME_OPTIONS } from "@/lib/home-frames";

export type UpdateHomeFrameResult =
  | { ok: true; homeFrameId: string }
  | { ok: false; error: "unauthorized" | "invalid" };

/**
 * Equipa un marco del banner de home.
 * El id se valida contra el catálogo local — no se acepta un path arbitrario.
 */
export async function updateHomeFrame(
  frameId: string,
  locale: string,
): Promise<UpdateHomeFrameResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const option = HOME_FRAME_OPTIONS.find((f) => f.id === frameId);
  if (!option) return { ok: false, error: "invalid" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { homeFrameId: option.id },
  });

  // Home + perfil + header layout (identidad).
  revalidatePath(`/${locale}`, "layout");

  return { ok: true, homeFrameId: homeFrameById(option.id).id };
}
