import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/actions";
import {
  canManageSession,
  deleteSessionRecord,
  listManagedWorkshopSessions,
  transferWorkshopOwner,
  updateManagedWorkshopSession,
} from "@/lib/server/session-store";

export async function PATCH(
  request: Request,
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

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      workshopStatus?: "draft" | "open" | "closed";
      workshopAllowReadAfterClose?: boolean;
      workshopAllowAi?: boolean;
      ownerId?: string;
    };

    if (body.ownerId !== undefined) {
      const transfer = await transferWorkshopOwner(id, user.id, body.ownerId);
      if (!transfer.ok) return NextResponse.json({ error: "Owner transfer failed." }, { status: 400 });
    } else {
      await updateManagedWorkshopSession(id, user.id, body);
    }
    const sessions = await listManagedWorkshopSessions(user.id);
    return NextResponse.json({ ok: true, sessions });
  } catch (error) {
    console.error("Failed to update workshop", error);
    return NextResponse.json({ error: "Failed to update workshop." }, { status: 500 });
  }
}

export async function DELETE(
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

    await deleteSessionRecord(id);
    const sessions = await listManagedWorkshopSessions(user.id);
    return NextResponse.json({ ok: true, sessions });
  } catch (error) {
    console.error("Failed to delete workshop", error);
    return NextResponse.json({ error: "Failed to delete workshop." }, { status: 500 });
  }
}
