import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  acquireEditLock,
  canWriteSession,
  EditLockTarget,
  releaseEditLock,
  WORKSHOP_PARTICIPANT_COOKIE,
} from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

async function getParticipantToken() {
  return (await cookies()).get(WORKSHOP_PARTICIPANT_COOKIE)?.value;
}

function getEditActor(
  user: Awaited<ReturnType<typeof getUser>>,
  access: Awaited<ReturnType<typeof canWriteSession>>
) {
  if (user?.id) return { id: `user:${user.id}`, label: user.email ?? user.id };
  if ("participant" in access && access.participant) {
    return { id: `participant:${access.participant.id}`, label: access.participant.name };
  }
  return null;
}

function parseTarget(value: unknown): EditLockTarget | null {
  const target = value as Partial<EditLockTarget> | null;
  if (!target) return null;
  if (target.kind !== "node" && target.kind !== "edge") return null;
  if (typeof target.generation !== "number") return null;
  if (typeof target.entryId !== "string" || !target.entryId) return null;
  if (typeof target.entryIndex !== "number" || target.entryIndex < 0) return null;

  return {
    generation: target.generation,
    kind: target.kind,
    entryId: target.entryId,
    entryIndex: target.entryIndex,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUser();
    const participantToken = await getParticipantToken();
    const access = await canWriteSession(id, user?.id, user?.email, participantToken);

    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "編集権限がありません。" }, { status: 403 });
    }

    const actor = getEditActor(user, access);
    if (!actor) {
      return NextResponse.json({ error: "編集者を特定できません。" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { target?: unknown };
    const target = parseTarget(body.target);
    if (!target) {
      return NextResponse.json({ error: "ロック対象が不正です。" }, { status: 400 });
    }

    const result = await acquireEditLock(id, target, actor);
    if (!result.ok) {
      return NextResponse.json(
        { error: "この記述は他の参加者が編集中です。", lock: result.lock },
        { status: 409 }
      );
    }

    return NextResponse.json({ lock: result.lock });
  } catch (error) {
    console.error("Failed to acquire edit lock", error);
    return NextResponse.json({ error: "ロック取得に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUser();
    const participantToken = await getParticipantToken();
    const access = await canWriteSession(id, user?.id, user?.email, participantToken);

    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "編集権限がありません。" }, { status: 403 });
    }

    const actor = getEditActor(user, access);
    if (!actor) {
      return NextResponse.json({ error: "編集者を特定できません。" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { target?: unknown };
    const target = parseTarget(body.target);
    if (!target) {
      return NextResponse.json({ error: "ロック対象が不正です。" }, { status: 400 });
    }

    await releaseEditLock(id, target, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to release edit lock", error);
    return NextResponse.json({ error: "ロック解除に失敗しました。" }, { status: 500 });
  }
}
