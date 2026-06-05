import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/actions";
import {
  canManageSession,
  generateWorkshopCode,
  listManagedWorkshopSessions,
} from "@/lib/server/session-store";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    const { id } = await context.params;
    const access = await canManageSession(id, user.id);
    if (!access.exists) return NextResponse.json({ error: "Workshop not found." }, { status: 404 });
    if (!access.allowed || !access.info?.isGroup) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const workshopCode = await generateWorkshopCode(id, user.id);
    const sessions = await listManagedWorkshopSessions(user.id);
    return NextResponse.json({ workshopCode, sessions });
  } catch (error) {
    console.error("Failed to generate workshop code", error);
    return NextResponse.json({ error: "Failed to generate workshop code." }, { status: 500 });
  }
}
