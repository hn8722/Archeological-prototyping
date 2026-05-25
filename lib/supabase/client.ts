import { createBrowserClient } from "@supabase/ssr";

/**
 * クライアントコンポーネント用Supabaseクライアント。
 * ブラウザ上でのRealtime購読・認証状態取得に使用する。
 *
 * ⚠️ Server Components / Server Actions からは import しないこと。
 *    サーバー側は lib/supabase/server.ts を使うこと。
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
