import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDatabaseUrl?: string;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const databasePath = resolveSqlitePath(connectionString);
const databaseUrl = `file:${databasePath.replace(/\\/g, "/")}`;

ensureSqliteSchema(databasePath);

const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

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

function ensureSqliteSchema(databasePath: string) {
  const db = new Database(databasePath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "snapshot" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "StoryDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "model" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StoryDraft_sessionId_fkey"
        FOREIGN KEY ("sessionId") REFERENCES "Session" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "StoryDraft_sessionId_createdAt_idx"
      ON "StoryDraft" ("sessionId", "createdAt");
  `);

  db.close();
}

function resolveSqlitePath(url: string) {
  if (!url.startsWith("file:")) {
    throw new Error("Only sqlite file URLs are supported.");
  }

  const relativePath = url.slice("file:".length);
  return path.resolve(process.cwd(), "prisma", relativePath);
}
