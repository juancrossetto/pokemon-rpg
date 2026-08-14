export function reportActionTiming(name: string, startedAt: number, details?: Record<string, unknown>) {
  const elapsedMs = Math.round(performance.now() - startedAt);
  const payload = { action: name, elapsedMs, ...details };
  if (elapsedMs >= 1_500) console.warn("[slow-action]", payload);
  else if (process.env.NODE_ENV !== "production") console.info("[action]", payload);
  return elapsedMs;
}
