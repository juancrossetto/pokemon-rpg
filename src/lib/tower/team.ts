import { calculateMaxHp } from "@/lib/stats";
import { Prisma } from "@/generated/prisma/client";
import { maxHpBlessingMultiplier } from "./blessings";
import type { TowerRunCreature } from "./types";

export type TeamRowForTower = {
  id: string;
  nickname: string | null;
  level: number;
  currentHp: number;
  teamSlot: number | null;
  ptConstitution: number;
  species: {
    id: number;
    name: string;
    spriteUrl: string;
    baseHp: number;
    types: string[];
  };
  moves: { slot: number; currentPp: number; move: { pp: number } }[];
};

export const TOWER_TEAM_INCLUDE = {
  species: true,
  moves: {
    orderBy: { slot: "asc" as const },
    select: { slot: true, currentPp: true, move: { select: { pp: true } } },
  },
} as const;

function asJson(team: TowerRunCreature[]): Prisma.InputJsonValue {
  return team as unknown as Prisma.InputJsonValue;
}

export { asJson as towerTeamSnapshotJson };

/** Crea snapshot de intento: HP al máximo para el run; guarda restore de Aventura. */
export function buildTowerTeamSnapshot(
  rows: TeamRowForTower[],
  blessingIds: string[] = [],
): TowerRunCreature[] {
  const hpMult = maxHpBlessingMultiplier(blessingIds);
  return rows
    .filter((r) => r.teamSlot != null)
    .sort((a, b) => (a.teamSlot ?? 0) - (b.teamSlot ?? 0))
    .map((p) => {
      const baseMax = calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution);
      const maxHp = Math.max(1, Math.floor(baseMax * hpMult));
      return {
        instanceId: p.id,
        slot: p.teamSlot!,
        speciesId: p.species.id,
        speciesName: p.species.name,
        nickname: p.nickname,
        spriteUrl: p.species.spriteUrl,
        level: p.level,
        types: p.species.types,
        currentHp: maxHp,
        maxHp,
        defeated: false,
        adventureHp: p.currentHp,
        adventurePp: p.moves.map((m) => ({
          slot: m.slot,
          pp: m.currentPp,
          maxPp: m.move.pp,
        })),
      };
    });
}

export function parseTowerTeamSnapshot(raw: unknown): TowerRunCreature[] {
  if (!Array.isArray(raw)) return [];
  return raw as TowerRunCreature[];
}

/** Sincroniza snapshot desde HP/PP reales de las instancias tras un combate. */
export function syncSnapshotFromInstances(
  snapshot: TowerRunCreature[],
  instances: { id: string; currentHp: number }[],
): TowerRunCreature[] {
  const byId = new Map(instances.map((i) => [i.id, i]));
  return snapshot.map((m) => {
    const inst = byId.get(m.instanceId);
    if (!inst) return m;
    const hp = Math.max(0, inst.currentHp);
    return {
      ...m,
      currentHp: hp,
      defeated: hp <= 0,
    };
  });
}

/** Aplica HP del snapshot a PokemonInstance (inicio de batalla / rest). */
export async function applySnapshotHpToInstances(
  tx: Prisma.TransactionClient,
  snapshot: TowerRunCreature[],
): Promise<void> {
  if (snapshot.length === 0) return;
  await tx.$executeRaw`
    UPDATE "PokemonInstance" AS p
    SET "currentHp" = v.hp::int
    FROM (VALUES ${Prisma.join(
      snapshot.map((m) =>
        Prisma.sql`(${m.instanceId}, ${m.defeated ? 0 : Math.max(0, m.currentHp)})`,
      ),
    )}) AS v(id, hp)
    WHERE p.id = v.id
  `;
}

/** Restaura HP/PP de Aventura al cerrar el intento. */
export async function restoreAdventureTeam(
  tx: Prisma.TransactionClient,
  snapshot: TowerRunCreature[],
): Promise<void> {
  if (snapshot.length === 0) return;

  /*
    Bulk en 2 round-trips. Un Promise.all de ~30 updates dentro de la tx de
    batalla (lock + battleSession + log + settle) explotaba el timeout default
    de 5s en Postgres remoto.
  */
  await tx.$executeRaw`
    UPDATE "PokemonInstance" AS p
    SET "currentHp" = v.hp::int
    FROM (VALUES ${Prisma.join(
      snapshot.map((m) =>
        Prisma.sql`(${m.instanceId}, ${Math.max(0, m.adventureHp)})`,
      ),
    )}) AS v(id, hp)
    WHERE p.id = v.id
  `;

  const ppRows = snapshot.flatMap((m) =>
    m.adventurePp.map((pp) =>
      Prisma.sql`(${m.instanceId}, ${pp.slot}, ${pp.pp})`,
    ),
  );
  if (ppRows.length === 0) return;

  await tx.$executeRaw`
    UPDATE "PokemonMove" AS m
    SET "currentPp" = v.pp::int
    FROM (VALUES ${Prisma.join(ppRows)}) AS v("pokemonInstanceId", slot, pp)
    WHERE m."pokemonInstanceId" = v."pokemonInstanceId" AND m.slot = v.slot::int
  `;
}

/**
 * Al iniciar run: HP al máximo del snapshot y PP al maxPp ya conocido
 * (sin findUnique por slot — evita timeout en tx remotas).
 */
export async function primeTeamForTowerRun(
  tx: Prisma.TransactionClient,
  snapshot: TowerRunCreature[],
): Promise<void> {
  if (snapshot.length === 0) return;

  await tx.$executeRaw`
    UPDATE "PokemonInstance" AS p
    SET "currentHp" = v.hp::int
    FROM (VALUES ${Prisma.join(
      snapshot.map((m) => Prisma.sql`(${m.instanceId}, ${m.maxHp})`),
    )}) AS v(id, hp)
    WHERE p.id = v.id
  `;

  const ppRows = snapshot.flatMap((m) =>
    m.adventurePp.map((pp) =>
      Prisma.sql`(${m.instanceId}, ${pp.slot}, ${pp.maxPp})`,
    ),
  );
  if (ppRows.length === 0) return;

  await tx.$executeRaw`
    UPDATE "PokemonMove" AS m
    SET "currentPp" = v.pp::int
    FROM (VALUES ${Prisma.join(ppRows)}) AS v("pokemonInstanceId", slot, pp)
    WHERE m."pokemonInstanceId" = v."pokemonInstanceId" AND m.slot = v.slot::int
  `;
}
