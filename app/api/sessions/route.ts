import { NextResponse } from "next/server";
import { createSessionRecord, listSessionRecords } from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ sessions: [] }, { status: 401 });
    }
    const sessions = await listSessionRecords(user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Failed to list sessions", error);
    return NextResponse.json({ error: "セッション一覧の取得に失敗しました。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as { name?: string; snapshot?: string };
    const session = await createSessionRecord(body.name, user.id, body.snapshot);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("Failed to create session", error);
    return NextResponse.json({ error: "セッションの作成に失敗しました。" }, { status: 500 });
  }
}
