import { NextResponse } from "next/server";
import { canManageSession, setSessionPublic } from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

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
    const body = (await request.json()) as { isPublic: boolean };

    if (typeof body.isPublic !== "boolean") {
      return NextResponse.json({ error: "isPublic は boolean で指定してください。" }, { status: 400 });
    }

    const access = await canManageSession(id, user.id);
    if (!access.exists) {
      return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションを公開変更する権限がありません。" }, { status: 403 });
    }

    await setSessionPublic(id, body.isPublic);
    return NextResponse.json({ ok: true, isPublic: body.isPublic });
  } catch (error) {
    console.error("Failed to update publish status", error);
    return NextResponse.json({ error: "公開設定の更新に失敗しました。" }, { status: 500 });
  }
}
