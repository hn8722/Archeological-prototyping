import { createHash, randomBytes, randomUUID } from "node:crypto";
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

export const WORKSHOP_PARTICIPANT_COOKIE = "ap_workshop_participant";

function hashWorkshopToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

  const ownerFilter = excludeOwnerId
    ? Prisma.sql`AND ("ownerId" IS NULL OR "ownerId" <> ${excludeOwnerId})`
    : Prisma.sql``;

  const records = await prisma.$queryRaw<PublicSessionRow[]>(Prisma.sql`
    SELECT "id", "name", "ownerId", "snapshot", "createdAt", "updatedAt"
    FROM "Session"
    WHERE "isGroup" = false
      AND "isPublic" = true
      ${ownerFilter}
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

export type ManagedWorkshopSession = {
  id: string;
  name: string;
  ownerId: string | null;
  workshopCode: string | null;
  workshopStatus: string;
  workshopAllowReadAfterClose: boolean;
  workshopAllowAi: boolean;
  workshopClosedAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  participantCount: number;
  storyCount: number;
  members: { userId: string; role: string; joinedAt: string }[];
  participants: { id: string; name: string; joinedAt: string; lastSeenAt: string | null }[];
};

export async function listManagedWorkshopSessions(ownerId: string): Promise<ManagedWorkshopSession[]> {
  type WorkshopRow = {
    id: string;
    name: string;
    ownerId: string | null;
    workshopCode: string | null;
    workshopStatus: string | null;
    workshopAllowReadAfterClose: boolean | number | null;
    workshopAllowAi: boolean | number | null;
    workshopClosedAt: string | Date | null;
    createdAt: string | Date;
    updatedAt: string | Date;
    memberCount: bigint | number | string;
    participantCount: bigint | number | string;
    storyCount: bigint | number | string;
  };

  const rows = await prisma.$queryRaw<WorkshopRow[]>(Prisma.sql`
    SELECT
      s."id",
      s."name",
      s."ownerId",
      s."workshopCode",
      s."workshopStatus",
      s."workshopAllowReadAfterClose",
      s."workshopAllowAi",
      s."workshopClosedAt",
      s."createdAt",
      s."updatedAt",
      COUNT(DISTINCT gm."id") AS "memberCount",
      COUNT(DISTINCT wp."id") AS "participantCount",
      COUNT(DISTINCT sd."id") AS "storyCount"
    FROM "Session" s
    LEFT JOIN "GroupMember" gm ON gm."sessionId" = s."id"
    LEFT JOIN "WorkshopParticipant" wp ON wp."sessionId" = s."id"
    LEFT JOIN "StoryDraft" sd ON sd."sessionId" = s."id"
    WHERE s."isGroup" = true AND s."ownerId" = ${ownerId}
    GROUP BY s."id"
    ORDER BY s."updatedAt" DESC
  `);

  const members = rows.length
    ? await prisma.groupMember.findMany({
        where: { sessionId: { in: rows.map((row) => row.id) } },
        orderBy: { joinedAt: "asc" },
        select: { sessionId: true, userId: true, role: true, joinedAt: true },
      })
    : [];

  const membersBySessionId = new Map<string, { userId: string; role: string; joinedAt: string }[]>();
  for (const member of members) {
    const list = membersBySessionId.get(member.sessionId) ?? [];
    list.push({
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    });
    membersBySessionId.set(member.sessionId, list);
  }

  const participants = rows.length
    ? await prisma.workshopParticipant.findMany({
        where: { sessionId: { in: rows.map((row) => row.id) } },
        orderBy: { joinedAt: "asc" },
        select: { id: true, sessionId: true, name: true, joinedAt: true, lastSeenAt: true },
      })
    : [];

  const participantsBySessionId = new Map<
    string,
    { id: string; name: string; joinedAt: string; lastSeenAt: string | null }[]
  >();
  for (const participant of participants) {
    const list = participantsBySessionId.get(participant.sessionId) ?? [];
    list.push({
      id: participant.id,
      name: participant.name,
      joinedAt: participant.joinedAt.toISOString(),
      lastSeenAt: participant.lastSeenAt?.toISOString() ?? null,
    });
    participantsBySessionId.set(participant.sessionId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    workshopCode: row.workshopCode,
    workshopStatus: row.workshopStatus ?? "draft",
    workshopAllowReadAfterClose: Boolean(row.workshopAllowReadAfterClose ?? true),
    workshopAllowAi: Boolean(row.workshopAllowAi ?? true),
    workshopClosedAt: row.workshopClosedAt ? new Date(row.workshopClosedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    memberCount: Number(row.memberCount),
    participantCount: Number(row.participantCount),
    storyCount: Number(row.storyCount),
    members: membersBySessionId.get(row.id) ?? [],
    participants: participantsBySessionId.get(row.id) ?? [],
  }));
}

export async function updateManagedWorkshopSession(
  sessionId: string,
  ownerId: string,
  data: {
    name?: string;
    workshopStatus?: "draft" | "open" | "closed";
    workshopAllowReadAfterClose?: boolean;
    workshopAllowAi?: boolean;
  }
) {
  const updates: Prisma.Sql[] = [];
  if (data.name !== undefined) updates.push(Prisma.sql`"name" = ${data.name.trim() || "Untitled group"}`);
  if (data.workshopStatus !== undefined) {
    updates.push(Prisma.sql`"workshopStatus" = ${data.workshopStatus}`);
    updates.push(
      data.workshopStatus === "closed"
        ? Prisma.sql`"workshopClosedAt" = NOW()`
        : Prisma.sql`"workshopClosedAt" = NULL`
    );
  }
  if (data.workshopAllowReadAfterClose !== undefined) {
    updates.push(Prisma.sql`"workshopAllowReadAfterClose" = ${data.workshopAllowReadAfterClose}`);
  }
  if (data.workshopAllowAi !== undefined) {
    updates.push(Prisma.sql`"workshopAllowAi" = ${data.workshopAllowAi}`);
  }

  if (updates.length === 0) return;

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Session"
    SET ${Prisma.join(updates, ", ")}, "updatedAt" = NOW()
    WHERE "id" = ${sessionId} AND "ownerId" = ${ownerId} AND "isGroup" = true
  `);
}

