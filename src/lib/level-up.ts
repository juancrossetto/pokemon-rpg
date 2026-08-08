/**
 * Movimientos aprendidos / pendientes y oferta de evolución tras un level-up.
 */
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { markSpeciesSeen } from "@/lib/pokedex-seen";
import { spriteFor } from "@/lib/shiny";
import {
  toKnownMoveInfo,
  toLevelUpMoveInfo,
  type EvolveOffer,
  type KnownMoveInfo,
  type LevelUpEffects,
  type LevelUpMoveInfo,
} from "@/lib/level-up-read";

export type {
  EvolveOffer,
  KnownMoveInfo,
  LevelUpEffects,
  LevelUpMoveInfo,
  MoveCategoryKind,
} from "@/lib/level-up-read";
export { knownFromLevelUp, toKnownMoveInfo } from "@/lib/level-up-read";

const MOVE_SELECT = {
  id: true,
  name: true,
  type: true,
  category: true,
  power: true,
  accuracy: true,
  pp: true,
  effectText: true,
} as const;

/** Movimientos LEVEL_UP con learnLevel en (fromLevel, toLevel]. */
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
    include: { move: { select: MOVE_SELECT } },
    orderBy: { learnLevel: "asc" },
  });
  // Deduplicar por moveId (por si hay filas raras).
  const seen = new Set<number>();
  const out: LevelUpMoveInfo[] = [];
  for (const r of rows) {
    if (seen.has(r.move.id)) continue;
    seen.add(r.move.id);
    out.push(toLevelUpMoveInfo(r.move, r.learnLevel ?? toLevel));
  }
  return out;
}

/**
 * Oferta de evolución por nivel.
 * Usa `Species.evolveLevel` del padre; si falta, cae a `evolveMinLevel` del hijo
 * (backfill de método). Se reevalúa en cada level-up: diferir no guarda nada.
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
        select: {
          id: true,
          name: true,
          spriteUrl: true,
          evolveTrigger: true,
          evolveMinLevel: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!species) return null;

  // Solo evoluciones por nivel (no piedras / Linking Cord en el mismo padre).
  const next =
    species.evolvesTo.find(
      (c) => c.evolveTrigger === "level-up" || c.evolveTrigger == null,
    ) ?? null;
  if (!next) return null;

  const requiredLevel = species.evolveLevel ?? next.evolveMinLevel;
  if (requiredLevel == null || level < requiredLevel) return null;

  return {
    toSpeciesId: next.id,
    toName: next.name,
    toSpriteUrl: next.spriteUrl,
    evolveLevel: requiredLevel,
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

/**
 * Tras subir de nivel: movimientos a ofrecer (sin auto-escribir) + evo.
 * Solo movimientos con learnLevel en (fromLevel, toLevel].
 * Los rechazados (`declinedMoveIds`) no vuelven; "Ignorar" en UI sólo
 * cierra este level-up (no reabre el mismo move en cada caramelo).
 */
export async function resolveLevelUpEffects(
  instanceId: string,
  speciesId: number,
  fromLevel: number,
  toLevel: number,
): Promise<LevelUpEffects> {
  // Especie/nivel post level-up + known en paralelo (evitar 2 RTT en serie).
  const [live, knownRows] = await Promise.all([
    prisma.pokemonInstance.findUnique({
      where: { id: instanceId },
      select: { speciesId: true, level: true, declinedMoveIds: true },
    }),
    prisma.pokemonMove.findMany({
      where: { pokemonInstanceId: instanceId },
      include: { move: { select: MOVE_SELECT } },
      orderBy: { slot: "asc" },
    }),
  ]);
  return buildLevelUpEffects({
    speciesId: live?.speciesId ?? speciesId,
    level: live?.level ?? toLevel,
    fromLevel,
    knownMoves: knownRows.map((m) => toKnownMoveInfo(m.slot, m.move)),
    declinedMoveIds: live?.declinedMoveIds ?? [],
  });
}

/**
 * Misma lógica que `resolveLevelUpEffects`, pero sin re-leer instancia/known.
 * Para callers que ya tienen el estado post level-up en memoria (caramelo raro).
 */
