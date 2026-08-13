import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "@/server/config/env";
import { DatabaseError } from "@/server/core/errors";
import { firestore } from "@/server/firebase-admin";

/**
 * Cliente Prisma compartilhado (ou Proxy simulado se o Postgres estiver desativado).
 */
const globalForPrisma = globalThis as unknown as {
  __beautybotPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    return new Proxy({} as any, {
      get(target, prop) {
        if (prop === "$disconnect") return () => Promise.resolve();
        return () => {
          throw new Error(
            `Prisma está desativado. Tentativa de acessar a propriedade "${String(
              prop,
            )}" do banco relacional PostgreSQL. use o Firebase Firestore.`
          );
        };
      },
    });
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db: PrismaClient = globalForPrisma.__beautybotPrisma ?? createClient();

if (process.env.NODE_ENV !== "production" && loadEnv().DATABASE_URL) {
  globalForPrisma.__beautybotPrisma = db;
}

/** Ping leve para o health check. Retorna a latência em ms. */
export async function pingDatabase(): Promise<number> {
  const started = Date.now();
  try {
    await firestore.collection("_health_check").limit(1).get();
    return Date.now() - started;
  } catch (e) {
    throw new DatabaseError("Não foi possível alcançar o Firebase Firestore", e);
  }
}

export async function disconnectDatabase() {
  if (loadEnv().DATABASE_URL) {
    await db.$disconnect();
  }
}
