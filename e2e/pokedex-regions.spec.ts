import { expect, test } from "@playwright/test";
import { closeActiveBattles, query } from "./support/db";
import { sessionAccount } from "./support/session";
import { waitForBootSplash } from "./support/ui";

const crobatId = "e2e-pokedex-pc-crobat";

test.beforeEach(async () => {
  const { userId } = sessionAccount();
  await closeActiveBattles(userId);
  await query(
    `INSERT INTO "PokemonInstance" ("id", "ownerId", "speciesId", "currentHp", "teamSlot")
     VALUES ($1, $2, 169, 100, NULL)
     ON CONFLICT ("id") DO UPDATE SET "ownerId" = EXCLUDED."ownerId", "teamSlot" = NULL`,
    [crobatId, userId],
  );
});

test.afterEach(async () => {
  await query(`DELETE FROM "PokemonInstance" WHERE "id" = $1`, [crobatId]);
});

test("un Pokémon de Johto guardado en PC cuenta como visto y capturado", async ({ page }) => {
  await page.goto("/es/pokedex", { waitUntil: "domcontentloaded" });
  await waitForBootSplash(page);

  await page.getByRole("button", { name: /^Johto\b/ }).first().click();
  await page.getByRole("button", { name: /crobat/i }).click();

  const detail = page.getByTestId("pokedex-detail");
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("heading", { name: /crobat/i })).toBeVisible();
  await expect(detail.getByTestId("pokedex-owned")).toContainText("1");
  await expect(detail.getByTestId("pokedex-pc")).toContainText("1");
  await expect(detail.getByTestId("pokedex-team")).toContainText("0");
});
