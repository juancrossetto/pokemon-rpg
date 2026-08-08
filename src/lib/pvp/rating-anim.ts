import {
  PVP_TIERS,
  nextRankProgress,
  rankForRating,
  type PvpRankStanding,
} from "@/lib/pvp/tiers";

/** ¿after es un rango más alto que before? (división o liga). */
export function didPromoteRank(before: number, after: number): boolean {
  if (after <= before) return false;
  const a = rankForRating(before);
  const b = rankForRating(after);
  if (a.tier === b.tier && a.division === b.division) return false;
  return compareStanding(b, a) > 0;
}

/** Positivo si `a` es más alto que `b`. */
export function compareStanding(a: PvpRankStanding, b: PvpRankStanding): number {
  const ai = PVP_TIERS.findIndex((t) => t.id === a.tier);
  const bi = PVP_TIERS.findIndex((t) => t.id === b.tier);
  if (ai !== bi) return ai - bi;
  // División: 1 (I) > 2 (II) > 3 (III)
  return b.division - a.division;
}

const STORAGE_KEY = "pvp-rating-anim";
const TTL_MS = 30 * 60 * 1000;

export type PvpRatingAnimPayload = {
  before: number;
  after: number;
  ts: number;
};

export type PvpRatingSegment = {
  from: number;
  to: number;
  durationMs: number;
  rankUpAfter: boolean;
};

function segmentDurationMs(from: number, to: number, baseMs: number): number {
  const delta = Math.abs(to - from);
  return Math.round(baseMs + delta * 1200);
}

/** Segmentos de barra hacia el próximo rango (como la EXP por nivel). */
export function buildPvpRatingSegments(
  before: number,
  after: number,
): PvpRatingSegment[] {
  const start = nextRankProgress(before);
  const end = nextRankProgress(after);

  if (after === before) {
    return [
      {
        from: start.pct / 100,
        to: end.pct / 100,
        durationMs: 0,
        rankUpAfter: false,
      },
    ];
  }

  if (after < before) {
    const start = nextRankProgress(before);
    const end = nextRankProgress(after);
    if (start.currentFloor === end.currentFloor) {
      return [
        {
          from: start.pct / 100,
          to: end.pct / 100,
          durationMs: segmentDurationMs(start.pct / 100, end.pct / 100, 900),
          rankUpAfter: false,
        },
      ];
    }
    // Bajó de división: vacía la barra actual y aterriza en el % nuevo.
    return [
      {
        from: start.pct / 100,
        to: 0,
        durationMs: segmentDurationMs(start.pct / 100, 0, 700),
        rankUpAfter: false,
      },
      {
        from: 1,
        to: end.pct / 100,
        durationMs: segmentDurationMs(1, end.pct / 100, 800),
        rankUpAfter: false,
      },
    ];
  }

  const segments: PvpRatingSegment[] = [];
  let cursor = before;
  let prog = nextRankProgress(cursor);

  while (prog.nextFloor != null && after >= prog.nextFloor) {
    const from = prog.pct / 100;
    segments.push({
      from,
      to: 1,
      durationMs: segmentDurationMs(from, 1, 850),
      rankUpAfter: true,
    });
    cursor = prog.nextFloor;
    prog = nextRankProgress(cursor);
  }

  const from = segments.length > 0 ? 0 : start.pct / 100;
  const to = end.pct / 100;
  segments.push({
    from,
    to,
    durationMs: segmentDurationMs(from, to, 1000),
    rankUpAfter: false,
  });
  return segments;
}

