import { NextResponse } from "next/server";
import { createSessionRecord, listGroupSessions } from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ sessions: [] });

    const sessions = await listGroupSessions(user.id, user.email);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Failed to list group sessions", error);
    return NextResponse.json({ error: "グループセッションの取得に失敗しました。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const session = await createSessionRecord(body.name, user.id, undefined, true);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("Failed to create group session", error);
    return NextResponse.json({ error: "グループの作成に失敗しました。" }, { status: 500 });
  }
}
