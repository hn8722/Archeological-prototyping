import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/actions";
import { joinGroupSessionByWorkshopCode } from "@/lib/server/session-store";

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { code?: string };
    const code = body.code?.trim();
    if (!code) return NextResponse.json({ error: "Code is required." }, { status: 400 });

    const result = await joinGroupSessionByWorkshopCode(code, user.id, user.email);
    if (!result.ok) {
      const message =
        result.reason === "closed"
          ? "This workshop is not open."
          : "Workshop code was not found.";
      return NextResponse.json({ error: message, reason: result.reason }, { status: 404 });
    }

    return NextResponse.json({ sessionId: result.sessionId });
  } catch (error) {
    console.error("Failed to join workshop", error);
    return NextResponse.json({ error: "Failed to join workshop." }, { status: 500 });
  }
}
