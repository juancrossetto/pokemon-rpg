import { z } from "zod";
import { allowAction } from "@/lib/rate-limit";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

const metricSchema = z.object({
  id: z.string().max(200),
  name: z.enum(["TTFB", "FCP", "LCP", "FID", "CLS", "INP"]),
  value: z.number().finite().nonnegative(),
  delta: z.number().finite(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  navigationType: z.string().max(40),
  pathname: z.string().startsWith("/").max(300),
  viewport: z.string().regex(/^\d+x\d+$/),
});

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || "local";
  if (!allowAction(`web-vitals:${key}`, 60, 60_000)) {
    return new Response(null, { status: 429 });
  }

  try {
    const raw = await request.text();
    const metric = metricSchema.parse(JSON.parse(raw));
    console.info("[web-vital]", metric);
    // Conserva toda señal mala y 10% de las buenas. El hash determinístico por
    // id mantiene el muestreo estable si el navegador reintenta el mismo dato.
    const sampleBucket = [...metric.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 10;
    if (metric.rating !== "good" || sampleBucket === 0) {
      after(async () => {
        try {
          await prisma.webVitalSample.create({
            data: {
              metricId: metric.id,
              name: metric.name,
              value: metric.value,
              delta: metric.delta,
              rating: metric.rating,
              navigationType: metric.navigationType,
              pathname: metric.pathname,
              viewport: metric.viewport,
            },
          });
          // Limpieza oportunista (~1%): evita necesitar un cron sólo para una
          // tabla de diagnóstico y no agrega trabajo a cada métrica.
          if (sampleBucket === 1) {
            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            await prisma.webVitalSample.deleteMany({ where: { createdAt: { lt: cutoff } } });
          }
        } catch (error) {
          console.error("[web-vital] persistence failed", error);
        }
      });
    }
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
