import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * ミドルウェア専用のSupabaseクライアント。
 * リクエストごとにセッションを検証・リフレッシュする。
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ⚠️ getUser() はサーバー側でトークンを検証する唯一の安全な方法。
  //    getSession() はクッキーをそのまま信頼するため認証判定には使わないこと。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/workshop/join" ||
    pathname.startsWith("/session/");

  if (!isPublic && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublic && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}
