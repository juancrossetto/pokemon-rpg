"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { homeBannerById, HOME_BANNER_OPTIONS } from "@/lib/home-banners";

export type UpdateHomeBannerResult =
  | { ok: true; homeBannerId: string }
  | { ok: false; error: "unauthorized" | "invalid" };

/**
 * Equipa un banner de home/perfil.
 * El id se valida contra el catálogo local — no se acepta un path arbitrario.
 */
export async function updateHomeBanner(
  bannerId: string,
  locale: string,
): Promise<UpdateHomeBannerResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const option = HOME_BANNER_OPTIONS.find((b) => b.id === bannerId);
  if (!option) return { ok: false, error: "invalid" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { homeBannerId: option.id },
  });

  // Home + perfil + header layout (identidad).
  revalidatePath(`/${locale}`, "layout");

  return { ok: true, homeBannerId: homeBannerById(option.id).id };
}
