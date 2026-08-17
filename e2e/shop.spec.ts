import { expect, test } from "@playwright/test";
import { closeActiveBattles, queryOne } from "./support/db";
import { sessionAccount } from "./support/session";
import { goto } from "./support/ui";

// Un combate abierto redirige toda la app a `/battle`; que otro spec lo haya
// dejado así no debería hacer fallar a éste.
test.beforeEach(async () => {
  await closeActiveBattles(sessionAccount().userId);
});

/**
 * Compra en la tienda: monedas que bajan e inventario que sube.
 *
 * Vale la pena como E2E porque la compra es la única acción donde un bug se
 * traduce directo en economía rota, y porque el patrón que la protege —el
 * `updateMany` con guarda sobre el saldo— sólo se ejerce de punta a punta. Un
 * test unitario del action no ve el formulario, y el formulario es donde se
 * arma la cantidad.
 */
async function balance(userId: string) {
  const row = await queryOne<{ coins: number; items: string }>(
    `SELECT u.coins,
            COALESCE((SELECT SUM(quantity) FROM "InventoryItem" WHERE "userId" = u.id), 0)::text AS items
     FROM "User" u WHERE u.id = $1`,
    [userId],
  );
  return { coins: row!.coins, items: Number(row!.items) };
}

test("comprar un objeto descuenta monedas y suma al inventario", async ({ page }) => {
  const { userId } = sessionAccount();
  const before = await balance(userId);
  expect(before.coins, "la cuenta de pruebas debería arrancar con monedas").toBeGreaterThan(0);

  await goto(page, "/es/shop");

  /*
    Primer producto **comprable**: cuál sea da igual, lo que se prueba es el
    circuito y no el catálogo. El filtro por `:not([disabled])` no es cosmético
    — la grilla incluye objetos que el jugador ya tiene al máximo, y ésos vienen
    deshabilitados.
  */
  const tile = page.locator(".shop-tile button:not([disabled])").first();
  await expect(tile).toBeAttached({ timeout: 30_000 });
  await tile.scrollIntoViewIfNeeded();
  await expect(tile).toBeVisible();
  await tile.click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible({ timeout: 15_000 });

  const confirm = sheet.locator("[data-autofocus]");
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect
    .poll(async () => (await balance(userId)).items, {
      timeout: 30_000,
      message: "el objeto nunca llegó al inventario",
    })
    .toBeGreaterThan(before.items);

  const after = await balance(userId);
  expect(after.coins, "la compra no descontó monedas").toBeLessThan(before.coins);
});
