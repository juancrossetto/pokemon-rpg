"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import { TEAM_SIZE } from "@/lib/market-rules";
import { blockIfInCombat } from "@/lib/battle-lock";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MOVE_LIMIT = 30;

// Errores esperables de negocio — viajan como ?error= en el redirect.
class PcError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function backToPc(locale: string, result: { error?: string; notice?: string }) {
  revalidatePath(`/${locale}/pc`);
  revalidatePath(`/${locale}/team`);
  const param = result.error ? `?error=${result.error}` : `?notice=${result.notice}`;
  redirect({ href: `/pc${param}`, locale });
}

// PC → equipo: ocupa el primer slot libre.
export async function withdrawPokemon(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) return;

  if (!allowAction(`pc:move:${userId}`, MOVE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    backToPc(locale, { error: "rate_limited" });
    return;
  }

  const pokemonId = String(formData.get("pokemonId") ?? "");

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      // Serializa los movimientos de equipo del jugador: sin el lock, dos
      // retiros simultáneos calculan el mismo slot libre.
      await lockUsers(tx, userId);

      const instance = await tx.pokemonInstance.findFirst({
        where: { id: pokemonId, ownerId: userId },
        include: { listings: { where: { status: "ACTIVE" }, select: { id: true } } },
      });
      if (!instance) throw new PcError("not_found");
      if (instance.teamSlot !== null) throw new PcError("already_in_team");
      // Un Pokémon publicado está en escrow: no se puede usar hasta que la
      // venta se concrete o se cancele.
      if (instance.listings.length > 0) throw new PcError("listed");

      const team = await tx.pokemonInstance.findMany({
        where: { ownerId: userId, teamSlot: { not: null } },
        select: { teamSlot: true },
      });
      const taken = new Set(team.map((p) => p.teamSlot));
      let openSlot: number | null = null;
      for (let slot = 1; slot <= TEAM_SIZE; slot++) {
        if (!taken.has(slot)) {
          openSlot = slot;
          break;
        }
      }
      if (openSlot === null) throw new PcError("team_full");

      await tx.pokemonInstance.update({
        where: { id: instance.id },
        data: { teamSlot: openSlot },
      });
    });
  } catch (e) {
    if (e instanceof PcError) error = e.code;
    else throw e;
  }

  backToPc(locale, error ? { error } : { notice: "withdrawn" });
}

// Equipo → PC: libera el slot. Nunca puede quedar el equipo vacío.
export async function depositPokemon(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) return;

  if (!allowAction(`pc:move:${userId}`, MOVE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    backToPc(locale, { error: "rate_limited" });
    return;
  }

  const pokemonId = String(formData.get("pokemonId") ?? "");

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      // Con el lock, el chequeo de "último del equipo" es atómico: sin él,
      // depositar los dos últimos a la vez dejaba el equipo vacío.
      await lockUsers(tx, userId);

      const instance = await tx.pokemonInstance.findFirst({
        where: { id: pokemonId, ownerId: userId },
        include: { battleSessions: { where: { status: "ACTIVE" }, select: { id: true } } },
      });
      if (!instance) throw new PcError("not_found");
      if (instance.teamSlot === null) throw new PcError("not_in_team");
      if (instance.battleSessions.length > 0) throw new PcError("in_battle");

      const others = await tx.pokemonInstance.count({
        where: { ownerId: userId, teamSlot: { not: null }, id: { not: instance.id } },
      });
      if (others === 0) throw new PcError("last_team_member");

      await tx.pokemonInstance.update({
        where: { id: instance.id },
        data: { teamSlot: null },
      });
    });
  } catch (e) {
    if (e instanceof PcError) error = e.code;
    else throw e;
  }

  backToPc(locale, error ? { error } : { notice: "deposited" });
}
