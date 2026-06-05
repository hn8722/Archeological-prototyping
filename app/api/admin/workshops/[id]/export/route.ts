import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/actions";
import { buildWorkshopExport } from "@/lib/server/session-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    const { id } = await context.params;
    const data = await buildWorkshopExport(id, user.id);
    if (!data) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="workshop-${id}.json"`,
      },
    });
  } catch (error) {
    console.error("Failed to export workshop", error);
    return NextResponse.json({ error: "Failed to export workshop." }, { status: 500 });
  }
}
