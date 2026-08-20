import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  icon?: string;
  tag?: string;
};

function configurePush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@localhost";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!configurePush()) return { sent: 0 };
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  const expired: string[] = [];
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) expired.push(subscription.endpoint);
    }
  }));
  if (expired.length > 0) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
  return { sent };
}
