"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CAMPAIGN_DEFAULTS } from "@/lib/campaign";
import { isAvatarUnlocked } from "@/lib/avatar-unlocks";
import { avatarById } from "@/lib/avatars";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  username: z.string().trim().min(3).max(20),
  password: z.string().min(8),
  country: z.string().trim().length(2),
  locale: z.enum(["es", "en", "pt"]),
  gender: z.enum(["male", "female", "unspecified"]).nullish(),
  age: z.number().int().min(5).max(120).nullish(),
  avatarId: z.string().trim().min(1).nullish(),
});

export type RegisterResult =
  | { success: true }
  | { success: false; error: "invalid_input" | "email_taken" | "username_taken" };

export async function registerUser(
  input: z.infer<typeof registerSchema>,
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "invalid_input" };
  }

  const { email, username, password, country, locale, gender, age, avatarId } = parsed.data;

  let resolvedAvatarId: string | null = null;
  if (avatarId) {
    const option = avatarById(avatarId);
    if (!option || !isAvatarUnlocked(option.slug, [])) {
      return { success: false, error: "invalid_input" };
    }
    resolvedAvatarId = option.id;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        country: country.toUpperCase(),
        locale,
        gender: gender ?? null,
        age: age ?? null,
        avatarId: resolvedAvatarId,
        campaignProgress: {
          create: { ...CAMPAIGN_DEFAULTS },
        },
      },
    });
    return { success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = err.meta?.target;
      const field = Array.isArray(target) ? target[0] : target;
      return {
        success: false,
        error: field === "username" ? "username_taken" : "email_taken",
      };
    }
    throw err;
  }
}
