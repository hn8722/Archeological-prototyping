import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const projectRoot = process.cwd();
const env = readEnvFile(path.join(projectRoot, ".env"));
const databaseUrl = process.env.DATABASE_URL ?? env.DATABASE_URL;

if (!databaseUrl?.startsWith("postgres")) {
  console.error("DATABASE_URL must be a PostgreSQL connection URL.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  const [sessions, stories, members, participants] = await Promise.all([
    client.query('SELECT * FROM "Session" ORDER BY "updatedAt" DESC'),
    client.query('SELECT * FROM "StoryDraft" ORDER BY "createdAt" DESC'),
    client.query('SELECT * FROM "GroupMember" ORDER BY "joinedAt" DESC'),
    client.query('SELECT * FROM "WorkshopParticipant" ORDER BY "joinedAt" DESC'),
  ]);

  const backupDir = path.join(projectRoot, "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `postgres-sessions-${timestamp}.json`);

  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        databaseUrl: "[redacted]",
        counts: {
          sessions: sessions.rowCount,
          stories: stories.rowCount,
          members: members.rowCount,
          participants: participants.rowCount,
        },
        sessions: sessions.rows.map(parseSessionSnapshot),
        stories: stories.rows,
        members: members.rows,
        participants: participants.rows,
      },
      null,
      2
    )
  );

  console.log(`Backed up ${sessions.rowCount} sessions to ${backupPath}`);
} catch (error) {
  console.error("PostgreSQL backup failed.", error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

function parseSessionSnapshot(row) {
  try {
    return { ...row, snapshot: JSON.parse(row.snapshot) };
  } catch {
    return row;
  }
}

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
