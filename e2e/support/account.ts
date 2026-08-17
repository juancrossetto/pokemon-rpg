import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Marca de las cuentas de prueba.
 *
 * Todo lo que cree la suite arranca con esto, y el teardown borra exactamente
 * lo que matchee. Es la pieza que hace seguro correr los E2E contra la base
 * compartida: los tests nunca tocan la cuenta de nadie, se crean la suya.
 */
export const E2E_PREFIX = "e2e-";
export const E2E_EMAIL_DOMAIN = "@pokerpg.test";
export const E2E_PASSWORD = "e2e-passw0rd";

export type TestAccount = {
  username: string;
  email: string;
  password: string;
};

let seq = 0;

export function newAccount(): TestAccount {
  // `Date.now()` en base 36 son 8 caracteres: entra en el límite de 20 del
  // nombre de entrenador y alcanza para no colisionar entre corridas.
  const id = `${Date.now().toString(36)}${(seq++).toString(36)}`;
  return {
    username: `${E2E_PREFIX}${id}`,
    email: `${E2E_PREFIX}${id}${E2E_EMAIL_DOMAIN}`,
    password: E2E_PASSWORD,
  };
}

/**
 * Registro por la UI real, no por un insert directo.
 *
 * Crear el usuario a mano en la base sería más rápido, pero duplicaría lo que
 * hace `registerUser` (progreso de campaña, inventario inicial, bonus de
 * bienvenida) y esa copia se desincroniza al primer cambio. Pasar por el
 * formulario también hace que el alta quede cubierta sin un test dedicado.
 *
 * Los selectores van por atributo (`autocomplete`, `type`) y no por texto:
 * la app tiene tres idiomas y los tests no deberían romperse al retocar una
 * traducción.
 */
export async function register(page: Page, account: TestAccount): Promise<void> {
  await page.goto("/es/register");

  await page.locator('input[autocomplete="username"]').fill(account.username);
  await page.locator('input[autocomplete="email"]').fill(account.email);
  await page.locator('input[autocomplete="new-password"]').fill(account.password);
  // El select de país se llena recién al montar (evita un mismatch de
  // hidratación), así que hay que esperar a que tenga opciones.
  const country = page.locator("select");
  await expect(country.locator("option")).not.toHaveCount(1);
  await country.selectOption("AR");

  await page.locator('button[type="submit"]').click();

  // El alta termina redirigiendo a la elección de inicial.
  await page.waitForURL(/\/starter/, { timeout: 60_000 });
}

/**
 * Cierra el tutorial de Oak y elige el inicial.
 *
 * El diálogo se monta por portal después de hidratar, así que hay que esperarlo
 * antes de intentar avanzarlo: sin esa espera el bucle sale en la primera vuelta
 * —todavía no existe— y el click sobre la grilla queda bloqueado por el overlay.
 */
export async function pickStarter(page: Page, name = /bulbasaur/i): Promise<void> {
  const next = page.getByRole("dialog").getByRole("button");
  await next.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  for (let i = 0; i < 8; i++) {
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
    await page.waitForTimeout(400);
  }

  const pick = page.getByRole("button", { name }).first();
  await expect(pick).toBeVisible({ timeout: 30_000 });
  await pick.click();
  await page.waitForURL((url) => !url.pathname.includes("/starter"), { timeout: 60_000 });
}

/** Login por el formulario, para reusar una cuenta ya creada. */
export async function login(page: Page, account: TestAccount): Promise<void> {
  await page.goto("/es/login");
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[autocomplete="current-password"], input[type="password"]').first().fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 60_000 });
}
