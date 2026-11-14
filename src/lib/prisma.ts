import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL não está configurada.");
  }

  const url = new URL(databaseUrl);

  // Limita as conexões por instância serverless.
  url.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT || "3");

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
