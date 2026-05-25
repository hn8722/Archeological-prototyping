import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDatabaseUrl?: string;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

if (!isPostgresUrl(databaseUrl)) {
  throw new Error("DATABASE_URL must be a PostgreSQL URL for the beta deployment.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });

export const prisma =
  globalForPrisma.prismaDatabaseUrl === databaseUrl && globalForPrisma.prisma
    ? globalForPrisma.prisma
    : new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDatabaseUrl = databaseUrl;
}

function isPostgresUrl(url: string) {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}
