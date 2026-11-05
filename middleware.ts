import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authModeFromEnv, buildAuthRedirectTarget, isDevOnlyPath, isEmailAllowed, isProtectedAppPath } from "@/lib/auth-paths";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (process.env.NODE_ENV !== "development" && isDevOnlyPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (authModeFromEnv() !== "authenticated") {
    return hasSupabase ? (await updateSession(request)).response : NextResponse.next();
  }

  if (!hasSupabase) {
    return new NextResponse("Auth is enabled but Supabase is not configured.", { status: 503 });
  }

  const { response, claims } = await updateSession(request);

  if (!isProtectedAppPath(pathname) || isEmailAllowed(claims?.email as string | undefined)) {
    return response;
  }

  const denied = pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Sign in required." }, { status: 401 })
    : NextResponse.redirect(new URL(buildAuthRedirectTarget(pathname, search), request.url));

  response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
  return denied;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
