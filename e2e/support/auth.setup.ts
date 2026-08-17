import { expect, test as setup } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { newAccount, pickStarter, register } from "./account";
import { queryOne } from "./db";
import { ACCOUNT_FILE, STORAGE_STATE } from "./session";
import { markTutorialsSeen } from "./ui";

/**
 * Crea **una** cuenta con inicial elegido y guarda su sesión en disco.
 *
 * Sin esto cada spec pagaría el alta completa (~17s) y, peor, crearía una
 * cuenta más en la base compartida. Los specs que vienen después arrancan ya
 * logueados y con un equipo válido, que es la precondición de casi todo lo
 * jugable.
 */
setup("crear cuenta de pruebas", async ({ page }) => {
  const account = newAccount();
  await register(page, account);

  await pickStarter(page);

  const user = await queryOne<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [
    account.email,
  ]);
  expect(user).not.toBeNull();

  await expect
    .poll(
      async () =>
        (
          await queryOne<{ n: string }>(
            `SELECT COUNT(*)::text AS n FROM "PokemonInstance"
             WHERE "ownerId" = $1 AND "teamSlot" IS NOT NULL`,
            [user!.id],
          )
        )?.n ?? "0",
      { timeout: 30_000, message: "la cuenta de pruebas quedó sin equipo" },
    )
    .not.toBe("0");

  // Antes de guardar la sesión: los tutoriales de primera visita quedan
  // marcados como vistos, así ningún spec pelea contra un modal de bienvenida.
  await markTutorialsSeen(page);

  mkdirSync(dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
  writeFileSync(ACCOUNT_FILE, JSON.stringify({ ...account, userId: user!.id }, null, 2));
});
