import { NextResponse } from "next/server";
import { canWriteSession, importGallerySelectionsIntoSession } from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

type ImportSelection = {
  targetKind: "node" | "edge";
  generationIndex: number;
  entryId: string;
};

type RequestBody = {
  targetSessionId?: string;
  sourceSessionId?: string;
  sourceSessionName?: string;
  sourceSnapshot?: string;
  selections?: ImportSelection[];
  mode?: "append" | "replace";
};

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;

    if (
      !body.targetSessionId ||
      !body.sourceSessionId ||
      !body.sourceSessionName ||
      !body.sourceSnapshot ||
      !body.selections?.length ||
      !body.mode
    ) {
      return NextResponse.json({ error: "Import payload is incomplete." }, { status: 400 });
    }

    const access = await canWriteSession(body.targetSessionId, user.id);
    if (!access.exists) {
      return NextResponse.json({ error: "取り込み先のセッションが見つかりません。" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "このセッションへ取り込む権限がありません。" }, { status: 403 });
    }

    const session = await importGallerySelectionsIntoSession({
      targetSessionId: body.targetSessionId,
      sourceSessionId: body.sourceSessionId,
      sourceSessionName: body.sourceSessionName,
      sourceSnapshot: body.sourceSnapshot,
      selections: body.selections,
      mode: body.mode,
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Failed to import gallery selections", error);
    return NextResponse.json({ error: "Failed to import selections." }, { status: 500 });
  }
}
