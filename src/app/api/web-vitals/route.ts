import { z } from "zod";
import { allowAction } from "@/lib/rate-limit";

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
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
