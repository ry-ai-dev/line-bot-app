import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// サーバーコンポーネント・Route Handlerから呼ぶ、ログインユーザー権限で動くクライアント。
// RLSが効くため、管理画面の操作は必ずこのクライアント(またはservice client)経由で行う。
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Componentから呼ばれた場合は無視(proxyがセッションを更新する)
          }
        },
      },
    }
  );
}
