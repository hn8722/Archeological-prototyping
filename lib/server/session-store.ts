import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { mockSession } from "@/lib/data/mockSession";
import { SessionModel } from "@/lib/types/ap";

export function buildInitialSession(sessionId: string, name?: string): SessionModel {
  const session = mockSession(sessionId);
  if (name?.trim()) {
    return {
      ...session,
      name: name.trim(),
    };
  }

  return session;
}

export async function createSessionRecord(name?: string) {
  const id = randomUUID();
  const session = buildInitialSession(id, name);

  const saved = await prisma.session.create({
    data: {
      id: session.id,
      name: session.name,
      snapshot: JSON.stringify(session),
    },
  });

  return deserializeSession(saved.snapshot);
}

export async function listSessionRecords() {
  const records = await prisma.session.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return records.map((record) => ({
    id: record.id,
    name: record.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}

export async function getSessionRecord(sessionId: string) {
  const record = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!record) return null;
  return deserializeSession(record.snapshot);
}

export async function saveSessionRecord(session: SessionModel) {
  const saved = await prisma.session.upsert({
    where: { id: session.id },
    create: {
      id: session.id,
      name: session.name,
      snapshot: JSON.stringify(session),
    },
    update: {
      name: session.name,
      snapshot: JSON.stringify(session),
    },
  });

  return deserializeSession(saved.snapshot);
}

export async function deleteSessionRecord(sessionId: string) {
  await prisma.session.delete({
    where: { id: sessionId },
  });
}

export async function saveStoryDraft(sessionId: string, content: string, model?: string) {
  return prisma.storyDraft.create({
    data: {
      sessionId,
      content,
      model,
    },
  });
}

function deserializeSession(snapshot: string): SessionModel {
  return JSON.parse(snapshot) as SessionModel;
}
