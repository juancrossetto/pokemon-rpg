import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carga `.env` a `process.env`.
 *
 * Next lee el `.env` solo; Playwright no, y el teardown necesita `DATABASE_URL`
 * para borrar las cuentas de prueba. Se hace a mano en vez de sumar `dotenv`
 * como dependencia: son doce líneas y el formato que usamos no tiene nada
 * exótico (sin `export`, sin multilínea).
 *
 * No pisa variables ya definidas — así `E2E_BASE_URL=... npx playwright test`
 * sigue mandando sobre el archivo.
 */
export function loadEnv(file = ".env"): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
