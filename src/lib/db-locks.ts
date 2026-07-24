import type { Prisma } from "@/generated/prisma/client";

/**
 * Toma un lock de fila sobre uno o dos jugadores dentro de la transacción.
 *
 * Casi toda operación del mercado es read-then-write sobre datos de un mismo
 * jugador: ¿este Pokémon ya está publicado?, ¿le queda otro en el equipo?,
 * ¿qué slot está libre? En READ COMMITTED (el default de Postgres y de Prisma)
 * eso NO es atómico: dos requests simultáneos leen el mismo estado y los dos
 * escriben — de ahí salían el Pokémon publicado dos veces, el equipo vacío y
 * los dos Pokémon en el mismo slot. Serializar por jugador cierra toda esa
 * familia de carreras de una sola vez, y deja las guardas atómicas de
 * `updateMany` como segunda línea de defensa.
 *
 * Con dos jugadores (comprador y vendedor) se bloquea SIEMPRE en orden de id:
 * si dos compras cruzadas tomaran los locks en distinto orden, Postgres las
 * mataría por deadlock.
 */
export async function lockUsers(
  tx: Prisma.TransactionClient,
  userId: string,
  otherUserId?: string,
): Promise<void> {
  if (otherUserId === undefined || otherUserId === userId) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    return;
  }
  await tx.$queryRaw`
    SELECT id FROM "User" WHERE id IN (${userId}, ${otherUserId}) ORDER BY id FOR UPDATE
  `;
}

/**
 * Lock de fila sobre un clan. Serializa las operaciones que dependen del conteo
 * de miembros (unirse cuando está por llenarse, expulsar) para que dos requests
 * simultáneos no superen el cupo máximo.
 */
export async function lockClan(tx: Prisma.TransactionClient, clanId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Clan" WHERE id = ${clanId} FOR UPDATE`;
}
