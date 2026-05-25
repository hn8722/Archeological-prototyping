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
    const body = (await request.json()) as { userId: string; role?: string };

    if (!body.userId) {
      return NextResponse.json({ error: "userId が必要です。" }, { status: 400 });
    }

    await addGroupMember(id, body.userId, body.role ?? "member");
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
    const body = (await request.json()) as { userId: string };

    if (!body.userId) {
      return NextResponse.json({ error: "userId が必要です。" }, { status: 400 });
    }

    await removeGroupMember(id, body.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to remove member", error);
    return NextResponse.json({ error: "メンバー削除に失敗しました。" }, { status: 500 });
  }
}
