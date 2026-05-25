import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { Prisma } from "@/generated/prisma/client";
import { mockSession } from "@/lib/data/mockSession";
import {
  EdgeEntry,
  ImportedEntryRecord,
  NodeEntry,
  SessionModel,
  SessionPatch,
} from "@/lib/types/ap";
import { applySessionPatch, normalizeSession } from "@/lib/session/patch";

export function buildInitialSession(sessionId: string, name?: string): SessionModel {
  const session = mockSession(sessionId);
  if (name?.trim()) {
    return { ...session, name: name.trim() };
  }
  return session;
}

export async function createSessionRecord(
  name?: string,
  ownerId?: string,
  snapshotJson?: string,
  isGroup = false
) {
  const id = randomUUID();

  let session: SessionModel;
  if (snapshotJson) {
    const parsed = JSON.parse(snapshotJson) as SessionModel;
    session = normalizeSession({ ...parsed, id, name: name?.trim() || parsed.name });
  } else {
    session = buildInitialSession(id, name);
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "Session" ("id", "name", "snapshot", "isGroup", "ownerId")
    VALUES (${session.id}, ${session.name}, ${JSON.stringify(session)}, ${isGroup}, ${ownerId ?? null})
  `);

  if (ownerId && isGroup) {
    await prisma.groupMember.create({
      data: { sessionId: session.id, userId: ownerId, role: "owner" },
    });
  }

  return session;
}

export async function listSessionRecords(ownerId?: string) {
  if (!ownerId) return [];

  type SessionRecordRow = {
    id: string;
    name: string;
    isPublic: boolean | number;
    createdAt: string | Date;
    updatedAt: string | Date;
  };

  const records = await prisma.$queryRaw<SessionRecordRow[]>(Prisma.sql`
      SELECT "id", "name", "isPublic", "createdAt", "updatedAt"
      FROM "Session"
      WHERE "isGroup" = false AND "ownerId" = ${ownerId}
      ORDER BY "updatedAt" DESC
    `);

  return records.map((r) => ({
    id: r.id,
    name: r.name,
    isPublic: Boolean(r.isPublic),
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }));
}

export async function listPublicSessions(excludeOwnerId?: string) {
  type PublicSessionRow = {
    id: string;
    name: string;
    ownerId: string | null;
    snapshot: string;
    createdAt: string | Date;
    updatedAt: string | Date;
  };

  const records = excludeOwnerId
    ? await prisma.$queryRaw<PublicSessionRow[]>(Prisma.sql`
        SELECT "id", "name", "ownerId", "snapshot", "createdAt", "updatedAt"
        FROM "Session"
        WHERE "isGroup" = false
          AND "isPublic" = true
          AND ("ownerId" IS NULL OR "ownerId" <> ${excludeOwnerId})
        ORDER BY "updatedAt" DESC
      `)
    : await prisma.$queryRaw<PublicSessionRow[]>(Prisma.sql`
        SELECT "id", "name", "ownerId", "snapshot", "createdAt", "updatedAt"
        FROM "Session"
        WHERE "isGroup" = false
          AND "isPublic" = true
        ORDER BY "updatedAt" DESC
      `);

  const storyRows = records.length
    ? await prisma.storyDraft.findMany({
        where: { sessionId: { in: records.map((record) => record.id) } },
        orderBy: { createdAt: "desc" },
        select: { sessionId: true, content: true },
      })
    : [];

  const latestStoryBySessionId = new Map<string, string>();
  for (const story of storyRows) {
    if (!latestStoryBySessionId.has(story.sessionId)) {
      latestStoryBySessionId.set(story.sessionId, story.content);
    }
  }

  return records.map((r) => ({
    id: r.id,
    name: r.name,
    ownerId: r.ownerId,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
    latestStory: latestStoryBySessionId.get(r.id) ?? null,
    snapshot: r.snapshot,
  }));
}

export async function listGroupSessions(userId: string, userEmail?: string | null) {
  type GroupSessionRow = {
    id: string;
    name: string;
    isPublic: boolean | number;
    ownerId: string | null;
    role: string;
    createdAt: string | Date;
    updatedAt: string | Date;
  };

  const lookupValues = uniqueIdentityValues(userId, userEmail);

  const rows = await prisma.$queryRaw<GroupSessionRow[]>(Prisma.sql`
    SELECT
      s."id",
      s."name",
      s."isPublic",
      s."ownerId",
      s."createdAt",
      s."updatedAt",
      gm."role"
    FROM "GroupMember" gm
    INNER JOIN "Session" s ON s."id" = gm."sessionId"
    WHERE gm."userId" IN (${Prisma.join(lookupValues)}) AND s."isGroup" = true
    ORDER BY gm."joinedAt" DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isPublic: Boolean(row.isPublic),
    ownerId: row.ownerId,
    role: row.role,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));
}

export async function getSessionRecord(sessionId: string) {
  const record = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!record) return null;
  return deserializeSession(record.snapshot);
}

type SessionAccessInfo = {
  id: string;
  ownerId: string | null;
  isGroup: boolean;
  isPublic: boolean;
};

