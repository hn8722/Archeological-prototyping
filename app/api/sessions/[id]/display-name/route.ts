import { NextResponse } from "next/server";
import { canWriteSession, setGroupMemberDisplayName } from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    const { id } = await context.params;
    const access = await canWriteSession(id, user.id, user.email);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed || !access.info?.isGroup) {
      return NextResponse.json({ error: "グループ参加者のみ表示名を設定できます。" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { displayName?: unknown };
    if (typeof body.displayName !== "string") {
      return NextResponse.json({ error: "表示名を入力してください。" }, { status: 400 });
    }
    const displayName = body.displayName.trim();
    if (!displayName || displayName.length > 80) {
      return NextResponse.json({ error: "表示名は1〜80文字で入力してください。" }, { status: 400 });
    }

    const updated = await setGroupMemberDisplayName(id, user.id, displayName, user.email);
    if (!updated) {
      return NextResponse.json({ error: "参加者情報を更新できませんでした。" }, { status: 409 });
    }
    return NextResponse.json({ displayName });
  } catch (error) {
    console.error("Failed to save group display name", error);
    return NextResponse.json({ error: "表示名の保存に失敗しました。" }, { status: 500 });
  }
}
