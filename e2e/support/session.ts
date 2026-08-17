import { readFileSync } from "node:fs";

/**
 * Rutas de la sesión compartida.
 *
 * Viven acá y no en `auth.setup.ts` porque `playwright.config.ts` necesita
 * `STORAGE_STATE`, e importar el archivo de setup desde la config registraría
 * un test durante la carga de la configuración.
 */
export const STORAGE_STATE = "e2e/.auth/user.json";
export const ACCOUNT_FILE = "e2e/.auth/account.json";

export type SessionAccount = {
  username: string;
  email: string;
  password: string;
  userId: string;
};

/** Cuenta creada por el proyecto `setup`, para asserts contra la base. */
export function sessionAccount(): SessionAccount {
  return JSON.parse(readFileSync(ACCOUNT_FILE, "utf8")) as SessionAccount;
}
