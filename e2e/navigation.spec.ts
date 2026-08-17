import { expect, test } from "@playwright/test";
import { closeActiveBattles } from "./support/db";
import { sessionAccount } from "./support/session";
import { waitForBootSplash } from "./support/ui";

// Con un combate abierto la app redirige todo a `/battle` — el smoke de rutas
// no puede depender de qué dejó el spec anterior.
test.beforeEach(async () => {
  await closeActiveBattles(sessionAccount().userId);
});

/**
 * Smoke de rutas: cada pantalla principal abre sin romperse.
 *
 * Suena básico y sin embargo es lo que la suite unitaria no puede dar. Una
 * clave i18n faltante, un Server Component que consulta una columna que ya no
 * existe o un `undefined` en el render revientan **en runtime**: compilan,
 * pasan el typecheck y explotan recién cuando alguien entra. Este test entra.
 *
 * Se mira lo que rompe de verdad —status 5xx y errores de consola— y no el
 * contenido, que cambia con cada iteración de diseño y volvería el test un
 * recordatorio de actualizarlo en vez de una señal.
 */
/*
  Todas las rutas de `src/app/[locale]` menos las que necesitan un estado que
  este test no monta: `login`/`register`/`starter` (la sesión ya existe) y
  `battle` (sin combate abierto redirige).
*/
const ROUTES = [
  "/es",
  "/es/campaign",
  "/es/gyms",
  "/es/team",
  "/es/pc",
  "/es/pokedex",
  "/es/inventory",
  "/es/market",
  "/es/shop",
  "/es/ranking",
  "/es/tower",
  "/es/raids",
  "/es/safari",
  "/es/factory",
  "/es/pvp",
  "/es/events",
  "/es/clans",
  "/es/friends",
  "/es/profile",
  "/es/settings",
] as const;

/*
  Ruido conocido que no indica una falla de la página: extensiones, imágenes
  del CDN de sprites que a veces devuelven 404 (el componente ya cae a un
  fallback local) y el aviso de React DevTools.
*/
const IGNORED = [
  /favicon/i,
  /raw\.githubusercontent\.com/i,
  /Download the React DevTools/i,
  /Failed to load resource.*404/i,
];

for (const route of ROUTES) {
  test(`${route} carga sin errores`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (IGNORED.some((re) => re.test(text))) return;
      consoleErrors.push(text);
    });
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
    });

    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} respondió ${response?.status()}`).toBeLessThan(400);
    await waitForBootSplash(page);

    // El shell puede pintar antes de que resuelvan los Server Components; se
    // espera a la red en calma para que los errores tardíos también cuenten.
    await page.waitForLoadState("networkidle").catch(() => undefined);

    expect(serverErrors, `${route} tuvo respuestas 5xx`).toEqual([]);
    expect(consoleErrors, `${route} tuvo errores de consola`).toEqual([]);
  });
}
