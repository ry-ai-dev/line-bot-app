import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export function AdminHeader({
  title,
  backHref,
}: {
  title: string;
  backHref?: string;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur">
      <div className="min-h-[44px] flex items-center">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex h-11 min-h-[44px] items-center text-sm font-medium text-zinc-600"
          >
            ← 戻る
          </Link>
        ) : (
          <span className="h-11" />
        )}
      </div>
      <h1 className="truncate text-base font-semibold text-zinc-900">{title}</h1>
      <LogoutButton />
    </div>
  );
}
