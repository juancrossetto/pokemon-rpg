import { closeTestDb, query } from "./db";
import { E2E_EMAIL_DOMAIN, E2E_PREFIX } from "./account";

/**
 * Borra las cuentas que creó la corrida.
 *
 * Corre contra la base compartida, así que el filtro es doble —prefijo **y**
 * dominio— para que ningún error de tipeo pueda alcanzar a una cuenta real.
 *
 * Si un borrado falla (por ejemplo si el usuario quedó como vendedor de una
 * publicación del mercado, relación sin `onDelete: Cascade`) se avisa y se
 * sigue: dejar una cuenta huérfana es molesto, pero tumbar el teardown haría
 * que la suite reporte rojo por algo que no es el sistema bajo prueba.
 */
export default async function globalTeardown(): Promise<void> {
  try {
    const users = await query<{ id: string; email: string }>(
      `SELECT id, email FROM "User" WHERE email LIKE $1 AND email LIKE $2`,
      [`${E2E_PREFIX}%`, `%${E2E_EMAIL_DOMAIN}`],
    );
    if (users.length === 0) return;

    let removed = 0;
    for (const user of users) {
      try {
        await query(`DELETE FROM "User" WHERE id = $1`, [user.id]);
        removed++;
      } catch (error) {
        console.warn(
          `[e2e teardown] no se pudo borrar ${user.email}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
    console.log(`[e2e teardown] cuentas de prueba borradas: ${removed}/${users.length}`);
  } finally {
    await closeTestDb();
  }
}
