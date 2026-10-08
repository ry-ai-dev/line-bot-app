import { type NextRequest } from "next/server";
import { updateAdminSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateAdminSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
