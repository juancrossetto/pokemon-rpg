"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers, lockClan } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import {
  CLAN_CREATION_COST,
  CLAN_MAX_MEMBERS,
  isValidClanName,
  isValidClanTag,
  normalizeClanName,
  normalizeClanTag,
} from "@/lib/clan-rules";
import { Prisma } from "@/generated/prisma/client";

// Clanes del dossier (fase 6): pertenencia, roles y ranking. Toda operación que
// lee-y-escribe pertenencia toma el lock del jugador (y del clan cuando importa
// el cupo), por la misma razón que el mercado: en READ COMMITTED las
// validaciones no son atómicas. El chat interno queda diferido (encaja con
// Supabase Realtime más adelante).

const RATE_LIMIT_WINDOW_MS = 60_000;
const CLAN_ACTION_LIMIT = 15;

class ClanError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function requireUser(locale: string): Promise<string | null> {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  return session.user.id;
}

function toClans(locale: string, result: { error?: string; notice?: string }, clanId?: string) {
  revalidatePath(`/${locale}/clans`);
  if (clanId) revalidatePath(`/${locale}/clans/${clanId}`);
  const param = result.error ? `?error=${result.error}` : result.notice ? `?notice=${result.notice}` : "";
  redirect({ href: clanId ? `/clans/${clanId}${param}` : `/clans${param}`, locale });
}

export async function createClan(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  if (!allowAction(`clan:action:${userId}`, CLAN_ACTION_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    toClans(locale, { error: "rate_limited" });
    return;
  }

  const name = normalizeClanName(String(formData.get("name") ?? ""));
  const tag = normalizeClanTag(String(formData.get("tag") ?? ""));
  if (!isValidClanName(name)) {
    toClans(locale, { error: "invalid_name" });
    return;
  }
  if (!isValidClanTag(tag)) {
    toClans(locale, { error: "invalid_tag" });
    return;
  }

  let error: string | undefined;
  let newClanId: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const existing = await tx.clanMember.findUnique({ where: { userId } });
      if (existing) throw new ClanError("already_in_clan");

      // Choque de nombre/tag con mensaje preciso. El P2002 de abajo no alcanza:
      // con el adapter pg, meta.target viene vacío y no distingue cuál chocó.
      // Este pre-chequeo resuelve el caso normal; el P2002 queda de backstop
      // para la carrera exacta (dos creaciones idénticas simultáneas).
      const clash = await tx.clan.findFirst({
        where: { OR: [{ name }, { tag }] },
        select: { name: true, tag: true },
      });
      if (clash) throw new ClanError(clash.name === name ? "name_taken" : "tag_taken");

      // Cobra el costo de creación con guarda de saldo (nunca deja negativo).
      const paid = await tx.user.updateMany({
        where: { id: userId, coins: { gte: CLAN_CREATION_COST } },
        data: { coins: { decrement: CLAN_CREATION_COST } },
      });
      if (paid.count === 0) throw new ClanError("insufficient_coins");

      const clan = await tx.clan.create({ data: { name, tag, leaderId: userId } });
      await tx.clanMember.create({ data: { userId, clanId: clan.id, role: "LEADER" } });
      newClanId = clan.id;
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Backstop de carrera. meta.target viene vacío con el adapter pg, así que
      // se infiere del mensaje del constraint (…_tag_key); default a name.
      const hint = `${(e.meta?.target ?? "").toString()} ${e.message}`.toLowerCase();
      error = hint.includes("tag") ? "tag_taken" : "name_taken";
    } else throw e;
  }

  if (error) toClans(locale, { error });
  else toClans(locale, { notice: "created" }, newClanId);
}

export async function joinClan(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  if (!allowAction(`clan:action:${userId}`, CLAN_ACTION_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    toClans(locale, { error: "rate_limited" });
    return;
  }

  const clanId = String(formData.get("clanId") ?? "");

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const alreadyIn = await tx.clanMember.findUnique({ where: { userId } });
      if (alreadyIn) throw new ClanError("already_in_clan");

      const clan = await tx.clan.findUnique({ where: { id: clanId }, select: { id: true } });
      if (!clan) throw new ClanError("not_found");

      // Lock del clan: serializa el chequeo de cupo con otros que se unen.
      await lockClan(tx, clanId);
      const members = await tx.clanMember.count({ where: { clanId } });
      if (members >= CLAN_MAX_MEMBERS) throw new ClanError("clan_full");

      await tx.clanMember.create({ data: { userId, clanId, role: "MEMBER" } });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      error = "already_in_clan"; // carrera: se unió en paralelo
    } else throw e;
  }

  if (error) toClans(locale, { error });
  else toClans(locale, { notice: "joined" }, clanId);
}

