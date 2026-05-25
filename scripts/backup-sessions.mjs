import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";

const projectRoot = process.cwd();
const env = readEnvFile(path.join(projectRoot, ".env"));
const databaseUrl = process.env.DATABASE_URL ?? env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

if (!databaseUrl.startsWith("file:")) {
  console.error("backup:sessions currently supports local SQLite file URLs only.");
  process.exit(1);
}

const dbPath = resolveSqlitePath(databaseUrl);
if (!fs.existsSync(dbPath)) {
  console.error(`Database file was not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const sessions = db
  .prepare(
    `SELECT "id", "name", "snapshot", "isGroup", "isPublic", "ownerId", "createdAt", "updatedAt"
     FROM "Session"
     ORDER BY "updatedAt" DESC`
  )
  .all()
  .map((row) => ({
    ...row,
    isGroup: Boolean(row.isGroup),
    isPublic: Boolean(row.isPublic),
    snapshot: parseSnapshot(row.snapshot),
  }));

const stories = db
  .prepare(`SELECT "id", "sessionId", "content", "model", "createdAt" FROM "StoryDraft" ORDER BY "createdAt" DESC`)
  .all();

const members = db
  .prepare(`SELECT "id", "sessionId", "userId", "role", "joinedAt" FROM "GroupMember" ORDER BY "joinedAt" DESC`)
  .all();

db.close();

const backupDir = path.join(projectRoot, "backups");
fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `sessions-${timestamp}.json`);

fs.writeFileSync(
  backupPath,
  JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      databaseUrl: redactDatabaseUrl(databaseUrl),
      counts: {
        sessions: sessions.length,
        stories: stories.length,
        members: members.length,
      },
      sessions,
      stories,
      members,
    },
    null,
    2
  )
);

console.log(`Backed up ${sessions.length} sessions to ${backupPath}`);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...valueParts] = line.split("=");
        const rawValue = valueParts.join("=").trim();
        return [key.trim(), rawValue.replace(/^["']|["']$/g, "")];
      })
  );
}

function resolveSqlitePath(url) {
  const relativePath = url.slice("file:".length);
  return path.resolve(projectRoot, "prisma", relativePath);
}

function parseSnapshot(snapshot) {
  try {
    return JSON.parse(snapshot);
  } catch {
    return snapshot;
  }
}

function redactDatabaseUrl(url) {
  return url.startsWith("file:") ? url : "[redacted]";
}
