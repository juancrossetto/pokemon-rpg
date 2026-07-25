/**
 * Movimientos aprendidos / pendientes y oferta de evolución tras un level-up.
 */
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { markSpeciesSeen } from "@/lib/pokedex-seen";

export type LevelUpMoveInfo = {
  moveId: number;
  name: string;
  type: string;
  learnLevel: number;
  pp: number;
};

export type EvolveOffer = {
  toSpeciesId: number;
  toName: string;
  toSpriteUrl: string;
  evolveLevel: number;
};

export type LevelUpEffects = {
  autoTaught: LevelUpMoveInfo[];
  pendingMoves: LevelUpMoveInfo[];
  evolveOffer: EvolveOffer | null;
};

/** Movimientos LEVEL_UP aprendidos entre (fromLevel, toLevel]. */
export async function getMovesLearnedInRange(
  speciesId: number,
  fromLevel: number,
  toLevel: number,
): Promise<LevelUpMoveInfo[]> {
  if (toLevel <= fromLevel) return [];
  const rows = await prisma.speciesMove.findMany({
    where: {
      speciesId,
      method: "LEVEL_UP",
      learnLevel: { gt: fromLevel, lte: toLevel },
    },
    include: { move: { select: { id: true, name: true, type: true, pp: true } } },
    orderBy: { learnLevel: "asc" },
  });
  // Deduplicar por moveId (por si hay filas raras).
  const seen = new Set<number>();
  const out: LevelUpMoveInfo[] = [];
  for (const r of rows) {
    if (seen.has(r.move.id)) continue;
    seen.add(r.move.id);
    out.push({
      moveId: r.move.id,
      name: r.move.name,
      type: r.move.type,
      learnLevel: r.learnLevel ?? toLevel,
      pp: r.move.pp,
    });
  }
  return out;
}

/**
 * Oferta de evolución por nivel.
 * Se reevalúa en CADA level-up: diferir ("Más tarde") no guarda nada;
 * mientras siga siendo esta especie y level >= evolveLevel, se vuelve a preguntar.
 */
export async function getEvolveOffer(
  speciesId: number,
  level: number,
): Promise<EvolveOffer | null> {
  const species = await prisma.species.findUnique({
    where: { id: speciesId },
    select: {
      evolveLevel: true,
      evolvesTo: {
        select: { id: true, name: true, spriteUrl: true },
        orderBy: { id: "asc" },
        take: 1,
      },
    },
  });
  if (species?.evolveLevel == null || level < species.evolveLevel) return null;
  const next = species.evolvesTo[0];
  if (!next) return null;
  return {
    toSpeciesId: next.id,
    toName: next.name,
    toSpriteUrl: next.spriteUrl,
    evolveLevel: species.evolveLevel,
  };
}

/**
 * Clasifica movimientos nuevos: los que caben en slots vacíos vs los que
 * requieren olvidar uno (el jugador decide en UI).
 * No escribe en DB — la UI confirma cada aprendizaje.
 */
export function classifyNewMoves(
  knownMoveIds: Set<number>,
  usedSlots: Set<number>,
  candidates: LevelUpMoveInfo[],
): { autoFill: LevelUpMoveInfo[]; needsChoice: LevelUpMoveInfo[] } {
  const emptySlots = [1, 2, 3, 4].filter((s) => !usedSlots.has(s));
  const autoFill: LevelUpMoveInfo[] = [];
  const needsChoice: LevelUpMoveInfo[] = [];
  const seen = new Set(knownMoveIds);

  for (const move of candidates) {
    if (seen.has(move.moveId)) continue;
    seen.add(move.moveId);
    if (emptySlots.length > 0) {
      emptySlots.shift();
      autoFill.push(move);
    } else {
      needsChoice.push(move);
    }
  }
  return { autoFill, needsChoice };
}

/**
 * Enseña movimientos nuevos en slots vacíos. Los que no caben quedan pendientes.
 * @deprecated Preferí classify + confirmLearnMove desde la UI para que el
 * jugador vea cada aprendizaje. Se mantiene para batallas multi-pokemon.
 */
export async function applyAutoTeachMoves(
  instanceId: string,
  candidates: LevelUpMoveInfo[],
): Promise<{ autoTaught: LevelUpMoveInfo[]; pendingMoves: LevelUpMoveInfo[] }> {
  if (candidates.length === 0) {
    return { autoTaught: [], pendingMoves: [] };
  }

  const known = await prisma.pokemonMove.findMany({
    where: { pokemonInstanceId: instanceId },
    orderBy: { slot: "asc" },
  });
  const { autoFill, needsChoice } = classifyNewMoves(
    new Set(known.map((m) => m.moveId)),
    new Set(known.map((m) => m.slot)),
    candidates,
  );

  const autoTaught: LevelUpMoveInfo[] = [];
  for (const move of autoFill) {
    const usedSlots = new Set(
      (
        await prisma.pokemonMove.findMany({
          where: { pokemonInstanceId: instanceId },
          select: { slot: true },
        })
      ).map((m) => m.slot),
    );
    const slot = [1, 2, 3, 4].find((s) => !usedSlots.has(s));
    if (slot == null) {
      needsChoice.unshift(move);
      continue;
    }
    await prisma.pokemonMove.create({
      data: {
        pokemonInstanceId: instanceId,
        moveId: move.moveId,
        slot,
        currentPp: move.pp,
      },
    });
    autoTaught.push(move);
  }

  return { autoTaught, pendingMoves: needsChoice };
}

