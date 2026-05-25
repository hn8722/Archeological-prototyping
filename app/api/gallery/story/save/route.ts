import { NextResponse } from "next/server";
import { createSessionFromGalleryStory } from "@/lib/server/session-store";
import { getUser } from "@/lib/auth/actions";

type RequestBody = {
  name?: string;
  story?: string;
  model?: string;
  sourceSessions?: { id: string; name: string }[];
};

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;

    if (!body.story?.trim() || !body.sourceSessions?.length) {
      return NextResponse.json({ error: "Story save payload is incomplete." }, { status: 400 });
    }

    const session = await createSessionFromGalleryStory({
      name: body.name?.trim() || "Gallery Story",
      story: body.story.trim(),
      model: body.model,
      sourceSessions: body.sourceSessions,
      ownerId: user.id,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("Failed to save gallery story", error);
    return NextResponse.json({ error: "Failed to save gallery story." }, { status: 500 });
  }
}
