import "server-only";

import { cache } from "react";
import { auth } from "@/auth";

/**
 * Sesión memoizada durante un render del servidor.
 *
 * Layout, header y página se renderizan en paralelo y todos necesitan la misma
 * sesión. `cache()` evita repetir el trabajo criptográfico/cookies dentro del
 * mismo request sin conservar datos de un usuario entre requests.
 */
export const getAuthSession = cache(async () => auth());