/** Tras subir de nivel: lista movimientos a ofrecer (sin auto-escribir) + evo. */
export async function resolveLevelUpEffects(
  instanceId: string,
  speciesId: number,
  fromLevel: number,
  toLevel: number,
): Promise<LevelUpEffects> {
  // Leer especie/nivel reales post level-up (por si el caller trae datos viejos).
  const live = await prisma.pokemonInstance.findUnique({
    where: { id: instanceId },
    select: { speciesId: true, level: true },
  });
  const effectiveSpeciesId = live?.speciesId ?? speciesId;
  const effectiveLevel = live?.level ?? toLevel;

  const candidates = await getMovesLearnedInRange(
    effectiveSpeciesId,
    fromLevel,
    effectiveLevel,
  );
  const known = await prisma.pokemonMove.findMany({
    where: { pokemonInstanceId: instanceId },
    orderBy: { slot: "asc" },
  });
  const { autoFill, needsChoice } = classifyNewMoves(
    new Set(known.map((m) => m.moveId)),
    new Set(known.map((m) => m.slot)),
    candidates,
  );
  // Todo pasa por la UI: autoFill = aprende en slot libre al confirmar;
  // needsChoice = hay que olvidar o ignorar.
  const pendingMoves = [...autoFill, ...needsChoice];
  let evolveOffer: EvolveOffer | null = null;
  try {
    // Re-pregunta en cada subida mientras no evolucione (aunque haya diferido antes).
    evolveOffer = await getEvolveOffer(effectiveSpeciesId, effectiveLevel);
  } catch (err) {
    console.error("[resolveLevelUpEffects] getEvolveOffer", err);
  }
  return { autoTaught: [], pendingMoves, evolveOffer };
}

/** Aprende un movimiento pendiente reemplazando un slot (o llenando vacío). */
export async function learnPendingMove(opts: {
  userId: string;
  instanceId: string;
  moveId: number;
  replaceSlot: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: opts.instanceId, ownerId: opts.userId },
    include: { moves: true },
  });
  if (!instance) return { ok: false, error: "not_found" };

  const learnable = await prisma.speciesMove.findFirst({
    where: {
      speciesId: instance.speciesId,
      moveId: opts.moveId,
      method: "LEVEL_UP",
      learnLevel: { lte: instance.level },
    },
    include: { move: true },
  });
  if (!learnable) return { ok: false, error: "not_learnable" };
  if (instance.moves.some((m) => m.moveId === opts.moveId)) {
    return { ok: false, error: "already_known" };
  }

  const usedSlots = new Set(instance.moves.map((m) => m.slot));
  const empty = [1, 2, 3, 4].find((s) => !usedSlots.has(s));

  if (empty != null && (opts.replaceSlot == null || opts.replaceSlot === empty)) {
    await prisma.pokemonMove.create({
      data: {
        pokemonInstanceId: instance.id,
        moveId: opts.moveId,
        slot: empty,
        currentPp: learnable.move.pp,
      },
    });
    return { ok: true };
  }

  if (opts.replaceSlot == null || opts.replaceSlot < 1 || opts.replaceSlot > 4) {
    return { ok: false, error: "need_slot" };
  }

  await prisma.pokemonMove.upsert({
    where: {
      pokemonInstanceId_slot: {
        pokemonInstanceId: instance.id,
        slot: opts.replaceSlot,
      },
    },
    create: {
      pokemonInstanceId: instance.id,
      moveId: opts.moveId,
      slot: opts.replaceSlot,
      currentPp: learnable.move.pp,
    },
    update: {
      moveId: opts.moveId,
      currentPp: learnable.move.pp,
    },
  });
  return { ok: true };
}

/** Evoluciona la instancia a su siguiente forma por nivel (si corresponde). */
export async function evolvePokemonInstance(opts: {
  userId: string;
  instanceId: string;
}): Promise<
  | {
      ok: true;
      fromName: string;
      toName: string;
      toSpriteUrl: string;
      level: number;
      currentHp: number;
      maxHp: number;
    }
  | { ok: false; error: string }
> {
  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: opts.instanceId, ownerId: opts.userId },
    include: {
      species: {
        select: {
          id: true,
          name: true,
          baseHp: true,
          evolveLevel: true,
          evolvesTo: {
            select: { id: true, name: true, spriteUrl: true, baseHp: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!instance) return { ok: false, error: "not_found" };

  const offer = await getEvolveOffer(instance.speciesId, instance.level);
  if (!offer) return { ok: false, error: "not_ready" };

  const next = instance.species.evolvesTo[0];
  if (!next || next.id !== offer.toSpeciesId) return { ok: false, error: "not_ready" };

  const prevMax = calculateMaxHp(
    instance.species.baseHp,
    instance.level,
    instance.ptConstitution,
  );
  const newMax = calculateMaxHp(next.baseHp, instance.level, instance.ptConstitution);
  const newHp = Math.min(newMax, Math.max(1, instance.currentHp + (newMax - prevMax)));

  await prisma.pokemonInstance.update({
    where: { id: instance.id },
    data: {
      speciesId: next.id,
      currentHp: newHp,
    },
  });

  await markSpeciesSeen(opts.userId, next.id);

  return {
    ok: true,
    fromName: instance.species.name,
    toName: next.name,
    toSpriteUrl: next.spriteUrl,
    level: instance.level,
    currentHp: newHp,
    maxHp: newMax,
  };
}