export async function getSessionAccessInfo(sessionId: string): Promise<SessionAccessInfo | null> {
  type SessionAccessRow = {
    id: string;
    ownerId: string | null;
    isGroup: boolean | number;
    isPublic: boolean | number;
  };

  const rows = await prisma.$queryRaw<SessionAccessRow[]>(Prisma.sql`
    SELECT "id", "ownerId", "isGroup", "isPublic"
    FROM "Session"
    WHERE "id" = ${sessionId}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    ownerId: row.ownerId,
    isGroup: Boolean(row.isGroup),
    isPublic: Boolean(row.isPublic),
  };
}

export async function isGroupSessionMember(
  sessionId: string,
  userId: string,
  userEmail?: string | null
) {
  const lookupValues = uniqueIdentityValues(userId, userEmail);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*) as count
    FROM "GroupMember"
    WHERE "sessionId" = ${sessionId} AND "userId" IN (${Prisma.join(lookupValues)})
  `);

  return Number(rows[0]?.count ?? 0) > 0;
}

function uniqueIdentityValues(...values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

export async function canReadSession(
  sessionId: string,
  userId?: string,
  userEmail?: string | null
) {
  const info = await getSessionAccessInfo(sessionId);
  if (!info) return { exists: false as const, allowed: false as const, info: null };

  if (info.isGroup) {
    const allowed = userId ? await isGroupSessionMember(sessionId, userId, userEmail) : false;
    return { exists: true as const, allowed, info };
  }

  const allowed = Boolean(userId && info.ownerId === userId);
  return { exists: true as const, allowed, info };
}

export async function canWriteSession(
  sessionId: string,
  userId?: string,
  userEmail?: string | null
) {
  const info = await getSessionAccessInfo(sessionId);
  if (!info) return { exists: false as const, allowed: false as const, info: null };

  if (info.isGroup) {
    const allowed = userId ? await isGroupSessionMember(sessionId, userId, userEmail) : false;
    return { exists: true as const, allowed, info };
  }

  const allowed = Boolean(userId && info.ownerId === userId);
  return { exists: true as const, allowed, info };
}

export async function canManageSession(sessionId: string, userId?: string) {
  const info = await getSessionAccessInfo(sessionId);
  if (!info) return { exists: false as const, allowed: false as const, info: null };

  const allowed = Boolean(userId && info.ownerId === userId);
  return { exists: true as const, allowed, info };
}

export async function saveSessionRecord(session: SessionModel) {
  const normalizedSession = normalizeSession(session);
  const saved = await prisma.session.upsert({
    where: { id: normalizedSession.id },
    create: {
      id: normalizedSession.id,
      name: normalizedSession.name,
      snapshot: JSON.stringify(normalizedSession),
    },
    update: {
      name: normalizedSession.name,
      snapshot: JSON.stringify(normalizedSession),
    },
  });
  return deserializeSession(saved.snapshot);
}

export async function applySessionPatchRecord(sessionId: string, patch: SessionPatch) {
  const currentSession = (await getSessionRecord(sessionId)) ?? buildInitialSession(sessionId);
  const normalizedCurrent = normalizeSession(currentSession);

  if (normalizedCurrent.revision > patch.nextRevision) {
    return { ok: false as const, session: normalizedCurrent };
  }

  const nextSession = applySessionPatch(normalizedCurrent, patch);
  if (!nextSession) {
    return { ok: false as const, session: normalizedCurrent };
  }

  const savedSession = await saveSessionRecord(nextSession);
  return { ok: true as const, session: savedSession };
}

export async function setSessionPublic(sessionId: string, isPublic: boolean) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { isPublic },
  });
}

