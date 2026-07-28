"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers, lockClan } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import {
  CLAN_ANNOUNCE_MAX,
  CLAN_APP_OUT_MAX,
  CLAN_CREATION_COST,
  CLAN_DESC_MAX,
  CLAN_INVITE_OUT_MAX,
  CLAN_LEAVE_COOLDOWN_MS,
  CLAN_MAX_MEMBERS,
  CLAN_MOTTO_MAX,
  canonicalizeClanName,
  clampClanText,
  isValidClanAffinity,
  isValidClanFocus,
  isValidClanJoinPolicy,
  isValidClanName,
  isValidClanTag,
  normalizeClanName,
  normalizeClanTag,
  resolveEmblem,
} from "@/lib/clan-rules";
import {
  notifyClanAccepted,
  notifyClanApplication,
  notifyClanInvite,
  notifyClanKicked,
  notifyClanRoleChanged,
} from "@/lib/notifications";
import { Prisma } from "@/generated/prisma/client";

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

function toClans(
  locale: string,
  result: { error?: string; notice?: string },
  clanId?: string,
  extraQuery?: string,
) {
  revalidatePath(`/${locale}/clans`);
  if (clanId) revalidatePath(`/${locale}/clans/${clanId}`);
  const parts: string[] = [];
  if (result.error) parts.push(`error=${result.error}`);
  if (result.notice) parts.push(`notice=${result.notice}`);
  if (extraQuery) parts.push(extraQuery.replace(/^\?/, ""));
  const param = parts.length ? `?${parts.join("&")}` : "";
  redirect({ href: clanId ? `/clans/${clanId}${param}` : `/clans${param}`, locale });
}

function assertCooldown(lastClanLeftAt: Date | null | undefined) {
  if (!lastClanLeftAt) return;
  const elapsed = Date.now() - lastClanLeftAt.getTime();
  if (elapsed < CLAN_LEAVE_COOLDOWN_MS) throw new ClanError("cooldown");
}

