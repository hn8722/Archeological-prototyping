import { NextRequest, NextResponse } from "next/server";
import { listPublicSessions } from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

export async function GET(request: NextRequest) {
  try {
    const excludeSelf = request.nextUrl.searchParams.get("excludeSelf") === "true";

    let excludeOwnerId: string | undefined;
    if (excludeSelf) {
      const user = await getUser();
      excludeOwnerId = user?.id;
    }

    const sessions = await listPublicSessions(excludeOwnerId);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Failed to list gallery sessions", error);
    return NextResponse.json({ error: "ギャラリーの取得に失敗しました。" }, { status: 500 });
  }
}
