import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/actions";
import { listWorkshopStories } from "@/lib/server/session-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    const { id } = await context.params;
    const stories = await listWorkshopStories(id, user.id);
    if (!stories) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    return NextResponse.json({
      stories: stories.map((story) => ({
        id: story.id,
        content: story.content,
        model: story.model,
        createdAt: story.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to list workshop stories", error);
    return NextResponse.json({ error: "Failed to list workshop stories." }, { status: 500 });
  }
}