// ownerId未設定のセッションをログインユーザーに紐付ける（認証導入前のデータ移行用）
export async function claimUnownedSessions(ownerId: string) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Session"
    SET "ownerId" = ${ownerId}
    WHERE "ownerId" IS NULL AND "isGroup" = false
  `);
}

export async function deleteSessionRecord(sessionId: string) {
  await prisma.session.delete({ where: { id: sessionId } });
}

export async function saveStoryDraft(sessionId: string, content: string, model?: string) {
  return prisma.storyDraft.create({
    data: { sessionId, content, model },
  });
}

export async function createSessionFromGalleryStory(input: {
  name?: string;
  story: string;
  sourceSessions: { id: string; name: string }[];
  model?: string;
  ownerId: string;
}) {
  const baseSession = buildInitialSession("gallery-story-template", input.name || "Gallery Story");
  const session = await createSessionRecord(
    input.name || "Gallery Story",
    input.ownerId,
    JSON.stringify({
      ...baseSession,
      internalMeta: {
        gallerySourceSessionIds: input.sourceSessions.map((sessionItem) => sessionItem.id),
        gallerySourceSessionNames: input.sourceSessions.map((sessionItem) => sessionItem.name),
      },
    } satisfies SessionModel),
    false
  );

  await saveStoryDraft(session.id, input.story, input.model);
  return session;
}

type ImportSelection = {
  targetKind: "node" | "edge";
  generationIndex: number;
  entryId: string;
};

type ImportMode = "append" | "replace";

type ImportIntoSessionInput = {
  targetSessionId: string;
  sourceSessionId: string;
  sourceSessionName: string;
  sourceSnapshot: string;
  selections: ImportSelection[];
  mode: ImportMode;
};

function mergeText(existingText: string | null, incomingText: string | null, mode: ImportMode) {
  if (mode === "replace") return incomingText;
  const base = existingText?.trim();
  const incoming = incomingText?.trim();
  if (!base) return incoming || null;
  if (!incoming) return base;
  return `${base}\n\n---\n${incoming}`;
}

function mergeFieldEntries(
  existingFieldEntries: Record<string, string>[],
  incomingFieldEntries: Record<string, string>[],
  mode: ImportMode
) {
  if (mode === "replace") return incomingFieldEntries;
  return [...existingFieldEntries, ...incomingFieldEntries];
}

function updateImportedNode(node: NodeEntry, sourceNode: NodeEntry, mode: ImportMode): NodeEntry {
  const mergedFieldEntries = mergeFieldEntries(node.fieldEntries, sourceNode.fieldEntries, mode);
  const mergedText = mergeText(node.text, sourceNode.text, mode);

  return {
    ...node,
    fieldEntries: mergedFieldEntries,
    text: mergedText,
    status: mergedText?.trim() ? "filled" : "empty",
    isConfirmed: mergedFieldEntries.length > 0 || Boolean(mergedText?.trim()),
  };
}

function updateImportedEdge(edge: EdgeEntry, sourceEdge: EdgeEntry, mode: ImportMode): EdgeEntry {
  const mergedFieldEntries = mergeFieldEntries(edge.fieldEntries, sourceEdge.fieldEntries, mode);
  const mergedText = mergeText(edge.text, sourceEdge.text, mode);

  return {
    ...edge,
    fieldEntries: mergedFieldEntries,
    text: mergedText,
    status: mergedText?.trim() ? "filled" : "empty",
    isConfirmed: mergedFieldEntries.length > 0 || Boolean(mergedText?.trim()),
  };
}

export async function importGallerySelectionsIntoSession(input: ImportIntoSessionInput) {
  const targetSession = await getSessionRecord(input.targetSessionId);
  if (!targetSession) {
    throw new Error("Target session not found.");
  }

  const sourceSession = normalizeSession(JSON.parse(input.sourceSnapshot) as SessionModel);
  const importedAt = new Date().toISOString();
  const importedEntries: ImportedEntryRecord[] = [];

  const nextSession: SessionModel = {
    ...normalizeSession(targetSession),
    generations: targetSession.generations.map((generation) => {
      const generationSelections = input.selections.filter(
        (selection) => selection.generationIndex === generation.generationIndex
      );
      if (generationSelections.length === 0) return generation;

      let nextGeneration = generation;

      for (const selection of generationSelections) {
        if (selection.targetKind === "node") {
          const sourceNode = sourceSession.generations
            .find((item) => item.generationIndex === selection.generationIndex)
            ?.nodes[selection.entryId];
          const targetNode = nextGeneration.nodes[selection.entryId];
          if (!sourceNode || !targetNode) continue;

          nextGeneration = {
            ...nextGeneration,
            nodes: {
              ...nextGeneration.nodes,
              [selection.entryId]: updateImportedNode(targetNode, sourceNode, input.mode),
            },
          };
        } else {
          const sourceEdge = sourceSession.generations
            .find((item) => item.generationIndex === selection.generationIndex)
            ?.edges[selection.entryId];
          const targetEdge = nextGeneration.edges[selection.entryId];
          if (!sourceEdge || !targetEdge) continue;

          nextGeneration = {
            ...nextGeneration,
            edges: {
              ...nextGeneration.edges,
              [selection.entryId]: updateImportedEdge(targetEdge, sourceEdge, input.mode),
            },
          };
        }

        importedEntries.push({
          sourceSessionId: input.sourceSessionId,
          sourceSessionName: input.sourceSessionName,
          targetKind: selection.targetKind,
          generationIndex: selection.generationIndex,
          entryId: selection.entryId,
          mode: input.mode,
          importedAt,
        });
      }

      return nextGeneration;
    }),
    internalMeta: {
      ...targetSession.internalMeta,
      importedEntries: [
        ...(targetSession.internalMeta?.importedEntries ?? []),
        ...importedEntries,
      ],
    },
  };

  return saveSessionRecord(nextSession);
}

export async function addGroupMember(sessionId: string, userId: string, role = "member") {
  return prisma.groupMember.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    create: { sessionId, userId, role },
    update: { role },
  });
}

export async function removeGroupMember(sessionId: string, userId: string) {
  await prisma.groupMember.delete({
    where: { sessionId_userId: { sessionId, userId } },
  });
}

function deserializeSession(snapshot: string): SessionModel {
  return normalizeSession(JSON.parse(snapshot) as SessionModel);
}
