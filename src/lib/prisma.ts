import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
  const resolvedDatabaseUrl = databaseUrl || (isProductionBuild
    ? "postgresql://build:build@127.0.0.1:5432/build?sslmode=disable"
    : undefined);

  if (!resolvedDatabaseUrl) {
    throw new Error("DATABASE_URL não está configurada.");
  }

  let url: URL;
  try {
    url = new URL(resolvedDatabaseUrl);
  } catch {
    if (!isProductionBuild) {
      throw new Error("DATABASE_URL está configurada com formato inválido.");
    }
    url = new URL("postgresql://build:build@127.0.0.1:5432/build?sslmode=disable");
  }

  // Limita as conexões por instância serverless.
  url.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT || "1");
  url.searchParams.set("pool_timeout", process.env.PRISMA_POOL_TIMEOUT || "10");

  return new PrismaClient({
    datasources: {
      db: {
        url: url.toString(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reutiliza o cliente quando a instância é reaproveitada, inclusive em produção.
globalForPrisma.prisma = prisma;
