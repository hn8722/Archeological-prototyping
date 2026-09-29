import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  applySessionPatchRecord,
  canManageSession,
  canReadSession,
  canWriteSession,
  deleteSessionRecord,
  getGroupMemberDisplayName,
  getSessionRecord,
  saveSessionRecordIfRevisionMatches,
  WORKSHOP_PARTICIPANT_COOKIE,
} from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";
import { SessionModel, SessionPatch } from "@/lib/types/ap";

async function getParticipantToken() {
  return (await cookies()).get(WORKSHOP_PARTICIPANT_COOKIE)?.value;
}

async function getEditActor(
  user: Awaited<ReturnType<typeof getUser>>,
  access: Awaited<ReturnType<typeof canWriteSession>>,
  sessionId: string
) {
  if (user?.id) {
    const displayName = access.info?.isGroup
      ? await getGroupMemberDisplayName(sessionId, user.id, user.email)
      : null;
    return { id: `user:${user.id}`, label: displayName ?? user.email ?? user.id };
  }
  if ("participant" in access && access.participant) {
    return { id: `participant:${access.participant.id}`, label: access.participant.name };
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUser();
    const participantToken = await getParticipantToken();
    const access = await canReadSession(id, user?.id, user?.email, participantToken);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションを閲覧する権限がありません。" }, { status: 403 });
    }

    const session = await getSessionRecord(id);
    const memberDisplayName =
      user && access.info?.isGroup
        ? await getGroupMemberDisplayName(id, user.id, user.email)
        : null;
    return NextResponse.json({
      session,
      persisted: true,
      isGroup: Boolean(access.info?.isGroup),
      participant: access.participant
        ? { id: access.participant.id, name: access.participant.name }
        : memberDisplayName
          ? { id: `user:${user?.id}`, name: memberDisplayName }
          : null,
    });
  } catch (error) {
    console.error("Failed to fetch session", error);
    return NextResponse.json({ error: "セッションの取得に失敗しました。" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUser();
    const participantToken = await getParticipantToken();
    const body = (await request.json()) as { session?: SessionModel };

    if (!body.session || body.session.id !== id) {
      return NextResponse.json({ error: "保存データが不正です。" }, { status: 400 });
    }

    const access = await canWriteSession(id, user?.id, user?.email, participantToken);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションを編集する権限がありません。" }, { status: 403 });
    }

    const result = await saveSessionRecordIfRevisionMatches(body.session);
    if (!result.ok) {
      return NextResponse.json(
        { error: "最新の変更と競合しました。", session: result.session },
        { status: 409 }
      );
    }

    return NextResponse.json({ session: result.session });
  } catch (error) {
    console.error("Failed to save session", error);
    return NextResponse.json({ error: "セッションの保存に失敗しました。" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUser();
    const participantToken = await getParticipantToken();
    const body = (await request.json()) as { patch?: SessionPatch };

    if (
      !body.patch ||
      body.patch.sessionId !== id ||
      typeof body.patch.mutationId !== "string" ||
      !body.patch.mutationId.trim() ||
      body.patch.mutationId.length > 128
    ) {
      return NextResponse.json({ error: "更新パッチが不正です。" }, { status: 400 });
    }

    const access = await canWriteSession(id, user?.id, user?.email, participantToken);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションを編集する権限がありません。" }, { status: 403 });
    }

    const actor = await getEditActor(user, access, id);
    const result = await applySessionPatchRecord(id, body.patch, actor ?? undefined);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.reason === "locked"
            ? "この記述は他の参加者が編集中です。"
            : "最新の変更と競合しました。",
          session: result.session,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      duplicate: "duplicate" in result && result.duplicate,
      revision: result.session.revision,
      session: result.session,
    });
  } catch (error) {
    console.error("Failed to patch session", error);
    return NextResponse.json({ error: "セッション更新に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    }
    const access = await canManageSession(id, user.id);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションを削除する権限がありません。" }, { status: 403 });
    }
    await deleteSessionRecord(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete session", error);
    return NextResponse.json({ error: "セッションの削除に失敗しました。" }, { status: 500 });
  }
}
