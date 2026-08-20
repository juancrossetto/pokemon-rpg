import { expect, test } from "@playwright/test";
import { closeActiveBattles } from "./support/db";
import { sessionAccount } from "./support/session";
import { goto, markTutorialsSeen } from "./support/ui";

test.beforeEach(async ({ page }) => {
  await closeActiveBattles(sessionAccount().userId);
  await page.goto("/es");
  await markTutorialsSeen(page);
  await page.evaluate(() => {
    window.sessionStorage.setItem("pokerpg:daily-gift-seen", "1");
  });
});

test("la navegación móvil permanece utilizable y sin desborde horizontal", async ({ page }) => {
  await goto(page, "/es");

  const bottomNav = page.locator('.mobile-bottom-nav:not([aria-hidden="true"])').last();
  await expect(bottomNav).toBeVisible();
  const menuButton = bottomNav.getByRole("button", { name: /Más|Menú/i });
  await expect(menuButton).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await menuButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("link", { name: /Eventos/i })).toBeVisible();
});

for (const route of ["/es/team", "/es/market", "/es/events", "/es/settings"] as const) {
  test(`${route} no desborda en viewport móvil`, async ({ page }) => {
    await goto(page, route);
    const metrics = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(metrics.content).toBeLessThanOrEqual(metrics.viewport + 1);
    await expect(page.locator('.mobile-bottom-nav:not([aria-hidden="true"])').last()).toBeVisible();
  });
}
