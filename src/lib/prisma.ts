import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Subí este número cuando cambie el schema y el HMR deje un client viejo
// en globalThis (p. ej. campos nuevos como currentPp / wildMovePp / evolveLevel / heldItem / declinedMoveIds).
const PRISMA_CLIENT_EPOCH = 45;

// Patrón singleton: en dev, Next.js recarga módulos en caliente y crearía
// una PrismaClient nueva (con su propio pool) en cada reload.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
  prismaClientEpoch?: number;
};

if (globalForPrisma.prismaClientEpoch !== PRISMA_CLIENT_EPOCH) {
  // Sin esto, cada bump de epoch deja un Pool zombie y satura Supavisor
  // (EMAXCONNSESSION / pool_size).
  void globalForPrisma.pgPool?.end().catch(() => undefined);
  globalForPrisma.pgPool = undefined;
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaClientEpoch = PRISMA_CLIENT_EPOCH;
}

/**
 * La URL de `prisma dev` trae params del engine de Prisma
 * (`connection_limit`, `pool_timeout`, etc.) que `pg.Pool` no entiende y
 * a veces dejan conexiones zombie → P1017 ConnectionClosed.
 */
function cleanConnectionString(raw: string): string {
  const url = new URL(raw);
  for (const key of [
    "connection_limit",
    "pool_timeout",
    "socket_timeout",
    "connect_timeout",
    "max_idle_connection_lifetime",
  ]) {
    url.searchParams.delete(key);
  }
  return url.toString();
}

function isLocalPrismaDev(connectionString: string): boolean {
  try {
    const { hostname, port } = new URL(connectionString);
    return (
      (hostname === "localhost" || hostname === "127.0.0.1") &&
      (port === "51214" || port === "51213" || port === "")
    );
  } catch {
    return false;
  }
}

/** Supavisor / pooler de Supabase (session :5432 o transaction :6543). */
function isSupabasePooler(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.includes("pooler.supabase.com");
  } catch {
    return false;
  }
}

/**
 * Session mode (:5432) da una conexión de servidor por cliente y se agota a
 * ~15 → ahí sí hay que quedarse en 1. Transaction mode (:6543) multiplexa:
 * varios clientes comparten conexiones de servidor, así que limitarse a 1 solo
 * serializa nuestras propias queries sin ganar nada.
 */
function isSupabaseSessionMode(connectionString: string): boolean {
  try {
    const { port } = new URL(connectionString);
    return isSupabasePooler(connectionString) && port !== "6543";
  } catch {
    return false;
  }
}

function isTransientConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    code?: string;
    message?: string;
    meta?: { driverAdapterError?: { name?: string; message?: string } };
  };
  if (err.code === "P1017") return true;
  const msg = `${err.message ?? ""} ${err.meta?.driverAdapterError?.message ?? ""}`.toLowerCase();
  return (
    msg.includes("connectionclosed") ||
    msg.includes("server has closed the connection") ||
    msg.includes("connection terminated") ||
    msg.includes("connection refused") ||
    msg.includes("emaxconnsession") ||
    msg.includes("max clients reached") ||
    msg.includes("timeout exceeded when trying to connect") ||
    msg.includes("connection timeout")
  );
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const localDev = isLocalPrismaDev(connectionString);
  const sessionMode = isSupabaseSessionMode(connectionString);
  const isProd = process.env.NODE_ENV === "production";

  // Con max: 1, las ~10 queries de un render se ejecutan en fila: contra un
  // pooler remoto (~166ms de ida y vuelta) eso es ~1,6s por página. Además una
  // sola conexión colgada bloquea toda la app. Solo session mode necesita 1.
  // Transaction mode (:6543) puede multiplexar — usá eso en DATABASE_URL.
  // En desarrollo una segunda conexión evita que el RSC del shell bloquee la
  // mutación de combate. El singleton + idle corto mantienen el consumo bajo;
  // producción en session mode conserva 1 para no multiplicar slots por pod.
  const max = localDev ? 2 : sessionMode ? (isProd ? 1 : 2) : isProd ? 10 : 5;

  // Idle corto en session mode evita acumular slots en Supavisor. En transaction
  // mode conviene mantener la conexión caliente (TLS+auth a US ~0.5–1s).
  const idleTimeoutMillis = localDev || sessionMode ? 5_000 : 60_000;

  const pool = new Pool({
    connectionString: cleanConnectionString(connectionString),
    max,
    idleTimeoutMillis,
    // Con max:1 y tráfico concurrente, 10s de espera solo alarga la cola.
    connectionTimeoutMillis: sessionMode ? 5_000 : 8_000,
    allowExitOnIdle: true,
  });

  // Sin esto, un idle client que el server cierra tumba el proceso de Node.
  pool.on("error", (err) => {
    console.error("[pg] idle client error:", err.message);
  });

  return pool;
}

function createPrismaClient(): PrismaClient {
  const pool = globalForPrisma.pgPool ?? createPool();
  globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool, {
    onPoolError: (err) => console.error("[prisma-pg] pool:", err.message),
    onConnectionError: (err) => console.error("[prisma-pg] connection:", err.message),
  });

  const base = new PrismaClient({ adapter });

  // Reintento corto ante cortes del proxy / pool lleno momentáneo.
  return base.$extends({
    query: {
      async $allOperations({ args, query, model, operation }) {
        const attempts = 3;
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
          try {
            const startedAt = performance.now();
            const result = await query(args);
            const elapsedMs = Math.round(performance.now() - startedAt);
            if (elapsedMs >= 750) {
              console.warn("[slow-query]", { model, operation, elapsedMs, attempt: i + 1 });
            }
            return result;
          } catch (error) {
            lastError = error;
            if (!isTransientConnectionError(error) || i === attempts - 1) throw error;
            await new Promise((resolve) => setTimeout(resolve, 80 * (i + 1)));
          }
        }
        throw lastError;
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
