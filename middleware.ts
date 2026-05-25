import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスにミドルウェアを適用する:
     * - _next/static  (静的ファイル)
     * - _next/image   (画像最適化)
     * - favicon.ico
     * - api/          (API Routes はミドルウェアのセッション検証不要)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