export function persistPvpRatingAnim(before: number, after: number): void {
  if (typeof window === "undefined" || before === after) return;
  try {
    const payload: PvpRatingAnimPayload = { before, after, ts: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // private mode / quota
  }
}

/** Lee sin borrar — la barra del hub anima al volver a PvP. */
export function peekPvpRatingAnim(): PvpRatingAnimPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PvpRatingAnimPayload;
    if (
      typeof parsed.before !== "number" ||
      typeof parsed.after !== "number" ||
      typeof parsed.ts !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.ts > TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed.before === parsed.after) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Limpiar al terminar la animación de barra (no al montar). */
export function clearPvpRatingAnim(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Suscriptores de ancho de barra del hub (hay 2 barras en la misma pantalla). */
type HubBarListener = (widthPct: number) => void;
const hubBarListeners = new Set<HubBarListener>();
let hubAnimRunningTs: number | null = null;
let hubAnimGen = 0;
let hubAnimLastWidth: number | null = null;

export function subscribeHubBarWidth(listener: HubBarListener): () => void {
  hubBarListeners.add(listener);
  if (hubAnimLastWidth != null) listener(hubAnimLastWidth);
  return () => {
    hubBarListeners.delete(listener);
    // Salir a mitad de camino: invalidar runner y permitir reanimar al volver.
    if (hubBarListeners.size === 0) {
      hubAnimGen += 1;
      hubAnimRunningTs = null;
      hubAnimLastWidth = null;
    }
  };
}

function broadcastHubBarWidth(widthPct: number) {
  hubAnimLastWidth = widthPct;
  for (const listener of hubBarListeners) listener(widthPct);
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Arranca una sola animación para todas las barras del hub.
 * Devuelve true si este montaje se engancha a una anim (propia o en curso).
 */
export function ensureHubRatingBarAnim(opts: {
  settlePct: number;
  rankUpLockMs: number;
  playSfx: (name: "energy" | "heal" | "levelUp") => void;
}): boolean {
  if (typeof window === "undefined") return false;
  const anim = peekPvpRatingAnim();
  if (!anim) return false;
  if (hubAnimRunningTs === anim.ts) return true;

  hubAnimRunningTs = anim.ts;
  const gen = ++hubAnimGen;
  const segments = buildPvpRatingSegments(anim.before, anim.after);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const alive = () => gen === hubAnimGen;

  const wait = (ms: number) =>
    new Promise<void>((r) => {
      window.setTimeout(r, ms);
    });

  const animateValue = (from: number, to: number, durationMs: number) =>
    new Promise<void>((resolve) => {
      if (durationMs <= 0) {
        if (alive()) broadcastHubBarWidth(to * 100);
        resolve();
        return;
      }
      const t0 = performance.now();
      const tick = (now: number) => {
        if (!alive()) {
          resolve();
          return;
        }
        const u = Math.min(1, (now - t0) / durationMs);
        broadcastHubBarWidth((from + (to - from) * easeInOutCubic(u)) * 100);
        if (u < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

  const finish = () => {
    if (!alive()) return;
    broadcastHubBarWidth(opts.settlePct);
    clearPvpRatingAnim();
    hubAnimRunningTs = null;
    hubAnimLastWidth = null;
  };

  void (async () => {
    broadcastHubBarWidth(nextRankProgress(anim.before).pct);

    if (reduced) {
      if (alive()) opts.playSfx("heal");
      finish();
      return;
    }

    if (peekPvpRankUpPending()) {
      await wait(opts.rankUpLockMs + 200);
      if (!alive()) return;
    }

    opts.playSfx("energy");
    await wait(200);
    if (!alive()) return;
    opts.playSfx("heal");

    for (const seg of segments) {
      if (!alive()) return;
      broadcastHubBarWidth(seg.from * 100);
      await animateValue(seg.from, seg.to, seg.durationMs);
      if (seg.rankUpAfter) {
        opts.playSfx("levelUp");
        broadcastHubBarWidth(0);
        await wait(280);
      }
    }

    if (!alive()) return;
    finish();
  })();

  return true;
}

const RANK_UP_KEY = "pvp-rank-up-pending";
const RANK_UP_TTL_MS = 30 * 60 * 1000;

export type PvpRankUpPayload = {
  before: number;
  after: number;
  ts: number;
};

/** Guarda un ascenso para mostrarlo al volver a PvP o al home (no en el outcome). */
export function persistPvpRankUp(before: number, after: number): void {
  if (typeof window === "undefined") return;
  if (!didPromoteRank(before, after)) return;
  try {
    const payload: PvpRankUpPayload = { before, after, ts: Date.now() };
    window.sessionStorage.setItem(RANK_UP_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function peekPvpRankUpPending(): PvpRankUpPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RANK_UP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PvpRankUpPayload;
    if (
      typeof parsed.before !== "number" ||
      typeof parsed.after !== "number" ||
      typeof parsed.ts !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.ts > RANK_UP_TTL_MS) {
      window.sessionStorage.removeItem(RANK_UP_KEY);
      return null;
    }
    if (!didPromoteRank(parsed.before, parsed.after)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Consumir al terminar la animación (no al montar). */
export function clearPvpRankUpPending(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RANK_UP_KEY);
  } catch {
    // ignore
  }
}
