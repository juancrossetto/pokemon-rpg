import { expect, test, type Page } from "@playwright/test";
import { queryOne } from "./support/db";
import { sessionAccount } from "./support/session";
import { goto } from "./support/ui";

/**
 * Bucle central: entrar en combate y atacar.
 *
 * Es el flujo que más veces por sesión ejecuta un jugador y el que más partes
 * toca a la vez: lock de combate, generación del rival, moveset por nivel,
 * motor de daño y log. La suite unitaria cubre la fórmula de daño con precisión
 * quirúrgica; lo que no puede cubrir es que el botón conecte con la acción y
 * que la acción escriba. Eso es lo que se prueba acá.
 */
type BattleRow = {
  id: string;
  status: string;
  wildMaxHp: number;
  wildCurrentHp: number;
};

function activeBattle(userId: string) {
  return queryOne<BattleRow>(
    `SELECT id, status, "wildMaxHp", "wildCurrentHp" FROM "BattleSession"
     WHERE "userId" = $1 AND status = 'ACTIVE'
     ORDER BY "createdAt" DESC LIMIT 1`,
    [userId],
  );
}

/**
 * Deja al jugador dentro de un combate.
 *
 * Una cuenta recién creada arranca con la batalla guionada del rival, así que
 * `/battle` va derecho a la arena y no hay lobby que mostrar. Si esa ya se
 * jugó, en cambio, hay que explorar. Cubrir los dos casos evita que el test
 * dependa de en qué punto del onboarding quedó la cuenta.
 */
async function enterBattle(page: Page, userId: string): Promise<BattleRow> {
  await goto(page, "/es/battle");

  const existing = await activeBattle(userId);
  if (!existing) {
    await page.locator('button.game-cta--red[type="submit"]').first().click();
  }

  await expect
    .poll(async () => (await activeBattle(userId)) !== null, {
      timeout: 45_000,
      message: "no se creó la sesión de combate",
    })
    .toBe(true);

  return (await activeBattle(userId))!;
}

test("atacar resuelve el turno y lo escribe en la base", async ({ page }) => {
  const { userId } = sessionAccount();
  const battle = await enterBattle(page, userId);

  // Menú de combate → LUCHAR → primer movimiento disponible.
  const fight = page.locator(".battle-cmd-fight");
  await expect(fight).toBeVisible({ timeout: 30_000 });
  await fight.click();

  const move = page.locator(".battle-move-card:not([disabled])").first();
  await expect(move).toBeVisible({ timeout: 15_000 });
  await move.click();

  /*
    El assert no es "el rival perdió HP" a secas: si el golpe lo tumba, la
    sesión pasa a WON y la fila ya no tiene HP que comparar. Lo que importa es
    que el turno **se resolvió** —el rival recibió daño o el combate cerró—, no
    cuál de los dos finales tocó.
  */
  await expect
    .poll(
      async () => {
        const row = await queryOne<BattleRow>(
          `SELECT id, status, "wildMaxHp", "wildCurrentHp" FROM "BattleSession" WHERE id = $1`,
          [battle.id],
        );
        if (!row) return "sin fila";
        if (row.status !== "ACTIVE") return "cerrado";
        return row.wildCurrentHp < battle.wildMaxHp ? "dañado" : "intacto";
      },
      { timeout: 45_000, message: "el turno nunca se resolvió en la base" },
    )
    .not.toBe("intacto");

  // El log del combate es lo que el jugador lee: si el turno se resolvió pero
  // el log quedó vacío, la pantalla miente aunque la base esté bien.
  const log = await queryOne<{ n: number }>(
    `SELECT array_length(log, 1) AS n FROM "BattleSession" WHERE id = $1`,
    [battle.id],
  );
  expect(log!.n).toBeGreaterThan(1);
});