function parseEmblemFromForm(formData: FormData) {
  const raw = String(formData.get("emblem") ?? "");
  if (!raw) return resolveEmblem(null);
  try {
    return resolveEmblem(JSON.parse(raw));
  } catch {
    return resolveEmblem(null);
  }
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
  const description = clampClanText(String(formData.get("description") ?? ""), CLAN_DESC_MAX);
  const motto = clampClanText(String(formData.get("motto") ?? ""), CLAN_MOTTO_MAX);
  const joinPolicyRaw = String(formData.get("joinPolicy") ?? "OPEN");
  const focusRaw = String(formData.get("focus") ?? "MIXED");
  const affinityRaw = String(formData.get("affinity") ?? "NORMAL");
  const languageRaw = String(formData.get("language") ?? "").trim().toLowerCase();
  const minLevelRaw = String(formData.get("minPlayerLevel") ?? "").trim();
  const emblem = parseEmblemFromForm(formData);

  if (!isValidClanName(name)) {
    toClans(locale, { error: "invalid_name" });
    return;
  }
  if (!isValidClanTag(tag)) {
    toClans(locale, { error: "invalid_tag" });
    return;
  }
  if (
    !isValidClanJoinPolicy(joinPolicyRaw) ||
    !isValidClanFocus(focusRaw) ||
    !isValidClanAffinity(affinityRaw)
  ) {
    toClans(locale, { error: "invalid_fields" });
    return;
  }

  let minPlayerLevel: number | null = null;
  if (minLevelRaw) {
    const n = Number(minLevelRaw);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      toClans(locale, { error: "invalid_fields" });
      return;
    }
    minPlayerLevel = n;
  }

  const language =
    languageRaw === "es" || languageRaw === "en" || languageRaw === "pt" ? languageRaw : null;
  const normalizedName = canonicalizeClanName(name);
  const normalizedTag = tag;

  let error: string | undefined;
  let newClanId: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const me = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { lastClanLeftAt: true },
      });
      assertCooldown(me.lastClanLeftAt);

      const existing = await tx.clanMember.findUnique({ where: { userId } });
      if (existing) throw new ClanError("already_in_clan");

      const pendingApp = await tx.clanApplication.findFirst({
        where: { userId, status: "PENDING" },
        select: { id: true },
      });
      if (pendingApp) throw new ClanError("pending_elsewhere");

      const clash = await tx.clan.findFirst({
        where: {
          OR: [
            { name },
            { tag },
            { normalizedName },
            { normalizedTag },
          ],
        },
        select: { name: true, tag: true, normalizedName: true, normalizedTag: true },
      });
      if (clash) {
        if (clash.normalizedName === normalizedName || clash.name === name) {
          throw new ClanError("name_taken");
        }
        throw new ClanError("tag_taken");
      }

      const paid = await tx.user.updateMany({
        where: { id: userId, coins: { gte: CLAN_CREATION_COST } },
        data: { coins: { decrement: CLAN_CREATION_COST } },
      });
      if (paid.count === 0) throw new ClanError("insufficient_coins");

      const clan = await tx.clan.create({
        data: {
          name,
          normalizedName,
          tag,
          normalizedTag,
          leaderId: userId,
          description: description || null,
          motto: motto || null,
          joinPolicy: joinPolicyRaw,
          focus: focusRaw,
          affinity: affinityRaw,
          language,
          minPlayerLevel,
          emblem,
        },
      });
      await tx.clanMember.create({ data: { userId, clanId: clan.id, role: "LEADER" } });
      await tx.clanApplication.updateMany({
        where: { userId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      await tx.clanInvite.updateMany({
        where: { toUserId: userId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      newClanId = clan.id;
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const hint = `${(e.meta?.target ?? "").toString()} ${e.message}`.toLowerCase();
      error = hint.includes("tag") ? "tag_taken" : "name_taken";
    } else throw e;
  }

  if (error) toClans(locale, { error });
  else toClans(locale, { notice: "created" }, newClanId);
}

async function assertCanJoin(
  tx: Prisma.TransactionClient,
  userId: string,
  clanId: string,
  opts: { requireOpen?: boolean; requireInvite?: boolean } = {},
) {
  const me = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      lastClanLeftAt: true,
      pokemon: {
        where: { teamSlot: { not: null } },
        select: { level: true },
        orderBy: { level: "desc" },
        take: 1,
      },
    },
  });
  assertCooldown(me.lastClanLeftAt);

  const alreadyIn = await tx.clanMember.findUnique({ where: { userId } });
  if (alreadyIn) throw new ClanError("already_in_clan");

  const clan = await tx.clan.findUnique({
    where: { id: clanId },
    select: {
      id: true,
      name: true,
      tag: true,
      joinPolicy: true,
      minPlayerLevel: true,
      leaderId: true,
    },
  });
  if (!clan) throw new ClanError("not_found");

  if (opts.requireOpen && clan.joinPolicy !== "OPEN") {
    throw new ClanError(clan.joinPolicy === "INVITE" ? "invite_only" : "request_required");
  }
  if (opts.requireInvite && clan.joinPolicy === "INVITE") {
    // caller validates invite exists
  }

  if (clan.minPlayerLevel != null) {
    const playerLevel = me.pokemon[0]?.level ?? 1;
    if (playerLevel < clan.minPlayerLevel) throw new ClanError("level_too_low");
  }

  await lockClan(tx, clanId);
  const members = await tx.clanMember.count({ where: { clanId } });
  if (members >= CLAN_MAX_MEMBERS) throw new ClanError("clan_full");

  return clan;
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
      const clan = await assertCanJoin(tx, userId, clanId, { requireOpen: true });
      await tx.clanMember.create({ data: { userId, clanId: clan.id, role: "MEMBER" } });
      await tx.clanApplication.updateMany({
        where: { userId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      await tx.clanInvite.updateMany({
        where: { toUserId: userId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      error = "already_in_clan";
    } else throw e;
  }

  if (error) toClans(locale, { error });
  else toClans(locale, { notice: "joined" }, clanId);
}

export async function applyToClan(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  if (!allowAction(`clan:action:${userId}`, CLAN_ACTION_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    toClans(locale, { error: "rate_limited" });
    return;
  }

  const clanId = String(formData.get("clanId") ?? "");
  const message = clampClanText(String(formData.get("message") ?? ""), 140);

  let error: string | undefined;
  const notifyBox: {
    value: {
      leaderId: string;
      name: string;
      tag: string;
      username: string;
    } | null;
  } = { value: null };
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const me = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          username: true,
          lastClanLeftAt: true,
          pokemon: {
            where: { teamSlot: { not: null } },
            select: { level: true },
            orderBy: { level: "desc" },
            take: 1,
          },
        },
      });
      assertCooldown(me.lastClanLeftAt);

      if (await tx.clanMember.findUnique({ where: { userId } })) {
        throw new ClanError("already_in_clan");
      }

      const outgoing = await tx.clanApplication.count({
        where: { userId, status: "PENDING" },
      });
      if (outgoing >= CLAN_APP_OUT_MAX) throw new ClanError("applications_full");

      const clan = await tx.clan.findUnique({
        where: { id: clanId },
        select: {
          id: true,
          name: true,
          tag: true,
          joinPolicy: true,
          minPlayerLevel: true,
          leaderId: true,
        },
      });
      if (!clan) throw new ClanError("not_found");
      if (clan.joinPolicy !== "REQUEST") {
        throw new ClanError(clan.joinPolicy === "INVITE" ? "invite_only" : "invalid_fields");
      }

      if (clan.minPlayerLevel != null) {
        const playerLevel = me.pokemon[0]?.level ?? 1;
        if (playerLevel < clan.minPlayerLevel) throw new ClanError("level_too_low");
      }

      await lockClan(tx, clanId);
      const members = await tx.clanMember.count({ where: { clanId } });
      if (members >= CLAN_MAX_MEMBERS) throw new ClanError("clan_full");

      const existing = await tx.clanApplication.findUnique({
        where: { clanId_userId: { clanId, userId } },
      });
      if (existing?.status === "PENDING") throw new ClanError("already_applied");

      if (existing) {
        await tx.clanApplication.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            message: message || null,
            respondedAt: null,
            createdAt: new Date(),
          },
        });
      } else {
        await tx.clanApplication.create({
          data: { clanId, userId, message: message || null },
        });
      }

      notifyBox.value = {
        leaderId: clan.leaderId,
        name: clan.name,
        tag: clan.tag,
        username: me.username,
      };
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      error = "already_applied";
    } else throw e;
  }

  if (!error && notifyBox.value) {
    await notifyClanApplication({
      toUserId: notifyBox.value.leaderId,
      clanId,
      clanName: notifyBox.value.name,
      clanTag: notifyBox.value.tag,
      trainerName: notifyBox.value.username,
    });
  }

  if (error) toClans(locale, { error });
  else toClans(locale, { notice: "applied" }, clanId);
}

