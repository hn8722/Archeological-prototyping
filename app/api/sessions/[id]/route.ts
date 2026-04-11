import { NextResponse } from "next/server";
import {
  buildInitialSession,
  deleteSessionRecord,
  getSessionRecord,
  saveSessionRecord,
} from "@/lib/server/session-store";
import { SessionModel } from "@/lib/types/ap";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getSessionRecord(id);

    if (!session) {
      const fallback = buildInitialSession(id);
      return NextResponse.json({ session: fallback, persisted: false });
    }

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
    const body = (await request.json()) as { session?: SessionModel };

    if (!body.session || body.session.id !== id) {
      return NextResponse.json({ error: "保存データが不正です。" }, { status: 400 });
    }

    const session = await saveSessionRecord(body.session);
    return NextResponse.json({ session });
  } catch (error) {
    console.error("Failed to save session", error);
    return NextResponse.json({ error: "セッションの保存に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await deleteSessionRecord(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete session", error);
    return NextResponse.json({ error: "セッションの削除に失敗しました。" }, { status: 500 });
  }
}
