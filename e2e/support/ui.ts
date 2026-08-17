import type { Page } from "@playwright/test";

/**
 * Claves de "ya lo vi" (`src/lib/journey-ux.ts`).
 *
 * Los tutoriales de primera visita son overlays modales: tapan la pantalla y se
 * comen el primer clic de cada sección. Una cuenta de prueba es siempre una
 * cuenta nueva, así que sin esto **todos** los specs pelearían contra ellos.
 *
 * Se marcan como vistos en vez de cerrarlos a mano en cada spec: cerrarlos
 * dependería del texto del botón (tres idiomas) y ataría cada test a un flujo
 * que no está probando. El del inicial es la excepción y se camina de verdad,
 * porque ahí sí es parte del alta.
 */
const SEEN_KEYS = [
  "journey-onboarding",
  "starter-resources",
  "coach-explore",
  "coach-gym",
  "coach-team-slot",
  "coach-heal",
  "coach-market",
  "hub-help-campaign",
  "hub-help-battle",
  "hub-help-market",
];

export async function markTutorialsSeen(page: Page): Promise<void> {
  await page.evaluate((keys) => {
    for (const key of keys) {
      try {
        window.localStorage.setItem(`pokerpg:seen:${key}`, "1");
      } catch {
        /* modo privado */
      }
    }
  }, SEEN_KEYS);
}

/**
 * Espera a que el splash de arranque deje de tapar la pantalla.
 *
 * Vive en `sessionStorage`, que `storageState` no persiste, así que reaparece
 * en cada contexto nuevo. Mientras está, cualquier `click` rebota contra él
 * —Playwright reintenta hasta el timeout y el error habla del splash, no de lo
 * que se estaba probando.
 */
export async function waitForBootSplash(page: Page): Promise<void> {
  await page
    .locator("#boot-splash")
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => undefined);
}

/** Navega y deja la página lista para interactuar. */
export async function goto(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForBootSplash(page);
}