export async function buildLevelUpEffects(opts: {
  speciesId: number;
  level: number;
  /** Nivel antes del level-up; solo se ofrecen moves nuevos en el rango. */
  fromLevel: number;
  knownMoves: KnownMoveInfo[];
  declinedMoveIds?: number[];
}): Promise<LevelUpEffects> {
  const [candidates, evolveOffer] = await Promise.all([
    getMovesLearnedInRange(opts.speciesId, opts.fromLevel, opts.level),
    getEvolveOffer(opts.speciesId, opts.level).catch((err) => {
      console.error("[buildLevelUpEffects] getEvolveOffer", err);
      return null;
    }),
  ]);
  const declined = new Set(opts.declinedMoveIds ?? []);
  const eligible = candidates.filter((m) => !declined.has(m.moveId));
  const { autoFill, needsChoice } = classifyNewMoves(
    new Set(opts.knownMoves.map((m) => m.moveId)),
    new Set(opts.knownMoves.map((m) => m.slot)),
    eligible,
  );
  // Todo pasa por la UI: autoFill = aprende en slot libre al confirmar;
  // needsChoice = hay que olvidar, ignorar o rechazar.
  return {
    autoTaught: [],
    pendingMoves: [...autoFill, ...needsChoice],
    evolveOffer,
    knownMoves: opts.knownMoves,
  };
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

  const replaced = instance.moves.find((m) => m.slot === opts.replaceSlot);
  // Olvidar un LEVEL_UP no debe reabrirlo en cada caramelo: marcar declined.
  const declineIds: number[] = [];
  if (
    replaced &&
    replaced.moveId !== opts.moveId &&
    !instance.declinedMoveIds.includes(replaced.moveId)
  ) {
    declineIds.push(replaced.moveId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.pokemonMove.upsert({
      where: {
        pokemonInstanceId_slot: {
          pokemonInstanceId: instance.id,
          slot: opts.replaceSlot!,
        },
      },
      create: {
        pokemonInstanceId: instance.id,
        moveId: opts.moveId,
        slot: opts.replaceSlot!,
        currentPp: learnable.move.pp,
      },
      update: {
        moveId: opts.moveId,
        currentPp: learnable.move.pp,
      },
    });
    if (declineIds.length > 0) {
      await tx.pokemonInstance.update({
        where: { id: instance.id },
        data: {
          declinedMoveIds: [...instance.declinedMoveIds, ...declineIds],
        },
      });
    }
  });
  return { ok: true };
}

/**
 * Rechaza un movimiento LEVEL_UP para siempre: no se vuelve a ofrecer
 * en próximos level-ups (a diferencia de "Ignorar", que sólo difiere).
 */
export async function declinePendingMove(opts: {
  userId: string;
  instanceId: string;
  moveId: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: opts.instanceId, ownerId: opts.userId },
    select: {
      id: true,
      speciesId: true,
      level: true,
      declinedMoveIds: true,
      moves: { select: { moveId: true } },
    },
  });
  if (!instance) return { ok: false, error: "not_found" };

  if (instance.moves.some((m) => m.moveId === opts.moveId)) {
    return { ok: false, error: "already_known" };
  }

  const learnable = await prisma.speciesMove.findFirst({
    where: {
      speciesId: instance.speciesId,
      moveId: opts.moveId,
      method: "LEVEL_UP",
      learnLevel: { lte: instance.level },
    },
    select: { moveId: true },
  });
  if (!learnable) return { ok: false, error: "not_learnable" };

  if (instance.declinedMoveIds.includes(opts.moveId)) {
    return { ok: true };
  }

  await prisma.pokemonInstance.update({
    where: { id: instance.id },
    data: { declinedMoveIds: { push: opts.moveId } },
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
      fromSpriteUrl: string;
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
          spriteUrl: true,
          baseHp: true,
          evolveLevel: true,
          evolvesTo: {
            select: {
              id: true,
              name: true,
              spriteUrl: true,
              baseHp: true,
              evolveTrigger: true,
              evolveMinLevel: true,
            },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });
  if (!instance) return { ok: false, error: "not_found" };

  const offer = await getEvolveOffer(instance.speciesId, instance.level);
  if (!offer) return { ok: false, error: "not_ready" };

  const next =
    instance.species.evolvesTo.find((c) => c.id === offer.toSpeciesId) ?? null;
  if (!next) return { ok: false, error: "not_ready" };

  const evolved = await applySpeciesEvolution({
    userId: opts.userId,
    instance: {
      id: instance.id,
      level: instance.level,
      currentHp: instance.currentHp,
      ptConstitution: instance.ptConstitution,
      fromName: instance.species.name,
      fromBaseHp: instance.species.baseHp,
    },
    next: {
      id: next.id,
      name: next.name,
      spriteUrl: next.spriteUrl,
      baseHp: next.baseHp,
    },
  });
  if (!evolved.ok) return evolved;
  return {
    ...evolved,
    fromSpriteUrl: spriteFor(instance.species.spriteUrl, instance.isShiny),
    toSpriteUrl: spriteFor(evolved.toSpriteUrl, instance.isShiny),
  };
}

