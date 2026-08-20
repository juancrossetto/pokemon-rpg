import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Fila compartida por el shell y el home.
 *
 * Antes AppShell, SiteHeader y Dashboard hacían tres `User.findUnique` casi
 * simultáneos. El select es el superset pequeño que consumen esos tres lugares
 * y React lo memoiza sólo durante el request actual.
 */
export const getUserSnapshot = cache(async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatarId: true,
      homeBannerId: true,
      homeFrameId: true,
      country: true,
      coins: true,
      gems: true,
      energy: true,
      energyMax: true,
      energyUpdatedAt: true,
      lastHealAt: true,
      pvpWins: true,
      pvpLosses: true,
      pvpRating: true,
      clanMembership: {
        select: {
          clan: { select: { id: true, tag: true, name: true, emblem: true } },
        },
      },
    },
  }),
);
