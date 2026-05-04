import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isDevOnlyPath } from "@/lib/auth-paths";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.NODE_ENV !== "development" && isDevOnlyPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
