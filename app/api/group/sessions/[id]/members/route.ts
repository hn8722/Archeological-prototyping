import { NextResponse } from "next/server";
import { addGroupMember, canManageSession, removeGroupMember } from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    const { id } = await context.params;
    const access = await canManageSession(id, user.id);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed || !access.info?.isGroup) {
      return NextResponse.json({ error: "このグループを管理する権限がありません。" }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { userId?: unknown };
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!userId || userId.length > 320) {
      return NextResponse.json({ error: "招待先のユーザーIDまたはメールアドレスが不正です。" }, { status: 400 });
    }

    await addGroupMember(id, userId, "member");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to add member", error);
    return NextResponse.json({ error: "メンバー追加に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    const { id } = await context.params;
    const access = await canManageSession(id, user.id);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed || !access.info?.isGroup) {
      return NextResponse.json({ error: "このグループを管理する権限がありません。" }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { userId?: unknown };
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!userId || userId.length > 320) {
      return NextResponse.json({ error: "削除するユーザーIDまたはメールアドレスが不正です。" }, { status: 400 });
    }

    await removeGroupMember(id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to remove member", error);
    return NextResponse.json({ error: "メンバー削除に失敗しました。" }, { status: 500 });
  }
}
