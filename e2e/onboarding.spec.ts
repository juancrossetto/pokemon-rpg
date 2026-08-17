import { expect, test, type Page } from "@playwright/test";
import { newAccount, pickStarter, register, type TestAccount } from "./support/account";
import { closeActiveBattles, query, queryOne } from "./support/db";
import { goto } from "./support/ui";

/**
 * Alta → elección de inicial → home.
 *
 * Es el camino que **todo** jugador nuevo recorre y el único que no se puede
 * saltear: si se rompe, no hay app. Cada paso mira la base además de la
 * pantalla, porque el bug caro acá no es que la UI no navegue sino que navegue
 * habiendo escrito mal.
 *
 * Serial y con un contexto compartido: los pasos son un mismo recorrido, no
 * casos independientes, y aislarlos obligaría a repetir el alta en cada uno.
 */
test.describe.configure({ mode: "serial" });

test.describe("onboarding", () => {
  let page: Page;
  let account: TestAccount;
  let userId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    account = newAccount();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("el alta crea el usuario y lleva a elegir inicial", async () => {
    await register(page, account);

    const user = await queryOne<{
      id: string;
      username: string;
      country: string;
      passwordHash: string;
    }>(`SELECT id, username, country, "passwordHash" FROM "User" WHERE email = $1`, [
      account.email,
    ]);

    expect(user).not.toBeNull();
    userId = user!.id;
    expect(user!.username).toBe(account.username);
    expect(user!.country).toBe("AR");
    // La contraseña nunca debe quedar en claro.
    expect(user!.passwordHash).not.toBe(account.password);
    expect((user!.passwordHash ?? "").length).toBeGreaterThan(20);
  });

  test("elegir inicial deja el Pokémon en el equipo", async () => {
    await pickStarter(page);

    await expect
      .poll(
        async () => {
          const rows = await query<{ n: string }>(
            `SELECT COUNT(*)::text AS n FROM "PokemonInstance"
             WHERE "ownerId" = $1 AND "teamSlot" IS NOT NULL`,
            [userId],
          );
          return Number(rows[0]?.n ?? 0);
        },
        { timeout: 30_000, message: "el inicial nunca llegó al equipo" },
      )
      .toBeGreaterThan(0);

    const mon = await queryOne<{ name: string; currentHp: number; level: number }>(
      `SELECT s.name, p."currentHp", p.level
       FROM "PokemonInstance" p JOIN "Species" s ON s.id = p."speciesId"
       WHERE p."ownerId" = $1 AND p."teamSlot" IS NOT NULL
       ORDER BY p."teamSlot" ASC LIMIT 1`,
      [userId],
    );
    expect(mon!.name.toLowerCase()).toContain("bulbasaur");
    expect(mon!.currentHp).toBeGreaterThan(0);
    expect(mon!.level).toBeGreaterThan(0);
  });

  test("el home carga con el carrusel de eventos completo", async () => {
    // El alta deja abierta la batalla guionada del rival, y un combate activo
    // manda cualquier ruta a `/battle`. Se cierra para poder mirar el home.
    await closeActiveBattles(userId);

    await goto(page, "/es");
    // Incursión, safari, torre y evento limitado: si falta una, algo del
    // showcase dejó de resolver sus datos.
    await expect(page.locator(".home-event-card")).toHaveCount(4);
    await expect(page.locator(".home-event-card--tower")).toBeVisible();
  });
});
