import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowAction } from "@/lib/rate-limit";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(16).max(512), auth: z.string().min(8).max(256) }),
});
const removeSchema = z.object({ endpoint: z.string().url().max(2048) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!allowAction(`push:save:${session.user.id}`, 10, 60_000)) return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: { userId: session.user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
    update: { userId: session.user.id, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