export async function cancelApplication(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const clanId = String(formData.get("clanId") ?? "");
  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      const app = await tx.clanApplication.findUnique({
        where: { clanId_userId: { clanId, userId } },
      });
      if (!app || app.status !== "PENDING") throw new ClanError("no_application");
      await tx.clanApplication.update({
        where: { id: app.id },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  toClans(locale, error ? { error } : { notice: "application_cancelled" }, clanId || undefined);
}

export async function respondApplication(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const clanId = String(formData.get("clanId") ?? "");
  const applicationId = String(formData.get("applicationId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "accept" && decision !== "decline") {
    toClans(locale, { error: "forbidden" }, clanId, "tab=admin");
    return;
  }

  let error: string | undefined;
  let acceptedUserId: string | undefined;
  let clanMeta: { name: string; tag: string } | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);

      const actor = await tx.clanMember.findUnique({ where: { userId } });
      if (!actor || actor.clanId !== clanId) throw new ClanError("forbidden");
      if (actor.role !== "LEADER" && actor.role !== "OFFICER") throw new ClanError("forbidden");

      const app = await tx.clanApplication.findUnique({ where: { id: applicationId } });
      if (!app || app.clanId !== clanId || app.status !== "PENDING") {
        throw new ClanError("no_application");
      }

      if (decision === "decline") {
        await tx.clanApplication.update({
          where: { id: app.id },
          data: { status: "DECLINED", respondedAt: new Date() },
        });
        return;
      }

      await lockUsers(tx, app.userId);
      if (await tx.clanMember.findUnique({ where: { userId: app.userId } })) {
        await tx.clanApplication.update({
          where: { id: app.id },
          data: { status: "CANCELLED", respondedAt: new Date() },
        });
        throw new ClanError("already_in_clan");
      }

      const members = await tx.clanMember.count({ where: { clanId } });
      if (members >= CLAN_MAX_MEMBERS) throw new ClanError("clan_full");

      const clan = await tx.clan.findUniqueOrThrow({
        where: { id: clanId },
        select: { name: true, tag: true },
      });

      await tx.clanMember.create({
        data: { userId: app.userId, clanId, role: "MEMBER" },
      });
      await tx.clanApplication.update({
        where: { id: app.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await tx.clanApplication.updateMany({
        where: { userId: app.userId, status: "PENDING", id: { not: app.id } },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      await tx.clanInvite.updateMany({
        where: { toUserId: app.userId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });

      acceptedUserId = app.userId;
      clanMeta = clan;
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      error = "already_in_clan";
    } else throw e;
  }

  if (!error && acceptedUserId && clanMeta) {
    await notifyClanAccepted({
      toUserId: acceptedUserId,
      clanId,
      clanName: clanMeta.name,
      clanTag: clanMeta.tag,
    });
  }

  toClans(
    locale,
    error
      ? { error }
      : { notice: decision === "accept" ? "application_accepted" : "application_declined" },
    clanId,
    "tab=admin",
  );
}

export async function inviteToClan(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  if (!allowAction(`clan:action:${userId}`, CLAN_ACTION_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    toClans(locale, { error: "rate_limited" });
    return;
  }

  const clanId = String(formData.get("clanId") ?? "");
  const targetUsername = String(formData.get("username") ?? "").trim();

  let error: string | undefined;
  let invitePayload:
    | { toUserId: string; clanName: string; clanTag: string; fromName: string }
    | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);

      const actor = await tx.clanMember.findUnique({
        where: { userId },
        include: { user: { select: { username: true } } },
      });
      if (!actor || actor.clanId !== clanId) throw new ClanError("forbidden");
      if (actor.role !== "LEADER" && actor.role !== "OFFICER") throw new ClanError("forbidden");

      const clan = await tx.clan.findUniqueOrThrow({
        where: { id: clanId },
        select: { name: true, tag: true },
      });

      const members = await tx.clanMember.count({ where: { clanId } });
      if (members >= CLAN_MAX_MEMBERS) throw new ClanError("clan_full");

      const outgoing = await tx.clanInvite.count({
        where: { clanId, status: "PENDING" },
      });
      if (outgoing >= CLAN_INVITE_OUT_MAX) throw new ClanError("invites_full");

      const target = await tx.user.findUnique({
        where: { username: targetUsername },
        select: { id: true },
      });
      if (!target) throw new ClanError("not_found");
      if (await tx.clanMember.findUnique({ where: { userId: target.id } })) {
        throw new ClanError("already_in_clan");
      }

      const existing = await tx.clanInvite.findUnique({
        where: { clanId_toUserId: { clanId, toUserId: target.id } },
      });
      if (existing?.status === "PENDING") throw new ClanError("already_applied");

      if (existing) {
        await tx.clanInvite.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            fromUserId: userId,
            respondedAt: null,
            createdAt: new Date(),
          },
        });
      } else {
        await tx.clanInvite.create({
          data: { clanId, fromUserId: userId, toUserId: target.id },
        });
      }

      invitePayload = {
        toUserId: target.id,
        clanName: clan.name,
        clanTag: clan.tag,
        fromName: actor.user.username,
      };
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  if (!error && invitePayload) {
    await notifyClanInvite({
      toUserId: invitePayload.toUserId,
      clanName: invitePayload.clanName,
      clanTag: invitePayload.clanTag,
      clanId,
      fromUserName: invitePayload.fromName,
    });
  }

  toClans(locale, error ? { error } : { notice: "invite_sent" }, clanId, "tab=admin");
}

export async function respondInvite(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const inviteId = String(formData.get("inviteId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "accept" && decision !== "decline") {
    toClans(locale, { error: "forbidden" });
    return;
  }

  let error: string | undefined;
  let joinedClanId: string | undefined;
  let clanMeta: { name: string; tag: string } | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const invite = await tx.clanInvite.findUnique({ where: { id: inviteId } });
      if (!invite || invite.toUserId !== userId || invite.status !== "PENDING") {
        throw new ClanError("not_found");
      }

      if (decision === "decline") {
        await tx.clanInvite.update({
          where: { id: invite.id },
          data: { status: "DECLINED", respondedAt: new Date() },
        });
        return;
      }

      const clan = await assertCanJoin(tx, userId, invite.clanId);
      await tx.clanMember.create({
        data: { userId, clanId: clan.id, role: "MEMBER" },
      });
      await tx.clanInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await tx.clanInvite.updateMany({
        where: { toUserId: userId, status: "PENDING", id: { not: invite.id } },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      await tx.clanApplication.updateMany({
        where: { userId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });

      joinedClanId = clan.id;
      clanMeta = { name: clan.name, tag: clan.tag };
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      error = "already_in_clan";
    } else throw e;
  }

  if (!error && joinedClanId && clanMeta) {
    await notifyClanAccepted({
      toUserId: userId,
      clanId: joinedClanId,
      clanName: clanMeta.name,
      clanTag: clanMeta.tag,
    });
  }

  if (error) toClans(locale, { error }, joinedClanId);
  else if (decision === "accept" && joinedClanId) {
    toClans(locale, { notice: "invite_accepted" }, joinedClanId);
  } else {
    toClans(locale, { notice: "invite_declined" });
  }
}

export async function updateClanSettings(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const clanId = String(formData.get("clanId") ?? "");
  const description = clampClanText(String(formData.get("description") ?? ""), CLAN_DESC_MAX);
  const motto = clampClanText(String(formData.get("motto") ?? ""), CLAN_MOTTO_MAX);
  const announcement = clampClanText(
    String(formData.get("announcement") ?? ""),
    CLAN_ANNOUNCE_MAX,
  );
  const joinPolicyRaw = String(formData.get("joinPolicy") ?? "OPEN");
  const focusRaw = String(formData.get("focus") ?? "MIXED");
  const affinityRaw = String(formData.get("affinity") ?? "NORMAL");
  const emblem = parseEmblemFromForm(formData);

  if (
    !isValidClanJoinPolicy(joinPolicyRaw) ||
    !isValidClanFocus(focusRaw) ||
    !isValidClanAffinity(affinityRaw)
  ) {
    toClans(locale, { error: "invalid_fields" }, clanId, "tab=admin");
    return;
  }

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);
      const actor = await tx.clanMember.findUnique({ where: { userId } });
      if (!actor || actor.clanId !== clanId || actor.role !== "LEADER") {
        throw new ClanError("forbidden");
      }

      await tx.clan.update({
        where: { id: clanId },
        data: {
          description: description || null,
          motto: motto || null,
          announcement: announcement || null,
          joinPolicy: joinPolicyRaw,
          focus: focusRaw,
          affinity: affinityRaw,
          emblem,
        },
      });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  toClans(locale, error ? { error } : { notice: "settings_saved" }, clanId, "tab=admin");
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
      if (membership.role === "LEADER") throw new ClanError("leader_must_transfer");

      await tx.clanMember.delete({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: { lastClanLeftAt: new Date() },
      });
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

      await tx.clan.delete({ where: { id: clanId } });
      await tx.user.update({
        where: { id: userId },
        data: { lastClanLeftAt: new Date() },
      });
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  if (error) toClans(locale, { error }, clanId);
  else toClans(locale, { notice: "disbanded" });
}

export async function kickMember(locale: string, formData: FormData) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const targetUserId = String(formData.get("targetUserId") ?? "");
  const clanId = String(formData.get("clanId") ?? "");

  let error: string | undefined;
  let kickedMeta: { name: string; tag: string } | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);

      const [actor, target, clan] = await Promise.all([
        tx.clanMember.findUnique({ where: { userId } }),
        tx.clanMember.findUnique({ where: { userId: targetUserId } }),
        tx.clan.findUnique({ where: { id: clanId }, select: { name: true, tag: true } }),
      ]);
      if (!clan) throw new ClanError("not_found");
      if (!actor || actor.clanId !== clanId) throw new ClanError("forbidden");
      if (!target || target.clanId !== clanId) throw new ClanError("target_not_member");
      if (targetUserId === userId) throw new ClanError("forbidden");

      const actorCanKick =
        actor.role === "LEADER" || (actor.role === "OFFICER" && target.role === "MEMBER");
      if (!actorCanKick) throw new ClanError("forbidden");

      await tx.clanMember.delete({ where: { userId: targetUserId } });
      await tx.user.update({
        where: { id: targetUserId },
        data: { lastClanLeftAt: new Date() },
      });
      kickedMeta = clan;
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  if (!error && kickedMeta) {
    await notifyClanKicked({
      toUserId: targetUserId,
      clanName: kickedMeta.name,
      clanTag: kickedMeta.tag,
    });
  }

  toClans(locale, error ? { error } : { notice: "kicked" }, clanId);
}

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
  let clanMeta: { name: string; tag: string } | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockClan(tx, clanId);

      const clan = await tx.clan.findUnique({
        where: { id: clanId },
        select: { leaderId: true, name: true, tag: true },
      });
      if (!clan || clan.leaderId !== userId) throw new ClanError("forbidden");

      const target = await tx.clanMember.findUnique({ where: { userId: targetUserId } });
      if (!target || target.clanId !== clanId) throw new ClanError("target_not_member");
      if (target.role === "LEADER") throw new ClanError("forbidden");

      await tx.clanMember.update({ where: { userId: targetUserId }, data: { role } });
      clanMeta = { name: clan.name, tag: clan.tag };
    });
  } catch (e) {
    if (e instanceof ClanError) error = e.code;
    else throw e;
  }

  if (!error && clanMeta) {
    await notifyClanRoleChanged({
      toUserId: targetUserId,
      clanId,
      clanName: clanMeta.name,
      clanTag: clanMeta.tag,
    });
  }

  toClans(locale, error ? { error } : { notice: role === "OFFICER" ? "promoted" : "demoted" }, clanId);
}

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