export async function transferWorkshopOwner(
  sessionId: string,
  currentOwnerId: string,
  nextOwnerId: string
) {
  const trimmedNextOwnerId = nextOwnerId.trim();
  if (!trimmedNextOwnerId) {
    throw new Error("nextOwnerId is required.");
  }

  const updated = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    UPDATE "Session"
    SET "ownerId" = ${trimmedNextOwnerId}, "updatedAt" = NOW()
    WHERE "id" = ${sessionId} AND "ownerId" = ${currentOwnerId} AND "isGroup" = true
    RETURNING "id"
  `);

  if (!updated[0]) {
    return { ok: false as const };
  }

  await prisma.groupMember.upsert({
    where: { sessionId_userId: { sessionId, userId: trimmedNextOwnerId } },
    create: { sessionId, userId: trimmedNextOwnerId, role: "owner" },
    update: { role: "owner" },
  });

  if (trimmedNextOwnerId !== currentOwnerId) {
    await prisma.groupMember.upsert({
      where: { sessionId_userId: { sessionId, userId: currentOwnerId } },
      create: { sessionId, userId: currentOwnerId, role: "member" },
      update: { role: "member" },
    });
  }

  return { ok: true as const };
}

export async function generateWorkshopCode(sessionId: string, ownerId: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    try {
      const updated = await prisma.$queryRaw<{ workshopCode: string }[]>(Prisma.sql`
        UPDATE "Session"
        SET "workshopCode" = ${code}, "updatedAt" = NOW()
        WHERE "id" = ${sessionId} AND "ownerId" = ${ownerId} AND "isGroup" = true
        RETURNING "workshopCode"
      `);
      if (updated[0]?.workshopCode) return updated[0].workshopCode;
    } catch (error) {
      if (attempt === 5) throw error;
    }
  }
  throw new Error("Failed to generate workshop code.");
}

export async function joinGroupSessionByWorkshopCode(
  code: string,
  userId: string,
  _userEmail?: string | null
) {
  const normalizedCode = code.trim().toUpperCase();
  const rows = await prisma.$queryRaw<
    {
      id: string;
      workshopStatus: string | null;
    }[]
  >(Prisma.sql`
    SELECT "id", "workshopStatus"
    FROM "Session"
    WHERE "isGroup" = true AND "workshopCode" = ${normalizedCode}
    LIMIT 1
  `);

  const session = rows[0];
  if (!session) return { ok: false as const, reason: "not_found" as const };
  if ((session.workshopStatus ?? "draft") !== "open") {
    return { ok: false as const, reason: "closed" as const, sessionId: session.id };
  }

  await addGroupMember(session.id, userId, "member");
  return { ok: true as const, sessionId: session.id };
}

export async function createWorkshopParticipantByCode(code: string, name: string) {
  const normalizedCode = code.trim().toUpperCase();
  const trimmedName = name.trim();
  if (!normalizedCode || !trimmedName) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const rows = await prisma.$queryRaw<
    {
      id: string;
      workshopStatus: string | null;
    }[]
  >(Prisma.sql`
    SELECT "id", "workshopStatus"
    FROM "Session"
    WHERE "isGroup" = true AND "workshopCode" = ${normalizedCode}
    LIMIT 1
  `);

  const session = rows[0];
  if (!session) return { ok: false as const, reason: "not_found" as const };
  if ((session.workshopStatus ?? "draft") !== "open") {
    return { ok: false as const, reason: "closed" as const, sessionId: session.id };
  }

  const token = randomBytes(32).toString("base64url");
  const participant = await prisma.workshopParticipant.create({
    data: {
      sessionId: session.id,
      name: trimmedName.slice(0, 80),
      tokenHash: hashWorkshopToken(token),
      lastSeenAt: new Date(),
    },
    select: { id: true, name: true },
  });

  return { ok: true as const, sessionId: session.id, token, participant };
}

export async function getWorkshopParticipantForSession(sessionId: string, token?: string | null) {
  const trimmedToken = token?.trim();
  if (!trimmedToken) return null;

  const participant = await prisma.workshopParticipant.findUnique({
    where: { tokenHash: hashWorkshopToken(trimmedToken) },
    select: { id: true, sessionId: true, name: true, joinedAt: true, lastSeenAt: true },
  });

  if (!participant || participant.sessionId !== sessionId) return null;

  await prisma.workshopParticipant.update({
    where: { id: participant.id },
    data: { lastSeenAt: new Date() },
  });

  return participant;
}

export async function listWorkshopStories(sessionId: string, ownerId: string) {
  const access = await canManageSession(sessionId, ownerId);
  if (!access.allowed || !access.info?.isGroup) return null;
  return prisma.storyDraft.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, model: true, createdAt: true },
  });
}

export async function buildWorkshopExport(sessionId: string, ownerId: string) {
  const access = await canManageSession(sessionId, ownerId);
  if (!access.allowed || !access.info?.isGroup) return null;

  const [session, stories, members, participants] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId } }),
    prisma.storyDraft.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } }),
    prisma.groupMember.findMany({ where: { sessionId }, orderBy: { joinedAt: "asc" } }),
    prisma.workshopParticipant.findMany({ where: { sessionId }, orderBy: { joinedAt: "asc" } }),
  ]);

  if (!session) return null;
  return {
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      name: session.name,
      snapshot: JSON.parse(session.snapshot),
      workshopCode: session.workshopCode,
      workshopStatus: session.workshopStatus,
      workshopAllowReadAfterClose: session.workshopAllowReadAfterClose,
      workshopAllowAi: session.workshopAllowAi,
      workshopClosedAt: session.workshopClosedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
    members: members.map((member) => ({
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    })),
    participants: participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      joinedAt: participant.joinedAt.toISOString(),
      lastSeenAt: participant.lastSeenAt?.toISOString() ?? null,
    })),
    stories: stories.map((story) => ({
      id: story.id,
      content: story.content,
      model: story.model,
      createdAt: story.createdAt.toISOString(),
    })),
  };
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
  workshopStatus: string;
  workshopAllowReadAfterClose: boolean;
  workshopAllowAi: boolean;
};

export async function getSessionAccessInfo(sessionId: string): Promise<SessionAccessInfo | null> {
  type SessionAccessRow = {
    id: string;
    ownerId: string | null;
    isGroup: boolean | number;
    isPublic: boolean | number;
    workshopStatus: string | null;
    workshopAllowReadAfterClose: boolean | number | null;
    workshopAllowAi: boolean | number | null;
  };

  const rows = await prisma.$queryRaw<SessionAccessRow[]>(Prisma.sql`
    SELECT
      "id",
      "ownerId",
      "isGroup",
      "isPublic",
      "workshopStatus",
      "workshopAllowReadAfterClose",
      "workshopAllowAi"
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
    workshopStatus: row.workshopStatus ?? "draft",
    workshopAllowReadAfterClose: Boolean(row.workshopAllowReadAfterClose ?? true),
    workshopAllowAi: Boolean(row.workshopAllowAi ?? true),
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

async function resolveGroupAccess(
  sessionId: string,
  info: SessionAccessInfo,
  userId?: string,
  userEmail?: string | null,
  participantToken?: string | null
) {
  const participant = await getWorkshopParticipantForSession(sessionId, participantToken);
  const isMember = userId ? await isGroupSessionMember(sessionId, userId, userEmail) : false;
  const isOwner = Boolean(userId && info.ownerId === userId);
  const participantAllowed = Boolean(participant);
  return { participant, isMember, isOwner, participantAllowed };
}

export async function canReadSession(
  sessionId: string,
  userId?: string,
  userEmail?: string | null,
  participantToken?: string | null
) {
  const info = await getSessionAccessInfo(sessionId);
  if (!info) return { exists: false as const, allowed: false as const, info: null };

  if (info.isGroup) {
    const { participant, isMember, isOwner, participantAllowed } = await resolveGroupAccess(
      sessionId, info, userId, userEmail, participantToken
    );
    const allowed =
      (isMember || participantAllowed) &&
      (isOwner || info.workshopStatus !== "closed" || info.workshopAllowReadAfterClose);
    return { exists: true as const, allowed, info, participant };
  }

  const allowed = Boolean(userId && info.ownerId === userId);
  return { exists: true as const, allowed, info };
}

export async function canWriteSession(
  sessionId: string,
  userId?: string,
  userEmail?: string | null,
  participantToken?: string | null
) {
  const info = await getSessionAccessInfo(sessionId);
  if (!info) return { exists: false as const, allowed: false as const, info: null };

  if (info.isGroup) {
    const { participant, isMember, isOwner, participantAllowed } = await resolveGroupAccess(
      sessionId, info, userId, userEmail, participantToken
    );
    const allowed = (isMember || participantAllowed) && (isOwner || info.workshopStatus !== "closed");
    return { exists: true as const, allowed, info, participant };
  }

  const allowed = Boolean(userId && info.ownerId === userId);
  return { exists: true as const, allowed, info };
}

export async function canUseSessionAi(
  sessionId: string,
  userId?: string,
  userEmail?: string | null,
  participantToken?: string | null
) {
  const writeAccess = await canWriteSession(sessionId, userId, userEmail, participantToken);
  if (!writeAccess.allowed) return writeAccess;
  const isOwner = Boolean(userId && writeAccess.info?.ownerId === userId);
  const aiAllowed = Boolean(isOwner || writeAccess.info?.workshopAllowAi);
  return { ...writeAccess, allowed: aiAllowed };
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

function updateImportedEntry<T extends NodeEntry | EdgeEntry>(target: T, source: T, mode: ImportMode): T {
  const mergedFieldEntries = mergeFieldEntries(target.fieldEntries, source.fieldEntries, mode);
  const mergedText = mergeText(target.text, source.text, mode);

  return {
    ...target,
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
              [selection.entryId]: updateImportedEntry(targetNode, sourceNode, input.mode),
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
              [selection.entryId]: updateImportedEntry(targetEdge, sourceEdge, input.mode),
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