/**
 * Evoluciona con una piedra: consume 1 del ítem y cambia a la forma cuyo
 * `evolveItem` coincide. No exige nivel (Kanto clásico); si `evolveMinLevel`
 * está seteado, sí lo respeta.
 */
export async function evolvePokemonWithItem(opts: {
  userId: string;
  instanceId: string;
  itemName: string;
  toSpeciesId?: number;
}): Promise<
  | {
      ok: true;
      fromName: string;
      fromSpriteUrl: string;
      toName: string;
      toSpriteUrl: string;
      level: number;
      currentHp: number;
      maxHp: number;
      itemName: string;
    }
  | { ok: false; error: "not_found" | "incompatible" | "not_ready" | "no_item" }
> {
  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: opts.instanceId, ownerId: opts.userId },
    include: {
      species: {
        select: {
          id: true,
          name: true,
          spriteUrl: true,
          baseHp: true,
          evolvesTo: {
            where: {
              evolveTrigger: "use-item",
              evolveItem: opts.itemName,
              ...(opts.toSpeciesId != null ? { id: opts.toSpeciesId } : {}),
            },
            select: {
              id: true,
              name: true,
              spriteUrl: true,
              baseHp: true,
              evolveItem: true,
              evolveMinLevel: true,
            },
            orderBy: { id: "asc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!instance) return { ok: false, error: "not_found" };

  const next = instance.species.evolvesTo[0];
  if (!next || next.evolveItem !== opts.itemName) {
    return { ok: false, error: "incompatible" };
  }
  if (next.evolveMinLevel != null && instance.level < next.evolveMinLevel) {
    return { ok: false, error: "not_ready" };
  }

  const stone = await prisma.inventoryItem.findFirst({
    where: {
      userId: opts.userId,
      quantity: { gt: 0 },
      item: { name: opts.itemName },
    },
    select: { itemId: true, quantity: true },
  });
  if (!stone) return { ok: false, error: "no_item" };

  const fromSpriteUrl = spriteFor(instance.species.spriteUrl, instance.isShiny);
  const evolved = await applySpeciesEvolution({
    userId: opts.userId,
    instance: {
      id: instance.id,
      level: instance.level,
      currentHp: instance.currentHp,
      ptConstitution: instance.ptConstitution,
      fromName: instance.species.name,
      fromBaseHp: instance.species.baseHp,
    },
    next: {
      id: next.id,
      name: next.name,
      spriteUrl: next.spriteUrl,
      baseHp: next.baseHp,
    },
  });
  if (!evolved.ok) return { ok: false, error: "not_found" };

  await prisma.inventoryItem.update({
    where: { userId_itemId: { userId: opts.userId, itemId: stone.itemId } },
    data: { quantity: { decrement: 1 } },
  });
  if (stone.quantity <= 1) {
    await prisma.inventoryItem.deleteMany({
      where: { userId: opts.userId, itemId: stone.itemId, quantity: { lte: 0 } },
    });
  }

  return {
    ...evolved,
    itemName: opts.itemName,
    fromSpriteUrl,
    toSpriteUrl: spriteFor(evolved.toSpriteUrl, instance.isShiny),
  };
}

async function applySpeciesEvolution(opts: {
  userId: string;
  instance: {
    id: string;
    level: number;
    currentHp: number;
    ptConstitution: number;
    fromName: string;
    fromBaseHp: number;
  };
  next: { id: number; name: string; spriteUrl: string; baseHp: number };
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
  const prevMax = calculateMaxHp(
    opts.instance.fromBaseHp,
    opts.instance.level,
    opts.instance.ptConstitution,
  );
  const newMax = calculateMaxHp(
    opts.next.baseHp,
    opts.instance.level,
    opts.instance.ptConstitution,
  );
  const newHp = Math.min(
    newMax,
    Math.max(1, opts.instance.currentHp + (newMax - prevMax)),
  );

  await prisma.pokemonInstance.update({
    where: { id: opts.instance.id },
    data: {
      speciesId: opts.next.id,
      currentHp: newHp,
    },
  });

  await markSpeciesSeen(opts.userId, opts.next.id);

  return {
    ok: true,
    fromName: opts.instance.fromName,
    toName: opts.next.name,
    toSpriteUrl: opts.next.spriteUrl,
    level: opts.instance.level,
    currentHp: newHp,
    maxHp: newMax,
  };
}
