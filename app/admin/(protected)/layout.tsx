import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/app/admin/_components/LogoutButton";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: isAdmin } = await supabase.rpc("is_bot_admin");

  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center">
        <p className="text-base font-medium text-zinc-800">
          このアカウントには管理画面の権限がありません。
        </p>
        <p className="text-sm text-zinc-500">
          心当たりがない場合はオーナーにご確認ください。
        </p>
        <LogoutButton />
      </div>
    );
  }

  return <div className="min-h-dvh bg-zinc-50">{children}</div>;
}
