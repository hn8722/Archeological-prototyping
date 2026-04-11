import { NextResponse } from "next/server";
import { createSessionRecord, listSessionRecords } from "@/lib/server/session-store";

export async function GET() {
  try {
    const sessions = await listSessionRecords();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Failed to list sessions", error);
    return NextResponse.json({ error: "セッション一覧の取得に失敗しました。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const session = await createSessionRecord(body.name);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("Failed to create session", error);
    return NextResponse.json({ error: "セッションの作成に失敗しました。" }, { status: 500 });
  }
}
