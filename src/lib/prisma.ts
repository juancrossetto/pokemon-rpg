import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Subí este número cuando cambie el schema y el HMR deje un client viejo
// en globalThis (p. ej. campos nuevos como currentPp / wildMovePp).
const PRISMA_CLIENT_EPOCH = 5;

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
    msg.includes("max clients reached")
  );
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const localDev = isLocalPrismaDev(connectionString);
  const supabase = isSupabasePooler(connectionString);
  // Session mode (:5432) limita clientes a pool_size (~15). En Next dev el HMR
  // y varios pools suman rápido → EMAXCONNSESSION. Transaction mode (:6543)
  // + max bajo es lo correcto para app.
  const max = localDev || supabase ? 1 : process.env.NODE_ENV === "production" ? 5 : 2;

  const pool = new Pool({
    connectionString: cleanConnectionString(connectionString),
    max,
    idleTimeoutMillis: localDev || supabase ? 5_000 : 20_000,
    connectionTimeoutMillis: 10_000,
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
      async $allOperations({ args, query }) {
        const attempts = 3;
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
          try {
            return await query(args);
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
