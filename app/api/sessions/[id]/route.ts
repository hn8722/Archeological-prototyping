import { NextResponse } from "next/server";
import {
  applySessionPatchRecord,
  canManageSession,
  canReadSession,
  canWriteSession,
  deleteSessionRecord,
  getSessionRecord,
  saveSessionRecord,
} from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";
import { SessionModel, SessionPatch } from "@/lib/types/ap";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUser();
    const access = await canReadSession(id, user?.id, user?.email);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションを閲覧する権限がありません。" }, { status: 403 });
    }
    const session = await getSessionRecord(id);
    return NextResponse.json({ session, persisted: true });
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
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    }
    const body = (await request.json()) as { session?: SessionModel };

    if (!body.session || body.session.id !== id) {
      return NextResponse.json({ error: "保存データが不正です。" }, { status: 400 });
    }

    const access = await canWriteSession(id, user.id, user.email);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションを編集する権限がありません。" }, { status: 403 });
    }

    const session = await saveSessionRecord(body.session);
    return NextResponse.json({ session });
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
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    }
    const body = (await request.json()) as { patch?: SessionPatch };

    if (!body.patch || body.patch.sessionId !== id) {
      return NextResponse.json({ error: "更新パッチが不正です。" }, { status: 400 });
    }

    const access = await canWriteSession(id, user.id, user.email);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションを編集する権限がありません。" }, { status: 403 });
    }

    const result = await applySessionPatchRecord(id, body.patch);
    if (!result.ok) {
      return NextResponse.json(
        { error: "最新の変更と競合しました。", session: result.session },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, revision: result.session.revision });
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
