import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "./e2e/support/env";
import { STORAGE_STATE } from "./e2e/support/session";

loadEnv();

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * E2E contra la app real.
 *
 * Dos decisiones que no son las de un proyecto Playwright típico y conviene
 * dejar escritas:
 *
 * 1. `workers: 1` y `fullyParallel: false`. En local la base suele ser la de
 *    Supabase, compartida y detrás de un pooler con pocos slots. Paralelizar no
 *    solo satura Supavisor: las suites empiezan a pisarse en estado global
 *    (rankings, barra comunitaria de incursión). El costo es tiempo de corrida,
 *    que en una suite de smoke es aceptable.
 *
 * 2. `reuseExistingServer`. En local casi siempre ya hay un `npm run dev`
 *    andando; levantar un segundo servidor contra la misma base duplicaría
 *    conexiones para nada.
 */
export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/support/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  // El dev server de Next compila cada ruta la primera vez que se visita; el
  // default de 30s se queda corto en la primera navegación a rutas pesadas.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    locale: "es-AR",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Crea la cuenta de pruebas y deja la sesión en disco.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    // El alta se prueba a sí misma: arranca sin sesión, a propósito.
    {
      name: "onboarding",
      testMatch: /onboarding\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: /(onboarding|mobile-shell)\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile-shell\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: STORAGE_STATE },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