export async function leaveClan(locale: string) {
  const userId = await requireUser(locale);
  if (!userId) return;

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const membership = await tx.clanMember.findUnique({ where: { userId } });
      if (!membership) throw new ClanError("not_in_clan");
      // El líder no puede irse sin más: primero transfiere el mando o disuelve.
      if (membership.role === "LEADER") throw new ClanError("leader_must_transfer");

      await tx.clanMember.delete({ where: { userId } });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  toClans(locale, error ? { error } : { notice: "left" });
}

export async function disbandClan(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const clanId = String(formData.get("clanId") ?? "");

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const clan = await tx.clan.findUnique({ where: { id: clanId }, select: { leaderId: true } });
      if (!clan) throw new ClanError("not_found");
      if (clan.leaderId !== userId) throw new ClanError("forbidden");

      // onDelete: Cascade en ClanMember borra a todos los miembros con el clan.
      await tx.clan.delete({ where: { id: clanId } });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  if (error) toClans(locale, { error }, clanId);
  else toClans(locale, { notice: "disbanded" });
}

/** Expulsa a un miembro. Líder puede a cualquiera; oficial solo a MEMBER. */
export async function kickMember(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const targetUserId = String(formData.get("targetUserId") ?? "");
  const clanId = String(formData.get("clanId") ?? "");

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);

      const [actor, target] = await Promise.all([
        tx.clanMember.findUnique({ where: { userId } }),
        tx.clanMember.findUnique({ where: { userId: targetUserId } }),
      ]);
      if (!actor || actor.clanId !== clanId) throw new ClanError("forbidden");
      if (!target || target.clanId !== clanId) throw new ClanError("target_not_member");
      if (targetUserId === userId) throw new ClanError("forbidden"); // usar "salir"

      const actorCanKick =
        actor.role === "LEADER" || (actor.role === "OFFICER" && target.role === "MEMBER");
      if (!actorCanKick) throw new ClanError("forbidden");

      await tx.clanMember.delete({ where: { userId: targetUserId } });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  toClans(locale, error ? { error } : { notice: "kicked" }, clanId);
}

/** Promueve (MEMBER→OFFICER) o degrada (OFFICER→MEMBER). Solo el líder. */
export async function setMemberRole(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const targetUserId = String(formData.get("targetUserId") ?? "");
  const clanId = String(formData.get("clanId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (role !== "OFFICER" && role !== "MEMBER") {
    toClans(locale, { error: "forbidden" }, clanId);
    return;
  }

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);

      const clan = await tx.clan.findUnique({ where: { id: clanId }, select: { leaderId: true } });
      if (!clan || clan.leaderId !== userId) throw new ClanError("forbidden");

      const target = await tx.clanMember.findUnique({ where: { userId: targetUserId } });
      if (!target || target.clanId !== clanId) throw new ClanError("target_not_member");
      if (target.role === "LEADER") throw new ClanError("forbidden");

      await tx.clanMember.update({ where: { userId: targetUserId }, data: { role } });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  toClans(locale, error ? { error } : { notice: role === "OFFICER" ? "promoted" : "demoted" }, clanId);
}

/** Traspasa el liderazgo: el líder actual pasa a OFICIAL, el destino a LÍDER. */
export async function transferLeadership(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const targetUserId = String(formData.get("targetUserId") ?? "");
  const clanId = String(formData.get("clanId") ?? "");

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);

      const clan = await tx.clan.findUnique({ where: { id: clanId }, select: { leaderId: true } });
      if (!clan || clan.leaderId !== userId) throw new ClanError("forbidden");

      const target = await tx.clanMember.findUnique({ where: { userId: targetUserId } });
      if (!target || target.clanId !== clanId) throw new ClanError("target_not_member");

      await tx.clan.update({ where: { id: clanId }, data: { leaderId: targetUserId } });
      await tx.clanMember.update({ where: { userId: targetUserId }, data: { role: "LEADER" } });
      await tx.clanMember.update({ where: { userId }, data: { role: "OFFICER" } });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  toClans(locale, error ? { error } : { notice: "transferred" }, clanId);
}
