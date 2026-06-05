import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/actions";
import { createSessionRecord, listManagedWorkshopSessions } from "@/lib/server/session-store";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    const sessions = await listManagedWorkshopSessions(user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Failed to list workshops", error);
    return NextResponse.json({ error: "Failed to list workshops." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const session = await createSessionRecord(body.name, user.id, undefined, true);
    const sessions = await listManagedWorkshopSessions(user.id);
    return NextResponse.json({ session, sessions }, { status: 201 });
  } catch (error) {
    console.error("Failed to create workshop", error);
    return NextResponse.json({ error: "Failed to create workshop." }, { status: 500 });
  }
}
