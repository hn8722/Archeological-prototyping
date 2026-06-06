import { NextResponse } from "next/server";
import {
  createWorkshopParticipantByCode,
  WORKSHOP_PARTICIPANT_COOKIE,
} from "@/lib/server/session-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { code?: string; name?: string };
    const code = body.code?.trim();
    const name = body.name?.trim();

    if (!code || !name) {
      return NextResponse.json({ error: "参加コードと名前が必要です。" }, { status: 400 });
    }

    const result = await createWorkshopParticipantByCode(code, name);
    if (!result.ok) {
      const message =
        result.reason === "closed"
          ? "このワークショップは開始前または終了済みです。"
          : result.reason === "not_found"
            ? "参加コードが見つかりません。"
            : "参加情報が不足しています。";
      return NextResponse.json({ error: message, reason: result.reason }, { status: 400 });
    }

    const response = NextResponse.json({
      sessionId: result.sessionId,
      participant: result.participant,
    });
    response.cookies.set(WORKSHOP_PARTICIPANT_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    console.error("Failed to join workshop as participant", error);
    return NextResponse.json({ error: "ワークショップに参加できませんでした。" }, { status: 500 });
  }
}
