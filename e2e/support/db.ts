import { Pool } from "pg";
import { loadEnv } from "./env";

/**
 * Acceso a la base para los tests, con `pg` pelado.
 *
 * No usa Prisma a propósito, por dos razones. La práctica: el cliente generado
 * es ESM y Playwright transpila a CJS, así que importarlo revienta con
 * `Cannot use 'import.meta' outside a module`. Y la de fondo, que es la que
 * importa: si el test consultara con el mismo ORM y el mismo esquema que usa la
 * app, un error de mapeo se cancelaría solo —escribo mal y leo mal igual, el
 * assert pasa—. En SQL directo el test es un observador independiente.
 */
let pool: Pool | null = null;

function db(): Pool {
  if (pool) return pool;
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no está definida");
  pool = new Pool({ connectionString, max: 2, allowExitOnIdle: true });
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await db().query(sql, params);
  return result.rows as T[];
}

/** Primera fila, o `null`. Evita el `rows[0]` con `!` en cada assert. */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Cierra los combates abiertos de una cuenta de prueba.
 *
 * Un combate activo bloquea el resto del juego a propósito (`redirectIfInBattle`
 * manda todo a `/battle`), así que un spec que deja uno abierto rompe a los que
 * corren después. Esto vuelve los specs independientes del orden.
 *
 * Va directo a la base y no por la UI porque no es lo que se está probando: es
 * limpieza entre casos, y hacerla con "huir" ataría cada spec al azar del
 * porcentaje de fuga.
 */
export async function closeActiveBattles(userId: string): Promise<void> {
  await query(
    `UPDATE "BattleSession" SET status = 'LOST', "turnDeadlineAt" = NULL
     WHERE "userId" = $1 AND status = 'ACTIVE'`,
    [userId],
  );
  await query(`UPDATE "GymRun" SET status = 'ABANDONED' WHERE "userId" = $1 AND status = 'ACTIVE'`, [
    userId,
  ]).catch(() => undefined);
}

export async function closeTestDb(): Promise<void> {
  await pool?.end().catch(() => undefined);
  pool = null;
}
