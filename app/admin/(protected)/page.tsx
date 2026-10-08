import Link from "next/link";
import { LogoutButton } from "@/app/admin/_components/LogoutButton";

const MENU_ITEMS = [
  {
    href: "/admin/faq",
    label: "FAQ",
    description: "よくある質問の登録・編集",
  },
  {
    href: "/admin/menus",
    label: "メニューと料金",
    description: "メニュー名・料金の登録・編集",
  },
  {
    href: "/admin/conversations",
    label: "会話ログ",
    description: "お客様とのやり取りを確認",
  },
  {
    href: "/admin/broadcast",
    label: "お知らせ配信",
    description: "友だち全員にメッセージを送信",
  },
];

export default function AdminTopPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-900">管理メニュー</h1>
        <LogoutButton />
      </div>
      <div className="flex flex-col gap-3">
        {MENU_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-[88px] flex-col justify-center gap-1 rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm active:bg-zinc-100"
          >
            <span className="text-lg font-semibold text-zinc-900">
              {item.label}
            </span>
            <span className="text-sm text-zinc-500">{item.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
